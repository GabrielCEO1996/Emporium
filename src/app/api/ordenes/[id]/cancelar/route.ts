import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'
import { releaseOrdenStock } from '@/lib/orden-stock'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RouteContext { params: { id: string } }

// ─── POST /api/ordenes/[id]/cancelar ───────────────────────────────────────
// Cancelar una orden pendiente. Permitido para:
//   • El owner de la orden (orden.user_id === auth.uid) — el cliente
//     cancela su propia orden antes que admin la apruebe.
//   • Admin / vendedor — pueden cancelar cualquier orden pendiente
//     (caso: cliente llama por teléfono a pedir cancelación).
//
// Solo se puede cancelar si estado='pendiente'. Una vez aprobada, ya
// vive como pedido y se cancela por el flujo del pedido.
//
// Libera la reserva de inventario (presentaciones.stock_reservado) para
// todos los items de la orden.
//
// Body opcional: { motivo: string }  → guardado en motivo_rechazo (mismo
//                                       campo, semántica de "motivo de
//                                       cierre" — UI diferencia por estado).
// ───────────────────────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).maybeSingle()
    const rol = profile?.rol ?? 'comprador'
    const isStaff = rol === 'admin' || rol === 'vendedor'

    // Load the orden
    const { data: orden, error: fetchErr } = await supabase
      .from('ordenes')
      .select('id, numero, estado, user_id')
      .eq('id', params.id)
      .single()

    if (fetchErr || !orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    // Owner check: cliente debe ser el dueño, staff puede cancelar cualquiera.
    const isOwner = orden.user_id === user.id
    if (!isOwner && !isStaff) {
      return NextResponse.json({
        error: 'Solo el cliente que creó la orden puede cancelarla',
      }, { status: 403 })
    }

    if (orden.estado !== 'pendiente') {
      return NextResponse.json({
        error: `Solo se pueden cancelar órdenes pendientes (estado actual: ${orden.estado})`,
      }, { status: 409 })
    }

    // Optional motivo
    const body = await req.json().catch(() => ({} as any))
    const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''

    // ── Release stock reservation FIRST ────────────────────────────────────
    // Si la orden no se libera correctamente, igual seguimos con el cancel
    // (mejor cancelarla y dejar reservado un poco que dejarla colgada).
    const releaseRes = await releaseOrdenStock(supabase, orden.id)
    if (!releaseRes.ok) {
      console.warn('[ordenes/cancelar] partial release:', {
        orden: orden.numero,
        released: releaseRes.itemsReleased,
        total: releaseRes.itemsTotal,
      })
    }

    // ── Mark orden as cancelada ────────────────────────────────────────────
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('ordenes')
      .update({
        estado: 'cancelada',
        motivo_rechazo: motivo || (isOwner ? 'Cancelada por el cliente' : 'Cancelada por staff'),
        updated_at: nowIso,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    void logActivity(supabase as any, {
      user_id: user.id,
      action: 'cancelar_orden',
      resource: 'ordenes',
      resource_id: orden.id,
      estado_anterior: 'pendiente',
      estado_nuevo: 'cancelada',
      details: {
        orden_numero: orden.numero,
        cancelado_por: isOwner ? 'cliente' : 'staff',
        motivo: motivo || null,
        stock_released: releaseRes.itemsReleased,
        stock_total: releaseRes.itemsTotal,
      },
    })

    return NextResponse.json({
      message: `Orden ${orden.numero} cancelada`,
      orden: data,
      stock_released: releaseRes.itemsReleased,
    })
  } catch (err) {
    console.error('[POST /api/ordenes/[id]/cancelar]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
