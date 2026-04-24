import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RouteContext { params: { id: string } }

// ─── POST /api/ordenes/[id]/rechazar ────────────────────────────────────────
// ADMIN ONLY. Body: { motivo: string }
// Marks orden as 'rechazada' and stores motivo_rechazo.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request, { params }: RouteContext) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden rechazar órdenes' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
  if (!motivo) {
    return NextResponse.json({ error: 'El motivo es obligatorio' }, { status: 400 })
  }

  const { data: orden } = await supabase
    .from('ordenes')
    .select('id, estado, numero')
    .eq('id', params.id)
    .single()

  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (orden.estado !== 'pendiente') {
    return NextResponse.json(
      { error: `Solo se pueden rechazar órdenes pendientes (estado actual: ${orden.estado})` },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('ordenes')
    .update({
      estado: 'rechazada',
      motivo_rechazo: motivo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void logActivity(supabase, {
    user_id: user.id,
    action: 'rechazar_orden',
    resource: 'ordenes',
    resource_id: orden.id,
    estado_anterior: 'pendiente',
    estado_nuevo: 'rechazada',
    details: { orden_numero: orden.numero, motivo },
  })

  return NextResponse.json({
    message: `Orden ${orden.numero} rechazada`,
    orden: data,
  })
}
