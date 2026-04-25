import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { fetchLotsFefo, allocateFefo } from '@/lib/fefo'
import { logActivity } from '@/lib/activity'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/pedidos/[id]/aprobar — ADMIN ONLY
// confirmada → aprobada ; reserves inventory (stock_reservado +=) using FEFO.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (profile?.rol !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden aprobar pedidos' }, { status: 403 })
      }

      const { data: pedido } = await supabase
        .from('pedidos')
        .select('numero, estado')
        .eq('id', params.id)
        .single()

      if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
      if (pedido.estado !== 'confirmada') {
        return NextResponse.json(
          { error: `Solo se pueden aprobar pedidos confirmados (estado actual: ${pedido.estado})` },
          { status: 400 }
        )
      }

      const { data: items } = await supabase
        .from('pedido_items')
        .select('presentacion_id, cantidad')
        .eq('pedido_id', params.id)

      if (items && items.length > 0) {
        // Sequential — each item may touch multiple lot rows; keep DB state coherent.
        for (const item of items as any[]) {
          const lots = await fetchLotsFefo(supabase, item.presentacion_id)
          const allocs = allocateFefo(lots, item.cantidad, 'disponible')

          // Note: if total allocated < item.cantidad there wasn't enough fresh stock.
          // We still reserve what's available — admin will see the shortfall when despachar fails.
          for (const { lot, take } of allocs) {
            const nuevoReservado = (lot.stock_reservado ?? 0) + take
            await supabase
              .from('inventario')
              .update({ stock_reservado: nuevoReservado })
              .eq('id', lot.id)

            await supabase.from('inventario_movimientos').insert({
              producto_id:       lot.producto_id,
              presentacion_id:   item.presentacion_id,
              tipo:              'reserva',
              cantidad:          take,
              stock_anterior:    lot.stock_reservado ?? 0,
              stock_nuevo:       nuevoReservado,
              numero_lote:       lot.numero_lote,
              fecha_vencimiento: lot.fecha_vencimiento,
              referencia_tipo:   'pedido_aprobado',
              referencia_id:     params.id,
              usuario_id:        user.id,
              notas:             'Pedido aprobado — reserva FEFO',
            })
          }
        }
      }

      const { data, error } = await supabase
        .from('pedidos')
        .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      void logActivity(supabase as any, {
        user_id: user.id,
        action: 'aprobar_pedido',
        resource: 'pedidos',
        resource_id: params.id,
        estado_anterior: pedido.estado,
        estado_nuevo: 'aprobada',
        details: { pedido_id: params.id, pedido_numero: pedido.numero },
      })

      return NextResponse.json(data)

  } catch (err) {
    console.error('[POST /api/pedidos/[id]/aprobar]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
