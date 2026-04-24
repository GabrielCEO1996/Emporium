import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { fetchLotsFefo, allocateFefo } from '@/lib/fefo'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/pedidos/[id]/entregar — ADMIN ONLY
// despachada → entregada ; consumes stock_total and releases stock_reservado using FEFO.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden marcar pedidos como entregados' }, { status: 403 })
  }

  const { data: pedido } = await supabase.from('pedidos').select('estado').eq('id', params.id).single()
  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  // Accept new 'despachada' + legacy 'despachado' / 'en_ruta' for backward compatibility
  if (!['despachada', 'despachado', 'en_ruta'].includes(pedido.estado)) {
    return NextResponse.json(
      { error: `Solo se pueden entregar pedidos despachados (estado actual: ${pedido.estado})` },
      { status: 400 }
    )
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

  const { data, error } = await supabase
    .from('pedidos')
    .update({
      estado: 'entregada',
      fecha_entrega_real: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
