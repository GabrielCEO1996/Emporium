import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RouteContext { params: { id: string } }

// ─── GET /api/ordenes/[id] ──────────────────────────────────────────────────
export async function GET(_req: Request, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('ordenes')
    .select(`
      *,
      cliente:clientes(*),
      items:orden_items(
        *,
        presentacion:presentaciones(*, producto:productos(*))
      ),
      pedido:pedidos!pedidos_orden_id_fkey(id, numero, estado)
    `)
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.code === 'PGRST116' ? 'Orden no encontrada' : error.message },
      { status: error.code === 'PGRST116' ? 404 : 500 }
    )
  }
  return NextResponse.json(data)
}

// ─── DELETE /api/ordenes/[id] ───────────────────────────────────────────────
// Client can cancel own pending order; admin can delete any
export async function DELETE(_req: Request, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  const isAdmin = profile?.rol === 'admin'

  const { data: orden } = await supabase
    .from('ordenes')
    .select('id, user_id, estado, numero')
    .eq('id', params.id)
    .single()
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

  if (!isAdmin && orden.user_id !== user.id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }
  if (!isAdmin && orden.estado !== 'pendiente') {
    return NextResponse.json(
      { error: 'Solo se pueden cancelar órdenes pendientes' },
      { status: 409 }
    )
  }

  try {
    await supabase.from('orden_items').delete().eq('orden_id', params.id)
    const { error } = await supabase.from('ordenes').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }

  return NextResponse.json({ message: `Orden ${orden.numero} eliminada` })
}
