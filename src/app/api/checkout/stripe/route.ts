import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rateLimit, rateLimitResponse, logActivity } from '@/lib/security'
import { isStripeConfigured } from '@/lib/stripe'
import { reserveOrdenStock, rollbackOrdenStock } from '@/lib/orden-stock'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2025-08-27.basil',
})

// ─── POST /api/checkout/stripe ─────────────────────────────────────────────
// "Comprar ahora" → "Tarjeta". Pago directo con Stripe Checkout Session.
//
// GARANTÍA NO-NEGOCIABLE:
//   Este endpoint NUNCA crea pedido directo. Solo crea:
//     1. Una orden temporal en estado='pendiente' + estado_pago=
//        'pendiente_verificacion' + tipo_pago='stripe'
//     2. Una Stripe Checkout Session con orden_id en metadata
//   El pedido se crea ÚNICAMENTE cuando el webhook /api/webhook/stripe
//   recibe checkout.session.completed con la firma válida de Stripe.
//   No hay path alternativo. No hay short-circuit.
//
// Inventario:
//   Reservamos stock_reservado en presentaciones al crear la orden.
//   Si la session se completa → webhook crea pedido + libera reserva
//                              (el pedido toma over con FEFO).
//   Si la session expira     → webhook expired libera reserva, orden
//                              pasa a 'cancelada'.
//   Si Stripe falla al crear session → rollback orden + liberar reserva.
//
// Roles permitidos:
//   • cliente   — eligió "Comprar ahora" en lugar de "Generar orden"
//   • comprador — único método disponible para B2C
//
// Body:
//   {
//     items: Array<{ presentacion_id, cantidad, precio_unitario,
//                    productoNombre?, presentacionNombre? }>,
//     notas?: string,
//     direccion_entrega?: string,
//     cliente_data?: { nombre, telefono, direccion, ciudad, whatsapp,
//                      tipo_cliente }
//   }
//
// Response 201:
//   { success: true, tipo: 'pago', url, orden_id, numero }
// ───────────────────────────────────────────────────────────────────────────

interface InboundItem {
  presentacion_id: string
  cantidad: number
  precio_unitario: number
  productoNombre?: string
  presentacionNombre?: string
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    // ── Auth ───────────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).maybeSingle()
    const rol = profile?.rol ?? 'comprador'

    // Cliente y comprador pueden pagar con Stripe; admin/vendedor usan
    // venta directa.
    if (rol !== 'cliente' && rol !== 'comprador') {
      return NextResponse.json({
        error: 'Tu rol no permite checkout online. Usá venta directa desde el panel.',
      }, { status: 403 })
    }

    // ── Stripe ready? ──────────────────────────────────────────────────────
    if (!isStripeConfigured()) {
      return NextResponse.json({
        error: 'Pago con tarjeta no configurado. Contactá al administrador.',
      }, { status: 503 })
    }

    // ── Rate limit ─────────────────────────────────────────────────────────
    const rateMax = rol === 'comprador' ? 5 : 15
    if (!rateLimit(`checkout_stripe:${user.id}`, rateMax, 60 * 60 * 1000)) {
      return rateLimitResponse(60 * 60 * 1000)
    }

