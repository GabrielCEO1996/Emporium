/**
 * FEFO (First Expired First Out) helpers for lot-aware inventario.
 *
 * When a product has multiple inventario rows (one per numero_lote) we
 * allocate/reserve/release stock starting from the lot that expires first.
 * Lots without fecha_vencimiento (generic stock) go LAST.
 *
 * These helpers intentionally accept `any`-typed supabase clients so they
 * can be reused from both server components and route handlers without
 * pulling in conflicting Database<> generic types.
 */

export interface FefoLot {
  id: string
  producto_id: string | null
  stock_total: number
  stock_reservado: number
  stock_disponible: number | null
  numero_lote: string | null
  fecha_vencimiento: string | null
}

/**
 * Load every inventario lot for a given presentacion, ordered by FEFO.
 * Row with earliest fecha_vencimiento first; NULL fecha_vencimiento last.
 */
export async function fetchLotsFefo(
  supabase: any,
  presentacionId: string,
): Promise<FefoLot[]> {
  const { data } = await supabase
    .from('inventario')
    .select('id, producto_id, stock_total, stock_reservado, stock_disponible, numero_lote, fecha_vencimiento')
    .eq('presentacion_id', presentacionId)

  const rows: FefoLot[] = (data ?? []) as FefoLot[]
  // Sort: fecha_vencimiento ASC NULLS LAST, then numero_lote
  rows.sort((a, b) => {
    if (a.fecha_vencimiento && b.fecha_vencimiento) {
      return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento)
    }
    if (a.fecha_vencimiento) return -1
    if (b.fecha_vencimiento) return 1
    return (a.numero_lote ?? '').localeCompare(b.numero_lote ?? '')
  })
  return rows
}

/** Assign `cantidad` units across lots in FEFO order. */
export interface Allocation {
  lot: FefoLot
  take: number
}

export function allocateFefo(lots: FefoLot[], cantidad: number, source: 'disponible' | 'reservado'): Allocation[] {
  const out: Allocation[] = []
  let remaining = cantidad
  const today = new Date().toISOString().split('T')[0]
  for (const lot of lots) {
    if (remaining <= 0) break
    // When allocating NEW reservations / sales, skip expired lots.
    // When releasing a prior reservation, we operate on whatever lot had it.
    if (source === 'disponible' && lot.fecha_vencimiento && lot.fecha_vencimiento < today) continue
    const available =
      source === 'disponible'
        ? Math.max(0, (lot.stock_disponible ?? lot.stock_total - lot.stock_reservado))
        : lot.stock_reservado
    if (available <= 0) continue
    const take = Math.min(available, remaining)
    out.push({ lot, take })
    remaining -= take
  }
  return out
}
