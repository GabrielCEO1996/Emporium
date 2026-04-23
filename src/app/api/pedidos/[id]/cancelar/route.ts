import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/pedidos/[id]/cancelar — ADMIN ONLY
// Cancels a confirmed/preparando/despachado pedido and releases inventory reservation
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores pueden cancelar pedidos confirmados' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const motivo: string = body.motivo?.trim() ?? ''
  if (!motivo) return NextResponse.json({ error: 'Se requiere un motivo de cancelación' }, { status: 400 })

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('estado')
    .eq('id', params.id)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const cancelableStates = ['confirmado', 'preparando', 'despachado']
  if (!cancelableStates.includes(pedido.estado)) {
    return NextResponse.json(
      { error: `No se puede cancelar un pedido en estado "${pedido.estado}"` },
      { status: 400 }
    )
  }

  // Release inventory reservation (stock_reservado -= cantidad)
  const { data: items } = await supabase
    .from('pedido_items')
    .select('presentacion_id, cantidad, presentaciones(producto_id)')
    .eq('pedido_id', params.id)

  if (items && items.length > 0) {
    await Promise.all(items.map(async (item: any) => {
      const { data: inv } = await supabase
        .from('inventario')
        .select('id, stock_total, stock_reservado, producto_id')
        .eq('presentacion_id', item.presentacion_id)
        .single()

      if (inv) {
        const nuevoReservado = Math.max(0, (inv.stock_reservado ?? 0) - item.cantidad)
        await supabase.from('inventario').update({ stock_reservado: nuevoReservado }).eq('id', inv.id)
        await supabase.from('inventario_movimientos').insert({
          producto_id: inv.producto_id,
          presentacion_id: item.presentacion_id,
          tipo: 'liberacion',
          cantidad: item.cantidad,
          stock_anterior: inv.stock_reservado,
          stock_nuevo: nuevoReservado,
          referencia_tipo: 'pedido_cancelado',
          referencia_id: params.id,
          usuario_id: user.id,
          notas: `Cancelación: ${motivo}`,
        })
      }
    }))
  }

  const { data, error } = await supabase
    .from('pedidos')
    .update({
      estado: 'cancelado',
      notas: motivo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
