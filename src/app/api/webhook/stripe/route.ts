import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2025-03-31.basil',
})

// Stripe requires the raw body for signature verification
export const runtime = 'nodejs'

// ─── POST /api/webhook/stripe ───────────────────────────────────────────────
// On `checkout.session.completed` with orden_id in metadata:
//   1. Creates a PEDIDO (estado='aprobada') linked to the orden
//   2. Copies orden_items → pedido_items
//   3. Creates a FACTURA (estado='pagada') with factura_items
//   4. Logs an ingreso TRANSACCION
//   5. Marks the orden as 'aprobada'
// All post-orden steps are isolated in try/catches so a partial failure still
// returns 200 to Stripe (prevents retry storms) but logs loudly for ops.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhook/stripe] STRIPE_WEBHOOK_SECRET missing')
    return NextResponse.json({ error: 'Webhook secret no configurado' }, { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Sin firma' }, { status: 400 })

  const rawBody = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err: any) {
    console.error('[webhook/stripe] signature error:', err.message)
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
    } else if (event.type === 'checkout.session.expired') {
      console.log('[webhook/stripe] session expired:', (event.data.object as any).id)
    } else if (event.type === 'payment_intent.payment_failed') {
      console.log('[webhook/stripe] payment failed:', (event.data.object as any).id)
    }
  } catch (err: any) {
    console.error('[webhook/stripe] handler threw:', err)
    // Return 200 anyway — we've logged it, don't trigger Stripe retry storms
  }

  return NextResponse.json({ received: true })
}

