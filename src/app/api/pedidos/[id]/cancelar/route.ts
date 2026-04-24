import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/pedidos/[id]/cancelar
//   Body (optional): { motivo?: string }
//   vendedor: only own borrador
//   admin:    any state except entregada
//             releases stock_reservado if pedido was aprobada/despachada
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  const isAdmin = profile?.rol === 'admin'
  const isVendedor = profile?.rol === 'vendedor'

  if (!isAdmin && !isVendedor) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const motivo: string = (body.motivo ?? '').trim()

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('estado, vendedor_id, notas')
    .eq('id', params.id)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const estadoActual: string = pedido.estado
  const estadoEntregada = ['entregada', 'entregado'].includes(estadoActual)

  if (isVendedor) {
    if (pedido.vendedor_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (estadoActual !== 'borrador') {
      return NextResponse.json(
        { error: 'Los vendedores solo pueden cancelar pedidos en borrador' },
        { status: 403 }
      )
    }
  } else if (isAdmin) {
    if (estadoEntregada) {
      return NextResponse.json(
        { error: 'No se puede cancelar un pedido ya entregado' },
        { status: 400 }
      )
    }
  }

  const requiereLiberacion = ['aprobada', 'despachada', 'despachado', 'en_ruta', 'preparando', 'confirmado'].includes(estadoActual)

  if (requiereLiberacion) {
    const { data: items } = await supabase
      .from('pedido_items')
      .select('presentacion_id, cantidad, presentaciones(producto_id)')
      .eq('pedido_id', params.id)

    if (items && items.length > 0) {
      await Promise.all(items.map(async (item: any) => {
        const { data: inv } = await supabase
          .from('inventario')
          .select('id, stock_reservado, producto_id')
          .eq('presentacion_id', item.presentacion_id)
          .maybeSingle()

        if (inv) {
          const nuevoReservado = Math.max(0, (inv.stock_reservado ?? 0) - item.cantidad)
          await supabase
            .from('inventario')
            .update({ stock_reservado: nuevoReservado })
            .eq('id', inv.id)

          await supabase.from('inventario_movimientos').insert({
            producto_id: inv.producto_id,
            presentacion_id: item.presentacion_id,
            tipo: 'liberacion',
            cantidad: item.cantidad,
            stock_anterior: inv.stock_reservado ?? 0,
            stock_nuevo: nuevoReservado,
            referencia_tipo: 'pedido_cancelado',
            referencia_id: params.id,
            usuario_id: user.id,
            notas: motivo ? `Cancelación: ${motivo}` : 'Pedido cancelado — liberación de reserva',
          })
        }
      }))
    }
  }

  const updates: Record<string, unknown> = { estado: 'cancelada', updated_at: new Date().toISOString() }
  if (motivo) updates.notas = motivo

  const { data, error } = await supabase
    .from('pedidos')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
