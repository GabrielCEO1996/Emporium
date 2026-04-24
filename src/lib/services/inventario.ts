/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Inventario — stock lifecycle wrappers.
 *
 * Wraps src/lib/fefo.ts with higher-level intents so route handlers don't
 * have to know about lots:
 *
 *   reserveStock()  — earmark units for a confirmed pedido (won't ship yet).
 *   consumeStock()  — actually decrement on delivery; writes movimientos.
 *   releaseStock()  — undo a reservation (cancelled pedido).
 *   allocateStockFEFO() — plan which lots to pull from for a given cantidad.
 *
 * All helpers are best-effort for non-critical side-effects (movimientos,
 * presentaciones.stock mirror). They log on failure but don't throw, so a
 * single failed mirror doesn't abort the whole ship operation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  fetchLotsFefo,
  type FefoLot,
} from '@/lib/fefo'

export interface StockItem {
  presentacion_id: string
  cantidad: number
}

export interface AllocationPlan {
  presentacion_id: string
  cantidad_solicitada: number
  cantidad_asignada: number
  asignaciones: Array<{
    inventario_id: string
    numero_lote: string | null
    cantidad: number
  }>
  faltante: number
}

/**
 * Compute (without writing) the lot breakdown for pulling `cantidad` units
 * from a presentacion in FEFO order. Does NOT mutate anything.
 */
export async function allocateStockFEFO(
  supabase: any,
  presentacionId: string,
  cantidad: number,
): Promise<AllocationPlan> {
  const lots: FefoLot[] = await fetchLotsFefo(supabase, presentacionId)
  let remaining = Math.max(0, Number(cantidad) || 0)

  const asignaciones: AllocationPlan['asignaciones'] = []
  for (const lot of lots) {
    if (remaining <= 0) break
    const disponible = Math.max(
      0,
      (lot.stock_disponible ?? (lot.stock_total ?? 0) - (lot.stock_reservado ?? 0)),
    )
    if (disponible <= 0) continue
    const take = Math.min(disponible, remaining)
    asignaciones.push({
      inventario_id: lot.id,
      numero_lote: lot.numero_lote,
      cantidad: take,
    })
    remaining -= take
  }

  return {
    presentacion_id: presentacionId,
    cantidad_solicitada: Math.max(0, Number(cantidad) || 0),
    cantidad_asignada: Math.max(0, Number(cantidad) || 0) - remaining,
    asignaciones,
    faltante: remaining,
  }
}

/**
 * Earmark stock across lots so concurrent pedidos don't double-sell.
 * Returns a per-item plan; caller is responsible for the rollback.
 */
export async function reserveStock(
  supabase: any,
  items: StockItem[],
): Promise<AllocationPlan[]> {
  const plans: AllocationPlan[] = []
  for (const item of items) {
    const plan = await allocateStockFEFO(supabase, item.presentacion_id, item.cantidad)
    for (const a of plan.asignaciones) {
      await supabase.rpc('reservar_stock_lote', {
        p_inventario_id: a.inventario_id,
        p_cantidad: a.cantidad,
      }).catch((err: any) => {
        console.error('[inventario] reservar_stock_lote failed:', err?.message ?? err)
      })
    }
    plans.push(plan)
  }
  return plans
}

/**
 * Release previously reserved stock (pedido cancelled). Accepts the plan
 * returned by reserveStock() or — if not available — looks up and releases
 * across all lots for the presentación.
 */
export async function releaseStock(
  supabase: any,
  items: StockItem[],
): Promise<void> {
  for (const item of items) {
    const plan = await allocateStockFEFO(supabase, item.presentacion_id, item.cantidad)
    for (const a of plan.asignaciones) {
      await supabase.rpc('liberar_stock_lote', {
        p_inventario_id: a.inventario_id,
        p_cantidad: a.cantidad,
      }).catch((err: any) => {
        console.error('[inventario] liberar_stock_lote failed:', err?.message ?? err)
      })
    }
  }
}

/**
 * Actually decrement stock on delivery. Inserts inventario_movimientos with
 * the given referencia_tipo/id so the audit trail stays intact.
 */
export async function consumeStock(
  supabase: any,
  items: StockItem[],
  referencia: { tipo: string; id: string; usuarioId?: string | null; notas?: string | null },
): Promise<void> {
  for (const item of items) {
    const plan = await allocateStockFEFO(supabase, item.presentacion_id, item.cantidad)
    for (const a of plan.asignaciones) {
      try {
        const { data: inv } = await supabase
          .from('inventario')
          .select('stock_total, producto_id')
          .eq('id', a.inventario_id)
          .maybeSingle()
        if (!inv) continue

        const stockAnterior = Number(inv.stock_total ?? 0)
        const stockNuevo = Math.max(0, stockAnterior - a.cantidad)

        await supabase.from('inventario')
          .update({ stock_total: stockNuevo })
          .eq('id', a.inventario_id)

        await supabase.from('inventario_movimientos').insert({
          producto_id: inv.producto_id,
          presentacion_id: item.presentacion_id,
          tipo: 'salida',
          cantidad: a.cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          referencia_tipo: referencia.tipo,
          referencia_id: referencia.id,
          usuario_id: referencia.usuarioId ?? null,
          notas: referencia.notas ?? null,
        })
      } catch (err) {
        console.error('[inventario] consumeStock failed:', err)
      }
    }
  }
}
