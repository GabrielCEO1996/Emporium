import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rateLimit, rateLimitResponse } from '@/lib/security'

// ─── POST /api/tienda/pedido ────────────────────────────────────────────────
// Single entrypoint for the tienda cart.
//
// Branches on profiles.rol:
//   • cliente | vendedor | admin | conductor
//       → ORDEN estado='pendiente', admin approves manually
//       Response: { success: true, tipo: 'orden', numero, orden_id }
//
//   • comprador → Stripe checkout session, orden_id in metadata.
//       Webhook converts it to pedido+factura+transaccion on payment.
//       Response: { success: true, tipo: 'pago', url, numero, orden_id }
//
// If the ordenes table is missing, falls back to creating a PEDIDO directly.
//
// GUARANTEES: every code path returns a JSON response — never hangs, never {}.
// ─────────────────────────────────────────────────────────────────────────────

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2025-03-31.basil',
})

function isMissingRelation(err: any): boolean {
  if (!err) return false
  const code = err.code ?? err.details?.code
  const msg = (err.message ?? '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  )
}

function isMissingColumn(err: any, column: string): boolean {
  if (!err) return false
  const code = err.code ?? err.details?.code
  const msg = (err.message ?? '').toLowerCase()
  const col = column.toLowerCase()
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    (msg.includes(col) && msg.includes('column')) ||
    (msg.includes(col) && msg.includes('does not exist')) ||
    (msg.includes(col) && msg.includes('could not find'))
  )
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    // ── Auth ───────────────────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) console.error('[tienda/pedido] auth error:', authError)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // ── Rate limit: 20 orders/hour per user ────────────────────────────────
    if (!rateLimit(`tienda_orden:${user.id}`, 20, 60 * 60 * 1000)) {
      return rateLimitResponse(60 * 60 * 1000)
    }

    // ── Rol — drives TYPE A vs TYPE B flow ─────────────────────────────────
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles').select('rol').eq('id', user.id).maybeSingle()
    if (profileErr) console.error('[tienda/pedido] profile fetch error:', profileErr)
    const rol: string = profileRow?.rol ?? 'comprador'
    // Only comprador must pay via Stripe upfront.
    // Every other role (cliente, vendedor, admin, conductor) uses admin-approval.
    const canCreateOrdenes = rol !== 'comprador'
    console.log(`[tienda/pedido] user=${user.id} rol=${rol} canCreateOrdenes=${canCreateOrdenes}`)

    // ── Parse body ─────────────────────────────────────────────────────────
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
    }
    const { items, notas, direccion_entrega, cliente_data, tipo_pago, numero_referencia } = body ?? {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
    }
    if (items.length > 100) {
      return NextResponse.json({ error: 'Máximo 100 productos por orden' }, { status: 400 })
    }

    // Validate tipo_pago. If missing, infer from rol for backward-compat:
    //   • comprador → stripe (upfront card)
    //   • other roles → credito (admin approves manually)
    // NOTE: 'transferencia' is intentionally NOT allowed — the tienda only
    // accepts: zelle, stripe, cheque, efectivo, credito.
    const ALLOWED_PAGOS = ['zelle', 'stripe', 'credito', 'cheque', 'efectivo'] as const
    type TipoPago = typeof ALLOWED_PAGOS[number]
    let tipoPago: TipoPago
    if (typeof tipo_pago === 'string' && (ALLOWED_PAGOS as readonly string[]).includes(tipo_pago)) {
      tipoPago = tipo_pago as TipoPago
    } else {
      // Legacy clients (no selector) — infer
      tipoPago = (rol === 'comprador') ? 'stripe' : 'credito'
    }
    const referencia = typeof numero_referencia === 'string' ? numero_referencia.trim() : ''
    if (tipoPago === 'zelle' && !referencia) {
      return NextResponse.json(
        { error: 'Debes proporcionar el número de confirmación del Zelle' },
        { status: 400 }
      )
    }
    if (tipoPago === 'cheque' && !referencia) {
      return NextResponse.json(
        { error: 'Debes proporcionar el número de cheque' },
        { status: 400 }
      )
    }

    // ── Normalize optional cliente_data from shipping form ─────────────────
    // Shape: { nombre, telefono, direccion, ciudad, whatsapp, tipo_cliente }
    const cd = (cliente_data && typeof cliente_data === 'object') ? cliente_data : null
    const clienteProfilePatch: Record<string, any> = {}
    if (cd) {
      if (typeof cd.nombre === 'string'        && cd.nombre.trim())        clienteProfilePatch.nombre        = cd.nombre.trim()
      if (typeof cd.telefono === 'string'      && cd.telefono.trim())      clienteProfilePatch.telefono      = cd.telefono.trim()
      if (typeof cd.whatsapp === 'string'      && cd.whatsapp.trim())      clienteProfilePatch.whatsapp      = cd.whatsapp.trim()
      if (typeof cd.direccion === 'string'     && cd.direccion.trim())     clienteProfilePatch.direccion     = cd.direccion.trim()
      if (typeof cd.ciudad === 'string'        && cd.ciudad.trim())        clienteProfilePatch.ciudad        = cd.ciudad.trim()
      if (typeof cd.tipo_cliente === 'string'  && cd.tipo_cliente.trim())  clienteProfilePatch.tipo_cliente  = cd.tipo_cliente.trim()
    }

    // ── Resolve cliente record ─────────────────────────────────────────────
    let clienteData: { id: string } | null = null

    {
      const { data, error } = await supabase
        .from('clientes').select('id').eq('user_id', user.id).maybeSingle()
      if (error) console.error('[tienda/pedido] cliente by user_id:', error)
      if (data) clienteData = data as any
    }

    if (!clienteData && user.email) {
      const { data, error } = await supabase
        .from('clientes').select('id').eq('email', user.email).maybeSingle()
      if (error) console.error('[tienda/pedido] cliente by email:', error)
      if (data) {
        clienteData = data as any
        // Backfill user_id for future lookups (fire-and-forget)
        supabase.from('clientes')
          .update({ user_id: user.id }).eq('id', data.id).is('user_id', null)
          .then(() => null, err => console.error('[tienda/pedido] backfill user_id:', err))
      }
    }

    if (!clienteData) {
      // Auto-create a cliente row for this user, enriched with form data.
      const { data: perfil } = await supabase
        .from('profiles').select('nombre').eq('id', user.id).maybeSingle()
      const nombre =
        clienteProfilePatch.nombre ??
        perfil?.nombre ??
        user.user_metadata?.full_name ??
        user.email?.split('@')[0] ??
        'Cliente'

      const insertPayload: Record<string, any> = {
        nombre,
        email: user.email!,
        user_id: user.id,
        activo: true,
        // tipo_cliente defaults to 'persona_natural' per DB default; form data overrides.
        ...clienteProfilePatch,
      }
      insertPayload.nombre = nombre  // guarantee trimmed nombre wins

      const { data: newCliente, error: createError } = await supabase
        .from('clientes')
        .insert(insertPayload)
        .select('id')
        .single()

      if (createError || !newCliente) {
        console.error('[tienda/pedido] cliente insert failed:', createError)
        return NextResponse.json(
          { error: 'No se pudo registrar el cliente: ' + (createError?.message ?? 'error desconocido') },
          { status: 500 }
        )
      }
      clienteData = newCliente as any
    } else if (Object.keys(clienteProfilePatch).length > 0) {
      // Existing cliente: merge in any new profile fields from the form.
      // Fire-and-forget so a failure here does not block order creation.
      supabase
        .from('clientes')
        .update({ ...clienteProfilePatch, updated_at: new Date().toISOString() })
        .eq('id', clienteData.id)
        .then(() => null, err => console.error('[tienda/pedido] cliente profile update:', err))
    }

    const cliente_id = clienteData!.id
    const total = items.reduce(
      (acc: number, item: any) => acc + Number(item.precio_unitario) * Number(item.cantidad),
      0
    )

    // ── Credit check — only when client chose 'credito' ────────────────────
    if (tipoPago === 'credito') {
      const { data: cli } = await supabase
        .from('clientes')
        .select('credito_autorizado, limite_credito, credito_usado')
        .eq('id', cliente_id)
        .maybeSingle()
      if (!cli?.credito_autorizado) {
        return NextResponse.json(
          { error: 'Tu cuenta no tiene crédito autorizado. Elige otro método de pago.' },
          { status: 403 }
        )
      }
      const disponible = Number(cli.limite_credito ?? 0) - Number(cli.credito_usado ?? 0)
      if (total > disponible) {
        return NextResponse.json(
          { error: `El total ($${total.toFixed(2)}) excede tu crédito disponible ($${disponible.toFixed(2)}).` },
          { status: 400 }
        )
      }
    }

    // ── Sequence number helper ─────────────────────────────────────────────
    // Tries the get_next_sequence RPC first; if missing/fails, queries the
    // target table for the most recent `PREFIX-YYYY-NNNN` value and increments.
    const nextNumero = async (
      seqName: string,
      prefix: string,
      tableName: string,
    ): Promise<string> => {
      const { data, error } = await supabase.rpc('get_next_sequence', { seq_name: seqName })
      if (!error && typeof data === 'string' && data.length > 0) {
        return data
      }
      if (error) {
        console.warn(`[tienda/pedido] get_next_sequence('${seqName}') failed:`, error.message)
      }

      // Fallback: scan the table for the last numero of the current year.
      const year = new Date().getFullYear()
      const { data: last, error: scanErr } = await supabase
        .from(tableName)
        .select('numero')
        .like('numero', `${prefix}-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (scanErr && !isMissingRelation(scanErr)) {
        console.warn(`[tienda/pedido] nextNumero scan('${tableName}') failed:`, scanErr.message)
      }
      const parts = last?.numero ? String(last.numero).split('-') : []
      const lastNum = parts.length === 3 ? parseInt(parts[2], 10) || 0 : 0
      return `${prefix}-${year}-${String(lastNum + 1).padStart(4, '0')}`
    }

    // ══════════════════════════════════════════════════════════════════════
    // PATH A — create ORDEN (preferred)
    // ══════════════════════════════════════════════════════════════════════
    const ordenNumero = await nextNumero('ordenes', 'ORD', 'ordenes')

    const { data: orden, error: ordenInsertErr } = await supabase
      .from('ordenes')
      .insert({
        numero: ordenNumero,
        cliente_id,
        user_id: user.id,
        estado: 'pendiente',
        notas: notas?.trim() || null,
        direccion_entrega: direccion_entrega?.trim() || null,
        total,
        tipo_pago: tipoPago,
        numero_referencia:
          (tipoPago === 'zelle' || tipoPago === 'cheque') && referencia
            ? referencia
            : null,
      })
      .select()
      .single()

    if (ordenInsertErr) {
      if (!isMissingRelation(ordenInsertErr)) {
        console.error('[tienda/pedido] ordenes insert error:', ordenInsertErr)
        return NextResponse.json(
          { error: 'Error al crear la orden: ' + (ordenInsertErr.message ?? 'error desconocido') },
          { status: 500 }
        )
      }
      // ordenes table doesn't exist yet — fall through to PATH B
      console.warn('[tienda/pedido] ordenes table missing — falling back to pedidos')
    } else {
      // Orden created — now insert items.
      // Schema uses `precio_unitario`; retry with legacy `precio` column if needed.
      const buildItems = (col: 'precio_unitario' | 'precio') =>
        items.map((item: any) => ({
          orden_id: orden.id,
          presentacion_id: item.presentacion_id,
          cantidad: Number(item.cantidad),
          [col]: Number(item.precio_unitario),
          subtotal: Number(item.precio_unitario) * Number(item.cantidad),
        }))

      let { error: itemsInsertErr } = await supabase
        .from('orden_items')
        .insert(buildItems('precio_unitario'))

      if (itemsInsertErr && isMissingColumn(itemsInsertErr, 'precio_unitario')) {
        console.warn('[tienda/pedido] orden_items.precio_unitario missing — retrying with `precio`')
        const retry = await supabase.from('orden_items').insert(buildItems('precio'))
        itemsInsertErr = retry.error
      }

      if (itemsInsertErr) {
        // Roll back the orphaned orden
        await supabase.from('ordenes').delete().eq('id', orden.id)

        if (!isMissingRelation(itemsInsertErr)) {
          console.error('[tienda/pedido] orden_items insert error:', itemsInsertErr)
          return NextResponse.json(
            { error: 'Error al guardar los productos: ' + (itemsInsertErr.message ?? 'error desconocido') },
            { status: 500 }
          )
        }
        // orden_items table doesn't exist yet — fall through to PATH B
        console.warn('[tienda/pedido] orden_items table missing — falling back to pedidos')
      } else {
        // ── Items saved. Branch on tipo_pago. ────────────────────────────
        // credito: consume the credit line (fire-and-forget RPC) and return.
        if (tipoPago === 'credito') {
          supabase.rpc('usar_credito', { p_cliente_id: cliente_id, p_monto: total })
            .then(() => null, err => console.error('[tienda/pedido] usar_credito:', err))
          console.log(`[tienda/pedido] orden ${orden.numero} created — credito`)
          return NextResponse.json(
            {
              success: true,
              tipo: 'orden',
              numero: orden.numero,
              orden_id: orden.id,
              tipo_pago: tipoPago,
            },
            { status: 201 }
          )
        }

        // zelle / cheque / efectivo: admin confirms payment manually later.
        if (tipoPago === 'zelle' || tipoPago === 'cheque' || tipoPago === 'efectivo') {
          console.log(`[tienda/pedido] orden ${orden.numero} created — ${tipoPago} (pending manual confirmation)`)
          return NextResponse.json(
            {
              success: true,
              tipo: 'orden',
              numero: orden.numero,
              orden_id: orden.id,
              tipo_pago: tipoPago,
              numero_referencia:
                (tipoPago === 'zelle' || tipoPago === 'cheque') && referencia
                  ? referencia
                  : null,
            },
            { status: 201 }
          )
        }

        // stripe: create checkout session and return the URL.
        if (!process.env.STRIPE_SECRET_KEY) {
          console.error('[tienda/pedido] STRIPE_SECRET_KEY missing')
          await supabase.from('orden_items').delete().eq('orden_id', orden.id)
          await supabase.from('ordenes').delete().eq('id', orden.id)
          return NextResponse.json(
            { error: 'Pago con tarjeta no configurado. Contacta al administrador.' },
            { status: 503 }
          )
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
        let stripeSession: Stripe.Checkout.Session | null = null
        let stripeError: string | null = null

        try {
          const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((it: any) => ({
            price_data: {
              currency: 'usd',
              product_data: {
                name: it.productoNombre
                  ? `${it.productoNombre}${it.presentacionNombre ? ` — ${it.presentacionNombre}` : ''}`
                  : (it.presentacionNombre ?? 'Producto'),
                description: it.presentacionNombre ?? undefined,
              },
              unit_amount: Math.round(Number(it.precio_unitario) * 100),
            },
            quantity: Number(it.cantidad),
          }))

          stripeSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            success_url: `${siteUrl}/tienda/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteUrl}/tienda/checkout/cancel`,
            customer_email: user.email ?? undefined,
            metadata: {
              orden_id: orden.id,
              orden_numero: orden.numero,
              cliente_id,
              user_id: user.id,
              user_email: user.email ?? '',
            },
          })
        } catch (stripeErr: any) {
          stripeError = stripeErr?.message ?? 'Error al crear sesión de pago'
          console.error('[tienda/pedido] stripe session create failed:', stripeErr)
        }

        if (stripeSession?.url) {
          console.log(`[tienda/pedido] stripe session created for orden ${orden.numero}`)
          return NextResponse.json(
            {
              success: true,
              tipo: 'pago',
              url: stripeSession.url,
              numero: orden.numero,
              orden_id: orden.id,
              tipo_pago: 'stripe',
            },
            { status: 201 }
          )
        }

        // Stripe failed or returned no URL — leave the orden in place so admin
        // can approve it manually, and tell the user what happened.
        console.error(`[tienda/pedido] stripe session has no URL. error=${stripeError}`)
        return NextResponse.json(
          {
            error: stripeError
              ? `No se pudo iniciar el pago: ${stripeError}`
              : 'No se pudo iniciar el pago. Intenta de nuevo.',
          },
          { status: 502 }
        )
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // PATH B — legacy fallback: create PEDIDO directly
    // Reached only when ordenes or orden_items table is missing.
    // ══════════════════════════════════════════════════════════════════════
    console.log('[tienda/pedido] PATH B: creating pedido directly')
    const pedidoNumero = await nextNumero('pedidos', 'PED', 'pedidos')

    const { data: pedido, error: pedidoInsertErr } = await supabase
      .from('pedidos')
      .insert({
        numero: pedidoNumero,
        cliente_id,
        vendedor_id: null,
        estado: 'borrador',
        tipo_pago: tipoPago,
        subtotal: total,
        descuento: 0,
        impuesto: 0,
        total,
        notas: notas?.trim() || null,
        direccion_entrega: direccion_entrega?.trim() || null,
      })
      .select()
      .single()

    if (pedidoInsertErr || !pedido) {
      console.error('[tienda/pedido] pedido insert failed:', pedidoInsertErr)
      return NextResponse.json(
        { error: 'Error al crear el pedido: ' + (pedidoInsertErr?.message ?? 'error desconocido') },
        { status: 500 }
      )
    }

    const pedidoItems = items.map((item: any) => ({
      pedido_id: pedido.id,
      presentacion_id: item.presentacion_id,
      cantidad: Number(item.cantidad),
      precio_unitario: Number(item.precio_unitario),
      descuento: 0,
      subtotal: Number(item.precio_unitario) * Number(item.cantidad),
    }))

    const { error: pedidoItemsErr } = await supabase.from('pedido_items').insert(pedidoItems)
    if (pedidoItemsErr) {
      console.error('[tienda/pedido] pedido_items insert failed:', pedidoItemsErr)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      return NextResponse.json(
        { error: 'Error al guardar los productos: ' + (pedidoItemsErr.message ?? 'error desconocido') },
        { status: 500 }
      )
    }

    console.log(`[tienda/pedido] PATH B pedido ${pedido.numero} created`)
    return NextResponse.json(
      { success: true, tipo: 'orden', numero: pedido.numero, orden_id: pedido.id },
      { status: 201 }
    )

  } catch (err: any) {
    // Safety net — catches any unexpected throw inside the handler
    console.error('[tienda/pedido] unhandled exception:', err)
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (err?.message ?? String(err)) },
      { status: 500 }
    )
  }
}