    // ── Parse + sanitize body ──────────────────────────────────────────────
    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
    }
    const { items, notas, direccion_entrega, cliente_data } = body ?? {}
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
    }
    if (items.length > 100) {
      return NextResponse.json({ error: 'Máximo 100 productos' }, { status: 400 })
    }

    const sanitized: InboundItem[] = items.map((it: any) => ({
      presentacion_id: String(it.presentacion_id ?? ''),
      cantidad:        Number(it.cantidad ?? 0),
      precio_unitario: Number(it.precio_unitario ?? 0),
      productoNombre:    typeof it.productoNombre === 'string' ? it.productoNombre : undefined,
      presentacionNombre: typeof it.presentacionNombre === 'string' ? it.presentacionNombre : undefined,
    }))
    for (const it of sanitized) {
      if (!it.presentacion_id || !Number.isFinite(it.cantidad) || it.cantidad <= 0) {
        return NextResponse.json({ error: 'Items inválidos' }, { status: 400 })
      }
      if (!Number.isFinite(it.precio_unitario) || it.precio_unitario <= 0) {
        return NextResponse.json({ error: 'Precio inválido — Stripe requiere monto > 0' }, { status: 400 })
      }
    }

    // ── Resolve / autocreate cliente ───────────────────────────────────────
    const cd = (cliente_data && typeof cliente_data === 'object') ? cliente_data : null
    const clientePatch: Record<string, any> = {}
    if (cd) {
      if (typeof cd.nombre === 'string'        && cd.nombre.trim())        clientePatch.nombre        = cd.nombre.trim()
      if (typeof cd.telefono === 'string'      && cd.telefono.trim())      clientePatch.telefono      = cd.telefono.trim()
      if (typeof cd.whatsapp === 'string'      && cd.whatsapp.trim())      clientePatch.whatsapp      = cd.whatsapp.trim()
      if (typeof cd.direccion === 'string'     && cd.direccion.trim())     clientePatch.direccion     = cd.direccion.trim()
      if (typeof cd.ciudad === 'string'        && cd.ciudad.trim())        clientePatch.ciudad        = cd.ciudad.trim()
      if (typeof cd.tipo_cliente === 'string'  && cd.tipo_cliente.trim())  clientePatch.tipo_cliente  = cd.tipo_cliente.trim()
    }

    let clienteRow: { id: string } | null = null
    {
      const { data } = await supabase.from('clientes').select('id').eq('user_id', user.id).maybeSingle()
      if (data) clienteRow = data as any
    }
    if (!clienteRow && user.email) {
      const { data } = await supabase.from('clientes').select('id').eq('email', user.email).maybeSingle()
      if (data) {
        clienteRow = data as any
        void supabase.from('clientes').update({ user_id: user.id }).eq('id', data.id).is('user_id', null)
          .then(() => null, e => console.error('[checkout/stripe] backfill user_id:', e))
      }
    }
    if (!clienteRow) {
      const { data: perfil } = await supabase.from('profiles').select('nombre').eq('id', user.id).maybeSingle()
      const nombre = clientePatch.nombre ?? perfil?.nombre ?? user.email?.split('@')[0] ?? 'Cliente'
      const { data: newCli, error: createErr } = await supabase
        .from('clientes')
        .insert({ nombre, email: user.email!, user_id: user.id, activo: true, ...clientePatch })
        .select('id').single()
      if (createErr || !newCli) {
        return NextResponse.json({
          error: 'No se pudo registrar el cliente: ' + (createErr?.message ?? 'error'),
        }, { status: 500 })
      }
      clienteRow = newCli as any
    }
    const cliente_id = clienteRow!.id
    const total = sanitized.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0)

    // ── Reserve inventory ──────────────────────────────────────────────────
    const stockItems = sanitized.map(it => ({
      presentacion_id: it.presentacion_id,
      cantidad: it.cantidad,
    }))
    const reserveRes = await reserveOrdenStock(supabase, stockItems)
    if (!reserveRes.ok) {
      await rollbackOrdenStock(supabase, stockItems)
      return NextResponse.json({
        error: 'No se pudo reservar inventario. Revisá disponibilidad o intentá de nuevo.',
        detail: reserveRes.error,
      }, { status: 409 })
    }

    // ── Sequence number for orden temporal ─────────────────────────────────
    const { data: numData } = await supabase.rpc('get_next_sequence', { seq_name: 'ordenes' })
    let ordenNumero = (numData as string) || ''
    if (!ordenNumero) {
      const year = new Date().getFullYear()
      ordenNumero = `ORD-${year}-${String(Date.now()).slice(-4)}`
    }

    // ── Insert orden temporal (estado='pendiente', tipo_pago='stripe') ────
    const { data: orden, error: ordenErr } = await supabase
      .from('ordenes')
      .insert({
        numero: ordenNumero,
        cliente_id,
        user_id: user.id,
        estado: 'pendiente',
        tipo_pago: 'stripe',
        estado_pago: 'pendiente_verificacion',
        notas: notas?.trim() || null,
        direccion_entrega: direccion_entrega?.trim() || null,
        total,
      })
      .select()
      .single()

    if (ordenErr || !orden) {
      await rollbackOrdenStock(supabase, stockItems)
      console.error('[checkout/stripe] orden insert failed:', ordenErr)
      return NextResponse.json({
        error: 'No se pudo iniciar el pago: ' + (ordenErr?.message ?? 'error'),
      }, { status: 500 })
    }

    // ── Insert orden_items ─────────────────────────────────────────────────
    const ordenItems = sanitized.map(it => ({
      orden_id: orden.id,
      presentacion_id: it.presentacion_id,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      subtotal: it.precio_unitario * it.cantidad,
    }))
    const { error: itemsErr } = await supabase.from('orden_items').insert(ordenItems)
    if (itemsErr) {
      await rollbackOrdenStock(supabase, stockItems)
      await supabase.from('ordenes').delete().eq('id', orden.id)
      console.error('[checkout/stripe] orden_items insert failed:', itemsErr)
      return NextResponse.json({
        error: 'No se pudieron guardar los productos: ' + itemsErr.message,
      }, { status: 500 })
    }

    // ── Create Stripe Checkout Session ────────────────────────────────────
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    let stripeSession: Stripe.Checkout.Session | null = null
    try {
      const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = sanitized.map(it => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: it.productoNombre
              ? `${it.productoNombre}${it.presentacionNombre ? ` — ${it.presentacionNombre}` : ''}`
              : (it.presentacionNombre ?? 'Producto'),
            description: it.presentacionNombre ?? undefined,
          },
          unit_amount: Math.round(it.precio_unitario * 100),
        },
        quantity: it.cantidad,
      }))

      stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items,
        mode: 'payment',
        success_url: `${siteUrl}/tienda/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/tienda/checkout/cancel?orden_id=${orden.id}`,
        customer_email: user.email ?? undefined,
        // Sessions de Checkout expiran 24h por default. Stripe envía
        // `checkout.session.expired` que el webhook captura para liberar
        // la reserva y marcar la orden como cancelada.
        expires_at: Math.floor(Date.now() / 1000) + 60 * 30, // 30 min — stock no se traba mucho
        metadata: {
          orden_id: orden.id,
          orden_numero: orden.numero,
          cliente_id,
          user_id: user.id,
          user_email: user.email ?? '',
          source: 'checkout_stripe_v2',
        },
      })
    } catch (stripeErr: any) {
      console.error('[checkout/stripe] session create failed:', stripeErr)
      // Rollback: borrar orden + items + liberar reserva
      await supabase.from('orden_items').delete().eq('orden_id', orden.id)
      await supabase.from('ordenes').delete().eq('id', orden.id)
      await rollbackOrdenStock(supabase, stockItems)
      return NextResponse.json({
        error: 'No se pudo iniciar el pago: ' + (stripeErr?.message ?? 'error de Stripe'),
      }, { status: 502 })
    }

    if (!stripeSession?.url) {
      console.error('[checkout/stripe] session has no URL')
      await supabase.from('orden_items').delete().eq('orden_id', orden.id)
      await supabase.from('ordenes').delete().eq('id', orden.id)
      await rollbackOrdenStock(supabase, stockItems)
      return NextResponse.json({
        error: 'No se pudo obtener URL de pago. Intentá de nuevo.',
      }, { status: 502 })
    }

    // ── Activity log ──────────────────────────────────────────────────────
    logActivity(supabase, {
      userId: user.id,
      action: 'checkout_stripe_session_created',
      resource: 'ordenes',
      resourceId: orden.id,
      details: {
        rol,
        orden_numero: orden.numero,
        stripe_session_id: stripeSession.id,
        total,
        items_count: sanitized.length,
      },
    })

    return NextResponse.json({
      success: true,
      tipo: 'pago',
      url: stripeSession.url,
      orden_id: orden.id,
      numero: orden.numero,
    }, { status: 201 })
  } catch (err: any) {
    console.error('[checkout/stripe] unhandled:', err)
    return NextResponse.json({
      error: 'Error interno: ' + (err?.message ?? String(err)),
    }, { status: 500 })
  }
}
