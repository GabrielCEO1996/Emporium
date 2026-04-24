import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rateLimit, rateLimitResponse, logActivity } from '@/lib/security'
import { isStripeConfigured } from '@/lib/stripe'

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

    // ── Rol — drives method restrictions + per-rol rate limit ──────────────
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles').select('rol').eq('id', user.id).maybeSingle()
    if (profileErr) console.error('[tienda/pedido] profile fetch error:', profileErr)
    const rol: string = profileRow?.rol ?? 'comprador'

    // Rate limit: comprador = 3 orders/hour (anti-fraud on guest-style checkout),
    // authorized roles keep the generous 20/hour allowance.
    const rateMax = rol === 'comprador' ? 3 : 20
    if (!rateLimit(`tienda_orden:${user.id}`, rateMax, 60 * 60 * 1000)) {
      return rateLimitResponse(60 * 60 * 1000)
    }
    console.log(`[tienda/pedido] user=${user.id} rol=${rol} rateMax=${rateMax}`)

    // ── Parse body ─────────────────────────────────────────────────────────
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
    }
    const {
      items,
      notas,
      direccion_entrega,
      cliente_data,
      tipo_pago,
      numero_referencia,
      payment_proof_url,
    } = body ?? {}
    // NOTE: Stripe verification happens at /api/webhook/stripe on
    // `checkout.session.completed` — the signed payload tells us the intent
    // succeeded. We intentionally don't accept a payment_intent_id from the
    // client here (trusting client-supplied IDs would let a caller forge
    // "paid" orders).

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

    // ── ROL-BASED METHOD RESTRICTIONS (SECURITY) ───────────────────────────
    // comprador can ONLY pay with: stripe, zelle, cheque.
    //   - efectivo / tarjeta (in-person) are admin/vendedor-only in-store sales.
    //   - credito requires authorized cliente account.
    // cliente (authorized) can use anything except in-person efectivo.
    // admin / vendedor can use anything (they're on-site).
    const COMPRADOR_ALLOWED = ['stripe', 'zelle', 'cheque'] as const
    if (rol === 'comprador' && !(COMPRADOR_ALLOWED as readonly string[]).includes(tipoPago)) {
      logActivity(supabase, {
        userId: user.id,
        action: 'security_violation_payment_method',
        resource: 'ordenes',
        details: {
          rol,
          attempted_tipo_pago: tipoPago,
          allowed: COMPRADOR_ALLOWED,
          reason: 'comprador_cannot_use_in_person_methods',
        },
      })
      return NextResponse.json(
        {
          error: 'Ese método de pago no está disponible en la tienda en línea. ' +
                 'Efectivo y tarjeta presencial solo aplican para ventas en tienda.',
        },
        { status: 403 }
      )
    }
    if (rol === 'cliente' && tipoPago === 'efectivo') {
      logActivity(supabase, {
        userId: user.id,
        action: 'security_violation_payment_method',
        resource: 'ordenes',
        details: { rol, attempted_tipo_pago: tipoPago, reason: 'cliente_cannot_use_cash_online' },
      })
      return NextResponse.json(
        { error: 'El pago en efectivo solo aplica para ventas en tienda.' },
        { status: 403 }
      )
    }

    // Guard: if stripe not configured, reject early instead of creating a
    // phantom orden that will never get a checkout URL.
    if (tipoPago === 'stripe' && !isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Pago con tarjeta no configurado. Contacta al administrador.' },
        { status: 503 }
      )
    }

    const referencia = typeof numero_referencia === 'string' ? numero_referencia.trim() : ''
    const proofUrl = typeof payment_proof_url === 'string' ? payment_proof_url.trim() : ''

    // Zelle / Cheque rules (enforced for comprador; cliente+ can be laxer as
    // admin manually verifies before releasing the pedido).
    if (tipoPago === 'zelle') {
      if (!referencia) {
        return NextResponse.json(
          { error: 'Debes proporcionar el número de confirmación del Zelle' },
          { status: 400 }
        )
      }
      if (rol === 'comprador' && referencia.length < 6) {
        return NextResponse.json(
          { error: 'El número de confirmación del Zelle debe tener al menos 6 caracteres' },
          { status: 400 }
        )
      }
      if (rol === 'comprador' && !proofUrl) {
        return NextResponse.json(
          { error: 'Debes adjuntar una captura de pantalla del pago Zelle' },
          { status: 400 }
        )
      }
    }
    if (tipoPago === 'cheque') {
      if (!referencia) {
        return NextResponse.json(
          { error: 'Debes proporcionar el número de cheque' },
          { status: 400 }
        )
      }
      if (rol === 'comprador' && !/^\d{3,}$/.test(referencia)) {
        return NextResponse.json(
          { error: 'El número de cheque debe ser numérico (3+ dígitos)' },
          { status: 400 }
        )
      }
      if (rol === 'comprador' && !proofUrl) {
        return NextResponse.json(
          { error: 'Debes adjuntar una foto del frente del cheque' },
          { status: 400 }
        )
      }
    }
    // Proof URL sanity: must be a Supabase storage public URL we control.
    if (proofUrl) {
      const validProofPrefix = proofUrl.includes('/storage/v1/object/public/payment-proofs/')
      if (!validProofPrefix) {
        return NextResponse.json(
          { error: 'El comprobante adjunto no es válido' },
          { status: 400 }
        )
      }
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

    // Build the insert payload. payment_proof_url + payment_reference are new
    // columns (see supabase/payment_proofs.sql). If the user runs the code
    // before applying the migration we silently retry without them.
    const buildOrdenPayload = (includeProofCols: boolean) => {
      const base: Record<string, any> = {
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
      }
      if (includeProofCols) {
        base.payment_proof_url = proofUrl || null
        base.payment_reference = referencia || null
      }
      return base
    }

    let { data: orden, error: ordenInsertErr } = await supabase
      .from('ordenes')
      .insert(buildOrdenPayload(true))
      .select()
      .single()

    if (ordenInsertErr && (
      isMissingColumn(ordenInsertErr, 'payment_proof_url') ||
      isMissingColumn(ordenInsertErr, 'payment_reference')
    )) {
      console.warn('[tienda/pedido] ordenes.payment_proof_url missing — retrying without it')
      const retry = await supabase
        .from('ordenes')
        .insert(buildOrdenPayload(false))
        .select()
        .single()
      orden = retry.data
      ordenInsertErr = retry.error
    }

    if (ordenInsertErr || !orden) {
      if (ordenInsertErr && !isMissingRelation(ordenInsertErr)) {
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
      const ordenId: string = orden.id
      const buildItems = (col: 'precio_unitario' | 'precio') =>
        items.map((item: any) => ({
          orden_id: ordenId,
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
        // ── Items saved. Fire activity log + email (fire-and-forget). ────
        const ordenForHook = orden  // narrow for TS inside closure

        const fireSideEffects = () => {
          // 1. activity_logs — audit trail
          logActivity(supabase, {
            userId: user.id,
            action: 'orden_creada',
            resource: 'ordenes',
            resourceId: ordenForHook.id,
            details: {
              rol,
              tipo_pago: tipoPago,
              total,
              numero: ordenForHook.numero,
              has_proof: Boolean(proofUrl),
              numero_referencia: referencia || null,
            },
          })
          // 2. Email notification — never blocks the main response
          const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
          if (siteOrigin) {
            fetch(`${siteOrigin}/api/email/nueva-orden`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orden_id: ordenForHook.id }),
            }).catch(err => console.error('[tienda/pedido] email trigger failed (non-fatal):', err))
          }
        }

        // ── Branch on tipo_pago. ─────────────────────────────────────────
        // credito: consume the credit line (fire-and-forget RPC) and return.
        if (tipoPago === 'credito') {
          supabase.rpc('usar_credito', { p_cliente_id: cliente_id, p_monto: total })
            .then(() => null, err => console.error('[tienda/pedido] usar_credito:', err))
          console.log(`[tienda/pedido] orden ${orden.numero} created — credito`)
          fireSideEffects()
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
          fireSideEffects()
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
          // Log creation now; email will also fire from the Stripe webhook on
          // successful payment (double-entry is fine — admin sees both events).
          fireSideEffects()
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
