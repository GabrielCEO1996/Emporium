import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, rateLimitResponse, logActivity } from '@/lib/security'
import { reserveOrdenStock, rollbackOrdenStock } from '@/lib/orden-stock'
import { generateTransaccionId } from '@/lib/transaccion'

// Disable all caching for this route handler.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── POST /api/ordenes/crear ────────────────────────────────────────────────
// "Generar orden" — flujo B2B.
//
// Crea una orden SIN método de pago decidido. El método se decide después
// en facturación cuando admin/vendedor despache. Este endpoint es la
// alternativa al checkout con pago directo (Stripe/Zelle) — el cliente
// autorizado quiere comprar pero quiere que admin apruebe primero.
//
// Estado al crear:
//   estado         = 'pendiente'
//   tipo_pago      = NULL     (no decidido — el CHECK lo permite ahora)
//   estado_pago    = 'no_aplica'
//   pago_confirmado = false
//
// Inventario:
//   Reserva stock_reservado en `presentaciones` para cada item. Si la
//   reserva falla (RPC error), se hace rollback eliminando la orden +
//   release de los items ya reservados.
//
// Roles permitidos:
//   • cliente — el flujo B2B normal (rol con crédito/relación pre-existente)
//
// Roles BLOQUEADOS:
//   • comprador — debe usar /api/checkout/stripe o /api/checkout/zelle
//                 (no tiene crédito autorizado, no puede generar orden
//                 sin pago)
//   • admin / vendedor — usan venta directa en el panel admin
//
// Body:
//   {
//     items: Array<{ presentacion_id, cantidad, precio_unitario,
//                    productoNombre?, presentacionNombre? }>,
//     notas?: string,
//     direccion_entrega?: string,
//     cliente_data?: { nombre, telefono, direccion, ciudad, whatsapp,
//                      tipo_cliente }   // si el form de envío lo trae
//   }
//
// Response 201:
//   { success: true, tipo: 'orden', numero, orden_id }
// ─────────────────────────────────────────────────────────────────────────────

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
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // ── Rol gate ───────────────────────────────────────────────────────────
    // Solo rol 'cliente' puede generar orden B2B sin pago. Comprador debe
    // usar checkout con pago directo. Admin/vendedor usan venta directa.
    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).maybeSingle()
    const rol = profile?.rol ?? 'comprador'

    if (rol !== 'cliente') {
      logActivity(supabase, {
        userId: user.id,
        action: 'security_violation_orden_b2b',
        resource: 'ordenes',
        details: { attempted_rol: rol, reason: 'only_cliente_can_create_b2b_orden' },
      })
      return NextResponse.json({
        error: 'Solo clientes autorizados pueden generar órdenes B2B. ' +
               'Si querés pagar con tarjeta o Zelle, usá "Comprar ahora" en el carrito.',
      }, { status: 403 })
    }

    // ── Rate limit ─────────────────────────────────────────────────────────
    if (!rateLimit(`orden_b2b:${user.id}`, 10, 60 * 60 * 1000)) {
      return rateLimitResponse(60 * 60 * 1000)
    }

    // ── Parse body ─────────────────────────────────────────────────────────
    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
    }

    const { items, notas, direccion_entrega, cliente_data } = body ?? {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
    }
    if (items.length > 100) {
      return NextResponse.json({ error: 'Máximo 100 productos por orden' }, { status: 400 })
    }
    // Sanitize items shape
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
      if (!Number.isFinite(it.precio_unitario) || it.precio_unitario < 0) {
        return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
      }
    }

    // ── Resolve / autocreate cliente record ────────────────────────────────
    // Mismo patrón que /api/tienda/pedido. Cliente puede tener su record
    // ya creado (login B2B) o lo creamos al vuelo enriquecido con el form
    // de envío.
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
        // Backfill user_id (fire-and-forget)
        void supabase.from('clientes')
          .update({ user_id: user.id }).eq('id', data.id).is('user_id', null)
          .then(() => null, e => console.error('[ordenes/crear] backfill user_id:', e))
      }
    }
    if (!clienteRow) {
      const { data: perfil } = await supabase
        .from('profiles').select('nombre').eq('id', user.id).maybeSingle()
      const nombre = clientePatch.nombre
        ?? perfil?.nombre
        ?? user.user_metadata?.full_name
        ?? user.email?.split('@')[0]
        ?? 'Cliente'
      const insertPayload: Record<string, any> = {
        nombre,
        email: user.email!,
        user_id: user.id,
        activo: true,
        ...clientePatch,
      }
      insertPayload.nombre = nombre
      const { data: newCli, error: createErr } = await supabase
        .from('clientes').insert(insertPayload).select('id').single()
      if (createErr || !newCli) {
        return NextResponse.json({
          error: 'No se pudo registrar el cliente: ' + (createErr?.message ?? 'error desconocido'),
        }, { status: 500 })
      }
      clienteRow = newCli as any
    } else if (Object.keys(clientePatch).length > 0) {
      void supabase.from('clientes')
        .update({ ...clientePatch, updated_at: new Date().toISOString() })
        .eq('id', clienteRow.id)
        .then(() => null, e => console.error('[ordenes/crear] cliente patch:', e))
    }

    const cliente_id = clienteRow!.id
    const total = sanitized.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0)

    // ── Reserve inventory FIRST ────────────────────────────────────────────
    // Si reserve falla, no creamos orden y abortamos limpio. La inversa
    // (orden creada + reserve falla → orden colgada) es peor.
    const stockItems = sanitized.map(it => ({
      presentacion_id: it.presentacion_id,
      cantidad: it.cantidad,
    }))
    const reserveRes = await reserveOrdenStock(supabase, stockItems)
    if (!reserveRes.ok) {
      // Roll back any partial reserves that did succeed before the failed one.
      // We can't know which ones succeeded vs failed without bookkeeping,
      // so release all items defensively. Idempotent — RPC clamps to 0.
      await rollbackOrdenStock(supabase, stockItems)
      // Logueamos el contexto completo del intento — los items, el rol, el
      // user. Combinado con el log detallado de reserveOrdenStock alcanza
      // para reproducir el bug sin tener que pedirle datos al cliente.
      console.error('[ordenes/crear] reserveOrdenStock failed — context:', {
        user_id: user.id,
        rol,
        items: stockItems,
        failedItem: reserveRes.failedItem,
      })
      // Surface the specific RPC error if it's the user-friendly "stock
      // insuficiente" message (the only ERRCODE we raise from reserve_stock).
      // For everything else (function not found, perm denied, etc.) usamos
      // un mensaje genérico — no querés filtrarle el error técnico al cliente.
      const detail = reserveRes.error || ''
      const isInsufficientStock = /stock insuficiente/i.test(detail)
      return NextResponse.json({
        error: isInsufficientStock
          ? detail.replace(/^reserve_stock:\s*/, '')
          : 'No se pudo reservar inventario para uno de los productos. ' +
            'Revisá disponibilidad o intentá de nuevo.',
        detail,
      }, { status: 409 })
    }

    // ── Sequence number for the orden ──────────────────────────────────────
    const { data: numData } = await supabase
      .rpc('get_next_sequence', { seq_name: 'ordenes' })
    let ordenNumero = (numData as string) || ''
    if (!ordenNumero) {
      // Fallback: scan by year prefix
      const year = new Date().getFullYear()
      const { data: last } = await supabase
        .from('ordenes').select('numero')
        .like('numero', `ORD-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()
      const parts = last?.numero ? String(last.numero).split('-') : []
      const lastN = parts.length === 3 ? parseInt(parts[2], 10) || 0 : 0
      ordenNumero = `ORD-${year}-${String(lastN + 1).padStart(4, '0')}`
    }

    // ── Generate master transaccion_id (EMP-YYYY-NNNN) ────────────────────
    // Soft-fail: si la secuencia no está instalada (DB no migrada todavía)
    // la orden se crea sin handle maestro. Logueamos para investigar.
    const transaccionId = await generateTransaccionId(supabase)

    // ── Insert orden ───────────────────────────────────────────────────────
    // tipo_pago = NULL (no decidido)
    // estado_pago = 'no_aplica' (pago se decide en facturación)
    // estado = 'pendiente' (espera aprobación admin)
    const ordenPayload: Record<string, any> = {
      numero: ordenNumero,
      cliente_id,
      user_id: user.id,
      estado: 'pendiente',
      tipo_pago: null,
      estado_pago: 'no_aplica',
      notas: notas?.trim() || null,
      direccion_entrega: direccion_entrega?.trim() || null,
      total,
    }
    if (transaccionId) ordenPayload.transaccion_id = transaccionId

    let { data: orden, error: ordenErr } = await supabase
      .from('ordenes')
      .insert(ordenPayload)
      .select()
      .single()
    // Defensive: si la columna transaccion_id no existe (migration v1 sin
    // aplicar), reintentar sin ella.
    if (ordenErr && /transaccion_id/i.test(ordenErr.message || '')) {
      console.warn('[ordenes/crear] transaccion_id column missing — retrying without')
      delete ordenPayload.transaccion_id
      const retry = await supabase.from('ordenes').insert(ordenPayload).select().single()
      orden = retry.data
      ordenErr = retry.error
    }

    if (ordenErr || !orden) {
      // Rollback the inventory reservation we just made
      await rollbackOrdenStock(supabase, stockItems)
      console.error('[ordenes/crear] orden insert failed:', ordenErr)
      return NextResponse.json({
        error: 'No se pudo crear la orden: ' + (ordenErr?.message ?? 'error desconocido'),
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
      // Roll back: release stock + delete orden
      await rollbackOrdenStock(supabase, stockItems)
      await supabase.from('ordenes').delete().eq('id', orden.id)
      console.error('[ordenes/crear] orden_items insert failed:', itemsErr)
      return NextResponse.json({
        error: 'No se pudieron guardar los productos: ' + itemsErr.message,
      }, { status: 500 })
    }

    // ── Activity log ───────────────────────────────────────────────────────
    logActivity(supabase, {
      userId: user.id,
      action: 'orden_creada',
      resource: 'ordenes',
      resourceId: orden.id,
      details: {
        rol,
        tipo: 'b2b_sin_pago',
        numero: orden.numero,
        total,
        items_count: sanitized.length,
      },
    })

    // ── Email notification to admins (fire-and-forget) ────────────────────
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
    if (siteOrigin) {
      fetch(`${siteOrigin}/api/email/nueva-orden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden_id: orden.id }),
      }).catch(err => console.error('[ordenes/crear] email trigger failed (non-fatal):', err))
    }

    return NextResponse.json({
      success: true,
      tipo: 'orden',
      numero: orden.numero,
      orden_id: orden.id,
    }, { status: 201 })
  } catch (err: any) {
    console.error('[ordenes/crear] unhandled:', err)
    return NextResponse.json({
      error: 'Error interno del servidor: ' + (err?.message ?? String(err)),
    }, { status: 500 })
  }
}
