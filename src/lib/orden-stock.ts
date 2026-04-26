// ═══════════════════════════════════════════════════════════════════════════
// src/lib/orden-stock.ts
//
// Reserva y libera stock para órdenes de la tienda. Opera sobre el sistema
// simple `presentaciones.stock_reservado` (los RPCs `reserve_stock` /
// `release_stock` viven en supabase/stock_reservado.sql).
//
// Lifecycle de una orden:
//   1. Cliente crea orden        → reserveOrdenStock(items)
//   2a. Admin aprueba             → releaseOrdenStock(ordenId) y el pedido
//                                   resultante toma over con su propio
//                                   sistema FEFO (lib/fefo.ts en lots).
//   2b. Admin rechaza             → releaseOrdenStock(ordenId)
//   2c. Cliente cancela           → releaseOrdenStock(ordenId)
//
// La reserva de la orden es transitoria — siempre se libera al cerrar el
// ciclo. El pedido tiene su propia reserva (FEFO en `inventario`) que vive
// hasta que se despacha.
//
// IMPORTANTE: estos helpers loguean errores pero no fallan el handler. Una
// reserva fallida en un solo item no debería bloquear todo el flow — la
// orden aún queda en pendiente con notas en logs y el admin la revisa.
// La inversa (release fallido) tampoco bloquea — el inventario podría
// quedar sobrerreservado pero esto se reconcilia manualmente.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export interface OrdenStockItem {
  presentacion_id: string
  cantidad: number
}

/**
 * Reserve stock for every item in an orden via the `reserve_stock` RPC.
 * Returns `{ok: true}` on full success, or `{ok: false, error}` on the
 * first failure. Does NOT roll back partially-reserved items — the caller
 * is expected to delete the orden if reserve fails (the items list is
 * known at that point).
 */
export async function reserveOrdenStock(
  supabase: SupabaseClient,
  items: OrdenStockItem[],
): Promise<{ ok: true } | { ok: false; error: string; failedItem: OrdenStockItem }> {
  for (const it of items) {
    const { error } = await supabase.rpc('reserve_stock', {
      p_id: it.presentacion_id,
      p_amount: it.cantidad,
    })
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[reserveOrdenStock] RPC reserve_stock failed:', {
        presentacion_id: it.presentacion_id,
        cantidad: it.cantidad,
        error: error.message,
      })
      return { ok: false, error: error.message, failedItem: it }
    }
  }
  return { ok: true }
}

/**
 * Release stock for every item in an orden. Loads items via SELECT and
 * calls `release_stock` per row. Soft-fails: if a single release errors,
 * we log and continue — better to release as many as possible than to
 * abandon mid-way and leave inventory locked.
 *
 * Returns the count of items successfully released. If 0 the caller may
 * want to flag for manual review.
 */
export async function releaseOrdenStock(
  supabase: SupabaseClient,
  ordenId: string,
): Promise<{ ok: boolean; itemsReleased: number; itemsTotal: number }> {
  const { data: items, error: itemsErr } = await supabase
    .from('orden_items')
    .select('presentacion_id, cantidad')
    .eq('orden_id', ordenId)

  if (itemsErr) {
    // eslint-disable-next-line no-console
    console.error('[releaseOrdenStock] failed to load orden_items:', itemsErr)
    return { ok: false, itemsReleased: 0, itemsTotal: 0 }
  }

  const list = (items ?? []) as OrdenStockItem[]
  let released = 0

  for (const it of list) {
    const { error } = await supabase.rpc('release_stock', {
      p_id: it.presentacion_id,
      p_amount: it.cantidad,
    })
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[releaseOrdenStock] release_stock failed:', {
        ordenId,
        presentacion_id: it.presentacion_id,
        cantidad: it.cantidad,
        error: error.message,
      })
    } else {
      released++
    }
  }

  return { ok: released === list.length, itemsReleased: released, itemsTotal: list.length }
}

/**
 * Best-effort rollback for a freshly reserved orden whose subsequent insert
 * (orden_items, etc.) failed. Takes the items list directly because at this
 * point the orden_items rows may not have been written.
 */
export async function rollbackOrdenStock(
  supabase: SupabaseClient,
  items: OrdenStockItem[],
): Promise<void> {
  for (const it of items) {
    const { error } = await supabase.rpc('release_stock', {
      p_id: it.presentacion_id,
      p_amount: it.cantidad,
    })
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[rollbackOrdenStock] release_stock failed:', {
        presentacion_id: it.presentacion_id,
        error: error.message,
      })
    }
  }
}