// ─── checkout.session.completed handler ─────────────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createClient()
  const meta = session.metadata ?? {}
  const ordenId = meta.orden_id as string | undefined

  // ── Preferred flow: new orden-based path ────────────────────────────────
  if (ordenId) {
    console.log('[webhook/stripe] processing orden', ordenId, 'for session', session.id)

    // Load orden + items
    const { data: orden, error: ordenErr } = await supabase
      .from('ordenes')
      .select(`
        id, numero, estado, cliente_id, user_id, notas, direccion_entrega, total,
        items:orden_items(id, presentacion_id, cantidad, precio_unitario, subtotal)
      `)
      .eq('id', ordenId)
      .single()

    if (ordenErr || !orden) {
      console.error('[webhook/stripe] orden not found:', ordenId, ordenErr)
      return
    }

    // Idempotency: if orden is already aprobada, this webhook already ran
    if (orden.estado === 'aprobada') {
      console.log('[webhook/stripe] orden', orden.numero, 'already aprobada, skipping')
      return
    }

    const items = (orden.items ?? []) as Array<{
      presentacion_id: string
      cantidad: number
      precio_unitario: number
      subtotal: number
    }>
    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0)

    // ── 1. Create PEDIDO (estado='aprobada') ────────────────────────────
    const { data: pedidoNumData } = await supabase
      .rpc('get_next_sequence', { seq_name: 'pedidos' })
    const pedidoNumero = (pedidoNumData as string) ?? `PED-${Date.now()}`

    const { data: pedido, error: pedidoErr } = await supabase
      .from('pedidos')
      .insert({
        numero: pedidoNumero,
        cliente_id: orden.cliente_id,
        vendedor_id: null,
        estado: 'aprobada',
        tipo_pago: 'stripe',
        subtotal,
        descuento: 0,
        impuesto: 0,
        total: orden.total ?? subtotal,
        notas: orden.notas ?? `Pagado vía Stripe. Session: ${session.id}`,
        direccion_entrega: orden.direccion_entrega ?? null,
        orden_id: orden.id,
      })
      .select()
      .single()

    if (pedidoErr || !pedido) {
      console.error('[webhook/stripe] pedido insert failed:', pedidoErr)
      return
    }

    // Copy items to pedido_items
    if (items.length > 0) {
      const pedidoItems = items.map(i => ({
        pedido_id: pedido.id,
        presentacion_id: i.presentacion_id,
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario),
        descuento: 0,
        subtotal: Number(i.subtotal),
      }))
      const { error: piErr } = await supabase.from('pedido_items').insert(pedidoItems)
      if (piErr) console.error('[webhook/stripe] pedido_items insert failed:', piErr)
    }

    // ── 2. Create FACTURA (estado='pagada') ─────────────────────────────
    try {
      const { data: facNumData } = await supabase
        .rpc('get_next_sequence', { seq_name: 'facturas' })
      const facturaNumero = (facNumData as string) ?? `FAC-${Date.now()}`

      const { data: factura, error: facErr } = await supabase
        .from('facturas')
        .insert({
          numero: facturaNumero,
          pedido_id: pedido.id,
          cliente_id: orden.cliente_id,
          vendedor_id: null,
          estado: 'pagada',
          subtotal,
          descuento: 0,
          base_imponible: subtotal,
          tasa_impuesto: 0,
          impuesto: 0,
          total: orden.total ?? subtotal,
          monto_pagado: orden.total ?? subtotal,
          notas: `Pagado vía Stripe. Session: ${session.id}`,
        })
        .select()
        .single()

      if (facErr) {
        console.error('[webhook/stripe] factura insert failed (non-fatal):', facErr)
      } else if (factura && items.length > 0) {
        // Enrich factura_items with descripcion pulled from productos
        const presentacionIds = Array.from(new Set(items.map(i => i.presentacion_id)))
        const { data: presData } = await supabase
          .from('presentaciones')
          .select('id, nombre, producto:productos(nombre)')
          .in('id', presentacionIds)

        const descMap = new Map<string, string>()
        for (const p of (presData ?? []) as any[]) {
          const prodNombre = p.producto?.nombre ?? ''
          descMap.set(p.id, [prodNombre, p.nombre].filter(Boolean).join(' — ') || 'Producto')
        }

        const facturaItems = items.map(i => ({
          factura_id: factura.id,
          presentacion_id: i.presentacion_id,
          descripcion: descMap.get(i.presentacion_id) ?? 'Producto',
          cantidad: Number(i.cantidad),
          precio_unitario: Number(i.precio_unitario),
          descuento: 0,
          subtotal: Number(i.subtotal),
        }))
        const { error: fiErr } = await supabase.from('factura_items').insert(facturaItems)
        if (fiErr) console.error('[webhook/stripe] factura_items insert failed:', fiErr)
      }

      // ── 3. Log INGRESO transaccion (non-fatal) ────────────────────────
      if (factura) {
        const { error: txErr } = await supabase.from('transacciones').insert({
          tipo: 'ingreso',
          monto: orden.total ?? subtotal,
          fecha: new Date().toISOString().split('T')[0],
          concepto: `Factura ${factura.numero} pagada vía Stripe`,
          referencia_tipo: 'factura',
          referencia_id: factura.id,
          usuario_id: null,
        })
        if (txErr) console.error('[webhook/stripe] transaccion insert failed (non-fatal):', txErr)
      }
    } catch (facOuter) {
      console.error('[webhook/stripe] factura/transaccion threw (non-fatal):', facOuter)
    }

    // ── 4. Mark orden as aprobada ───────────────────────────────────────
    const { error: ordenUpdErr } = await supabase
      .from('ordenes')
      .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
      .eq('id', orden.id)
    if (ordenUpdErr) {
      console.error('[webhook/stripe] orden update failed:', ordenUpdErr)
    }

    console.log('[webhook/stripe] orden', orden.numero, '→ pedido', pedido.numero, 'paid')
    return
  }

  // ── Legacy fallback: pre-orden Stripe sessions (items in metadata) ──────
  const legacyItems = JSON.parse(meta.items ?? '[]') as any[]
  if (legacyItems.length === 0) {
    console.warn('[webhook/stripe] session with no orden_id and no legacy items — nothing to do')
    return
  }

  const { data: clienteData } = await supabase
    .from('clientes')
    .select('id')
    .eq('email', meta.user_email ?? '')
    .maybeSingle()

  const { data: numData } = await supabase.rpc('get_next_sequence', { seq_name: 'pedidos' })
  const subtotal = legacyItems.reduce(
    (acc: number, item: any) => acc + Number(item.precio) * Number(item.cantidad),
    0
  )

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .insert({
      numero: numData,
      cliente_id: clienteData?.id ?? null,
      estado: 'aprobada',
      tipo_pago: 'stripe',
      subtotal,
      descuento: 0,
      impuesto: 0,
      total: subtotal,
      notas: meta.notas || `Pagado vía Stripe. Session: ${session.id}`,
      direccion_entrega: meta.direccion_entrega || null,
    })
    .select()
    .single()

  if (pedidoError) {
    console.error('[webhook/stripe] legacy pedido insert failed:', pedidoError)
    return
  }

  if (pedido) {
    const pedidoItems = legacyItems.map((item: any) => ({
      pedido_id: pedido.id,
      presentacion_id: item.presentacion_id,
      cantidad: Number(item.cantidad),
      precio_unitario: Number(item.precio),
      descuento: 0,
      subtotal: Number(item.precio) * Number(item.cantidad),
    }))
    await supabase.from('pedido_items').insert(pedidoItems)
  }
}
