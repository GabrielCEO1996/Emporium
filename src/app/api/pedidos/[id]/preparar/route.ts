import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/pedidos/[id]/preparar — DEPRECATED (legacy alias for /aprobar)
// Kept for backward compatibility. New flow: confirmada → aprobada (reserves inventory).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (profile?.rol !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden aprobar/preparar pedidos' }, { status: 403 })
      }

      const { data: pedido } = await supabase.from('pedidos').select('estado').eq('id', params.id).single()
      if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

      // Accept both new 'confirmada' and legacy 'confirmado'
      if (!['confirmada', 'confirmado'].includes(pedido.estado)) {
        return NextResponse.json(
          { error: `Solo se pueden aprobar pedidos confirmados (estado actual: ${pedido.estado})` },
          { status: 400 }
        )
      }

      // Reserve inventory
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
            const nuevoReservado = (inv.stock_reservado ?? 0) + item.cantidad
            await supabase
              .from('inventario')
              .update({ stock_reservado: nuevoReservado })
              .eq('id', inv.id)

            await supabase.from('inventario_movimientos').insert({
              producto_id: inv.producto_id,
              presentacion_id: item.presentacion_id,
              tipo: 'reserva',
              cantidad: item.cantidad,
              stock_anterior: inv.stock_reservado ?? 0,
              stock_nuevo: nuevoReservado,
              referencia_tipo: 'pedido_aprobado',
              referencia_id: params.id,
              usuario_id: user.id,
              notas: 'Pedido aprobado — reserva de stock',
            })
          }
        }))
      }

      const { data, error } = await supabase
        .from('pedidos')
        .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)

  } catch (err) {
    console.error('[POST /api/pedidos/[id]/preparar]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
