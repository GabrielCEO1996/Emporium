import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Check current state
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('estado')
    .eq('id', params.id)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (pedido.estado !== 'borrador') {
    return NextResponse.json({ error: 'Solo se pueden confirmar pedidos en borrador' }, { status: 400 })
  }

  // Discount stock via stored function (updates presentaciones.stock)
  const { error: stockError } = await supabase.rpc('descontar_stock_pedido', { p_pedido_id: params.id })
  if (stockError) return NextResponse.json({ error: stockError.message }, { status: 500 })

  // Get pedido items to update inventario.stock_reservado
  const { data: items } = await supabase
    .from('pedido_items')
    .select('presentacion_id, cantidad, presentaciones(producto_id)')
    .eq('pedido_id', params.id)

  if (items && items.length > 0) {
    await Promise.all(items.map(async (item: any) => {
      // Get current inventario row
      const { data: inv } = await supabase
        .from('inventario')
        .select('id, stock_total, stock_reservado, producto_id')
        .eq('presentacion_id', item.presentacion_id)
        .single()

      if (inv) {
        const nuevoReservado = (inv.stock_reservado ?? 0) + item.cantidad
        await supabase
          .from('inventario')
          .update({ stock_reservado: nuevoReservado })
          .eq('id', inv.id)

        // Log movement
        await supabase.from('inventario_movimientos').insert({
          producto_id: inv.producto_id,
          presentacion_id: item.presentacion_id,
          tipo: 'reserva',
          cantidad: item.cantidad,
          stock_anterior: inv.stock_reservado,
          stock_nuevo: nuevoReservado,
          referencia_tipo: 'pedido_confirmado',
          referencia_id: params.id,
          usuario_id: user.id,
        })
      }
    }))
  }

  // Update status
  const { data, error } = await supabase
    .from('pedidos')
    .update({ estado: 'confirmado', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
