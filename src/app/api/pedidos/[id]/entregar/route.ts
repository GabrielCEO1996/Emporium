import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/pedidos/[id]/entregar — ADMIN ONLY
// despachado → entregado; discounts stock_total and releases stock_reservado
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores pueden marcar pedidos como entregados' }, { status: 403 })

  const { data: pedido } = await supabase.from('pedidos').select('estado').eq('id', params.id).single()
  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (pedido.estado !== 'despachado') {
    return NextResponse.json({ error: `Solo se pueden entregar pedidos despachados (estado: ${pedido.estado})` }, { status: 400 })
  }

  // Discount stock: stock_total -= cantidad, stock_reservado -= cantidad
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
        const nuevoTotal = Math.max(0, (inv.stock_total ?? 0) - item.cantidad)
        const nuevoReservado = Math.max(0, (inv.stock_reservado ?? 0) - item.cantidad)

        await supabase
          .from('inventario')
          .update({ stock_total: nuevoTotal, stock_reservado: nuevoReservado })
          .eq('id', inv.id)

        // Keep presentaciones.stock in sync
        await supabase
          .from('presentaciones')
          .update({ stock: nuevoTotal, updated_at: new Date().toISOString() })
          .eq('id', item.presentacion_id)

        await supabase.from('inventario_movimientos').insert({
          producto_id: inv.producto_id,
          presentacion_id: item.presentacion_id,
          tipo: 'salida',
          cantidad: item.cantidad,
          stock_anterior: inv.stock_total,
          stock_nuevo: nuevoTotal,
          referencia_tipo: 'pedido_entregado',
          referencia_id: params.id,
          usuario_id: user.id,
        })
      }
    }))
  }

  // Update pedido to entregado with real delivery date
  const { data, error } = await supabase
    .from('pedidos')
    .update({
      estado: 'entregado',
      fecha_entrega_real: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
