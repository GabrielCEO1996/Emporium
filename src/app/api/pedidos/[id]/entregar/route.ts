import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { fetchLotsFefo, allocateFefo } from '@/lib/fefo'
import { logActivity } from '@/lib/activity'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/pedidos/[id]/entregar — ADMIN ONLY
// despachada → entregada ; consumes stock_total and releases stock_reservado using FEFO.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (profile?.rol !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden marcar pedidos como entregados' }, { status: 403 })
      }

      const { data: pedido } = await supabase
        .from('pedidos').select('numero, estado, estado_despacho').eq('id', params.id).single()
      if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

      // Modelo nuevo (Fase 4): el pedido siempre es 'aprobada' o 'cancelada'
      // — la etapa la trackea estado_despacho. Aceptamos 'despachado' como
      // estado_despacho válido. Fallback a estados legacy para datos sin
      // migrar.
      const ed = (pedido as any).estado_despacho
      const isNewModel = ed != null
      if (isNewModel) {
        if (pedido.estado !== 'aprobada') {
          return NextResponse.json(
            { error: `Solo se pueden entregar pedidos aprobados (estado actual: ${pedido.estado})` },
            { status: 400 }
          )
        }
        if (ed !== 'despachado') {
          return NextResponse.json(
            { error: `Pedido debe estar despachado primero (despacho: ${ed})` },
            { status: 400 }
          )
        }
      } else {
        // Legacy fallback
        if (!['despachada', 'despachado', 'en_ruta'].includes(pedido.estado)) {
          return NextResponse.json(
            { error: `Solo se pueden entregar pedidos despachados (estado actual: ${pedido.estado})` },
            { status: 400 }
          )
        }
      }

      const { data: items } = await supabase
        .from('pedido_items')
        .select('presentacion_id, cantidad')
        .eq('pedido_id', params.id)

      if (items && items.length > 0) {
        for (const item of items as any[]) {
          const lots = await fetchLotsFefo(supabase, item.presentacion_id)
          // Consume from previously-reserved lots first (FEFO order — typically the same
          // lots where we reserved during aprobar). Fall back to raw `disponible` if the
          // reservation was insufficient.
          const fromReserved = allocateFefo(lots, item.cantidad, 'reservado')
          const reservedTotal = fromReserved.reduce((s, a) => s + a.take, 0)
          const remaining = Math.max(0, item.cantidad - reservedTotal)

          let extra: { lot: typeof lots[number]; take: number }[] = []
          if (remaining > 0) {
            // Rebuild disponible allocations against refreshed lot state
            extra = allocateFefo(lots, remaining, 'disponible')
          }

          const combined = [...fromReserved, ...extra]

          // Consolidate per lot in case the same lot shows up in both lists
          const perLot = new Map<string, { lot: typeof lots[number]; take: number; fromReserved: number }>()
          for (const a of fromReserved) {
            perLot.set(a.lot.id, { lot: a.lot, take: a.take, fromReserved: a.take })
          }
          for (const a of extra) {
            const prev = perLot.get(a.lot.id)
            if (prev) {
              prev.take += a.take
            } else {
              perLot.set(a.lot.id, { lot: a.lot, take: a.take, fromReserved: 0 })
            }
          }

          for (const { lot, take, fromReserved: resv } of perLot.values()) {
            const nuevoTotal     = Math.max(0, (lot.stock_total ?? 0) - take)
            const nuevoReservado = Math.max(0, (lot.stock_reservado ?? 0) - resv)

            await supabase
              .from('inventario')
              .update({ stock_total: nuevoTotal, stock_reservado: nuevoReservado })
              .eq('id', lot.id)

            await supabase.from('inventario_movimientos').insert({
              producto_id:       lot.producto_id,
              presentacion_id:   item.presentacion_id,
              tipo:              'salida',
              cantidad:          take,
              stock_anterior:    lot.stock_total ?? 0,
              stock_nuevo:       nuevoTotal,
              numero_lote:       lot.numero_lote,
              fecha_vencimiento: lot.fecha_vencimiento,
              referencia_tipo:   'pedido_entregado',
              referencia_id:     params.id,
              usuario_id:        user.id,
              notas:             'Pedido entregado — salida FEFO',
            })
          }

          // Maintain legacy presentaciones.stock sum for read-only backward compat
          const newSum = lots.reduce((s, l) => {
            const applied = perLot.get(l.id)?.take ?? 0
            return s + Math.max(0, (l.stock_total ?? 0) - applied)
          }, 0)
          await supabase
            .from('presentaciones')
            .update({ stock: newSum, updated_at: new Date().toISOString() })
            .eq('id', item.presentacion_id)

          // Suppress unused var warning
          void combined
        }
      }

      // Modelo nuevo: solo cambiamos estado_despacho, NO el estado
      // (sigue 'aprobada'). Defensive cascade: DBs sin la columna caen
      // al modelo viejo de mover estado='entregada'.
      let data: any = null
      let error: any = null
      {
        const r = await supabase
          .from('pedidos')
          .update({
            estado_despacho: 'entregado',
            fecha_entrega_real: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id)
          .select()
          .single()
        data = r.data
        error = r.error
      }
      if (error && /estado_despacho/i.test(error.message || '')) {
        console.warn('[pedidos/entregar] estado_despacho missing — falling back to legacy estado=entregada')
        const r = await supabase
          .from('pedidos')
          .update({
            estado: 'entregada',
            fecha_entrega_real: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id)
          .select()
          .single()
        data = r.data
        error = r.error
      }

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Include factura link in the log if one exists for this pedido
      const { data: facturaRow } = await supabase
        .from('facturas')
        .select('id, numero')
        .eq('pedido_id', params.id)
        .maybeSingle()

      void logActivity(supabase as any, {
        user_id: user.id,
        action: 'entregar_pedido',
        resource: 'pedidos',
        resource_id: params.id,
        estado_anterior: ed ?? pedido.estado,
        estado_nuevo: 'entregado',
        details: {
          pedido_id:      params.id,
          pedido_numero:  pedido.numero,
          factura_id:     facturaRow?.id     ?? null,
          factura_numero: facturaRow?.numero ?? null,
        },
      })

      return NextResponse.json(data)

  } catch (err) {
    console.error('[POST /api/pedidos/[id]/entregar]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
