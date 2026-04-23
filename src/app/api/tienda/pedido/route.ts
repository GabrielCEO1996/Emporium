import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rateLimit, rateLimitResponse } from '@/lib/security'

// ─── POST /api/tienda/pedido ────────────────────────────────────────────────
// Single entrypoint for the tienda cart.
//
// Always creates an ORDEN (estado='pendiente'), then branches on profiles.rol:
//   • rol = 'cliente'    → orden stays pendiente, admin approves manually
//       Response: { tipo: 'orden', numero, orden_id }
//
//   • rol = 'comprador'  → creates a Stripe checkout session with
//       `orden_id` in the metadata. The Stripe webhook converts the orden
//       into pedido + factura(pagada) + transaccion(ingreso) on payment.
//       Response: { tipo: 'pago', url, numero, orden_id }
//
// If the `ordenes` table is not yet present (migration pending), transparently
// falls back to creating a PEDIDO directly so checkout never breaks.
//
// ALWAYS returns a JSON response within the request; the outer try/catch
// guarantees no hanging requests.
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

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) console.error('[tienda/pedido] auth error:', authError)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Rate limit: 20 submissions per hour per user
    if (!rateLimit(`tienda_orden:${user.id}`, 20, 60 * 60 * 1000)) {
      return rateLimitResponse(60 * 60 * 1000)
    }

    // Resolve rol — drives the entire flow branch later.
    const { data: profileRow } = await supabase
      .from('profiles').select('rol').eq('id', user.id).maybeSingle()
    const rol: string = profileRow?.rol ?? 'comprador'
    const canCreateOrdenes = rol === 'cliente'

    // Parse body safely
    let body: any
    try {
      body = await req.json()
    } catch (parseErr) {
      console.error('[tienda/pedido] invalid JSON body:', parseErr)
      return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
    }

    const { items, notas, direccion_entrega } = body ?? {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
    }
    if (items.length > 100) {
      return NextResponse.json({ error: 'Máximo 100 productos por orden' }, { status: 400 })
    }

    // ── Resolve cliente (includes credito_autorizado for branching) ───────
    let clienteData:
      | { id: string; credito_autorizado: boolean | null }
      | null = null

    {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, credito_autorizado')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) console.error('[tienda/pedido] cliente by user_id:', error)
      if (data) clienteData = data as any
    }

    if (!clienteData && user.email) {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, credito_autorizado')
        .eq('email', user.email)
        .maybeSingle()
      if (error) console.error('[tienda/pedido] cliente by email:', error)
      if (data) {
        clienteData = data as any
        await supabase
          .from('clientes')
          .update({ user_id: user.id })
          .eq('id', data.id)
          .is('user_id', null)
          .then(() => null, err =>
            console.error('[tienda/pedido] backfill user_id:', err)
          )
      }
    }

    if (!clienteData) {
      const { data: perfil } = await supabase
        .from('profiles').select('nombre').eq('id', user.id).maybeSingle()
      const nombre =
        perfil?.nombre ??
        user.user_metadata?.full_name ??
        user.email?.split('@')[0] ??
        'Cliente'

      const { data: newCliente, error: createError } = await supabase
        .from('clientes')
        .insert({
          nombre,
          email: user.email!,
          user_id: user.id,
          activo: true,
          // credito_autorizado defaults to false — direct-pay client
        })
        .select('id, credito_autorizado')
        .single()

      if (createError || !newCliente) {
        console.error('[tienda/pedido] cliente insert failed:', createError)
        return NextResponse.json(
          { error: 'No se pudo crear el registro de cliente: ' + (createError?.message ?? '') },
          { status: 500 }
        )
      }
      clienteData = newCliente as any
    }

    const cliente_id = clienteData!.id

    const total = items.reduce(
      (acc: number, item: any) => acc + Number(item.precio_unitario) * Number(item.cantidad),
      0
    )

    // ── Sequence helper ───────────────────────────────────────────────────
    const nextNumero = async (seqName: string, prefix: string): Promise<string> => {
      const { data, error } = await supabase.rpc('get_next_sequence', { seq_name: seqName })
      if (error || !data) {
        console.warn(`[tienda/pedido] get_next_sequence('${seqName}') fallback:`, error?.message ?? 'no data')
        return `${prefix}-${Date.now()}`
      }
      return data as string
    }

    // ════════════════════════════════════════════════════════════════════════
    // Path A: create an ORDEN (preferred path)
    // ════════════════════════════════════════════════════════════════════════
    const ordenNumero = await nextNumero('ordenes', 'ORD')

    const { data: orden, error: ordenError } = await supabase
      .from('ordenes')
      .insert({
        numero: ordenNumero,
        cliente_id,
        user_id: user.id,
        estado: 'pendiente',
        notas: notas?.trim() || null,
        direccion_entrega: direccion_entrega?.trim() || null,
        total,
      })
      .select()
      .single()

    if (!ordenError && orden) {
      const ordenItems = items.map((item: any) => ({
        orden_id: orden.id,
        presentacion_id: item.presentacion_id,
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        subtotal: Number(item.precio_unitario) * Number(item.cantidad),
      }))

      const { error: itemsError } = await supabase.from('orden_items').insert(ordenItems)
      if (itemsError) {
        console.error('[tienda/pedido] orden_items insert failed:', itemsError)
        await supabase.from('ordenes').delete().eq('id', orden.id)

        if (!isMissingRelation(itemsError)) {
          return NextResponse.json(
            { error: itemsError.message ?? 'Error al guardar los productos' },
            { status: 500 }
          )
        }
        console.warn('[tienda/pedido] orden_items missing — fallback to pedidos')
      } else {
        // ── Branch on rol ─────────────────────────────────────────────
        if (canCreateOrdenes) {
          // TYPE A — rol='cliente': admin approval flow, no payment upfront
          return NextResponse.json(
            {
              success: true,
              tipo: 'orden',
              numero: orden.numero,
              orden_id: orden.id,
            },
            { status: 201 }
          )
        }

        // TYPE B — rol='comprador': Stripe checkout (required)
        if (!process.env.STRIPE_SECRET_KEY) {
          console.error('[tienda/pedido] STRIPE_SECRET_KEY missing')
          // Roll back the orden so the client can retry later
          await supabase.from('orden_items').delete().eq('orden_id', orden.id)
          await supabase.from('ordenes').delete().eq('id', orden.id)
          return NextResponse.json(
            { error: 'Pago con tarjeta no configurado. Contacta al administrador.' },
            { status: 503 }
          )
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
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

          const session = await stripe.checkout.sessions.create({
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

          return NextResponse.json(
            {
              success: true,
              tipo: 'pago',
              url: session.url,
              numero: orden.numero,
              orden_id: orden.id,
            },
            { status: 201 }
          )
        } catch (stripeErr: any) {
          console.error('[tienda/pedido] stripe session create failed:', stripeErr)
          // Leave the orden in place — admin can still approve it manually
          // and the user can be told it went through as a manual-approval orden.
          return NextResponse.json(
            {
              error: 'No se pudo iniciar el pago. Intenta de nuevo.',
              stripe_error: stripeErr?.message,
            },
            { status: 502 }
          )
        }
      }
    } else if (ordenError && !isMissingRelation(ordenError)) {
      console.error('[tienda/pedido] ordenes insert failed:', ordenError)
      return NextResponse.json(
        { error: ordenError.message ?? 'Error al crear la orden' },
        { status: 500 }
      )
    } else if (ordenError) {
      console.warn('[tienda/pedido] ordenes table missing — fallback to pedidos')
    }

    // ════════════════════════════════════════════════════════════════════════
    // Path B: legacy fallback — create a PEDIDO directly
    // (only reached when the ordenes migration has not been applied)
    // ════════════════════════════════════════════════════════════════════════
    const pedidoNumero = await nextNumero('pedidos', 'PED')

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        numero: pedidoNumero,
        cliente_id,
        vendedor_id: null,
        estado: 'borrador',
        tipo_pago: canCreateOrdenes ? 'credito' : 'pendiente',
        subtotal: total,
        descuento: 0,
        impuesto: 0,
        total,
        notas: notas?.trim() || null,
        direccion_entrega: direccion_entrega?.trim() || null,
      })
      .select()
      .single()

    if (pedidoError || !pedido) {
      console.error('[tienda/pedido] pedido insert failed:', pedidoError)
      return NextResponse.json(
        { error: pedidoError?.message ?? 'Error al crear el pedido' },
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

    const { error: pedidoItemsError } = await supabase.from('pedido_items').insert(pedidoItems)
    if (pedidoItemsError) {
      console.error('[tienda/pedido] pedido_items insert failed:', pedidoItemsError)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      return NextResponse.json(
        { error: pedidoItemsError.message ?? 'Error al guardar los productos' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        tipo: 'orden',       // UI treats it the same as an orden for messaging
        numero: pedido.numero,
        pedido_id: pedido.id,
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('[tienda/pedido] unhandled exception:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
