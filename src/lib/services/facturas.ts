/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Facturas — business rules & math.
 *
 * Pure helpers only (no HTTP, no auth). Route handlers should do auth +
 * validation, then call these. Keeping the money math in one place makes
 * it testable and ensures /api/facturas POST and /api/pedidos/[id]/facturar
 * agree on how a total is computed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface LineItem {
  cantidad: number
  precio_unitario: number
  /** Per-line discount, 0–100%. */
  descuento?: number
}

export interface InvoiceTotals {
  subtotal: number
  descuento: number
  base_imponible: number
  impuesto: number
  total: number
}

/** Clamp a value into the non-negative finite range. */
export function nonNeg(n: unknown, fallback = 0): number {
  const x = Number(n)
  if (!Number.isFinite(x) || x < 0) return fallback
  return x
}

/**
 * Centralized invoice math. Recomputes per-line subtotal and aggregate totals
 * from trusted server data — never trust client-supplied subtotals.
 *
 * @param items      line items (cantidad + precio_unitario + optional descuento%)
 * @param descuento  global discount in currency units (NOT %), e.g. 5.00
 * @param tasaImpuesto  tax rate, 0–1 (e.g. 0.16 for IVA 16%). Default 0.
 */
export function calculateTotal(
  items: LineItem[],
  descuento = 0,
  tasaImpuesto = 0,
): InvoiceTotals & { items: Array<LineItem & { subtotal: number }> } {
  const lines = items.map((i) => {
    const cantidad = nonNeg(i.cantidad)
    const precio   = nonNeg(i.precio_unitario)
    const descPct  = Math.min(100, Math.max(0, Number(i.descuento ?? 0)))
    const base     = cantidad * precio
    const lineDesc = base * (descPct / 100)
    return { ...i, cantidad, precio_unitario: precio, descuento: descPct, subtotal: nonNeg(base - lineDesc) }
  })

  const subtotal       = lines.reduce((s, i) => s + i.subtotal, 0)
  const safeDesc       = nonNeg(descuento)
  const base_imponible = nonNeg(subtotal - safeDesc)
  const rate           = Math.min(1, Math.max(0, Number(tasaImpuesto) || 0))
  const impuesto       = nonNeg(base_imponible * rate)
  const total          = base_imponible + impuesto

  return {
    items: lines,
    subtotal,
    descuento: safeDesc,
    base_imponible,
    impuesto,
    total,
  }
}

/**
 * Generate the next invoice number via the `get_next_sequence` RPC with a
 * timestamp-based fallback.
 */
export async function generateInvoiceNumber(
  supabase: any,
  seqName: 'facturas' | 'pedidos' | 'ordenes' | 'notas_credito' = 'facturas',
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_next_sequence', { seq_name: seqName })
    if (!error && typeof data === 'string' && data.length > 0) return data
  } catch {
    /* fall through to timestamp */
  }
  const prefix = seqName === 'facturas' ? 'FAC'
              : seqName === 'pedidos'  ? 'PED'
              : seqName === 'ordenes'  ? 'ORD'
              : 'NC'
  return `${prefix}-${Date.now()}`
}

/**
 * Business rule: which invoices may still be edited.
 * - emitida / enviada → editable (monto_pagado, notas, etc).
 * - pagada / anulada / con_nota_credito → terminal; reject edits.
 */
export function canEditInvoice(factura: { estado?: string | null }): boolean {
  const terminal = new Set(['pagada', 'anulada', 'con_nota_credito'])
  return !!factura.estado && !terminal.has(factura.estado)
}

/**
 * Business rule: can a credit note be issued against this factura?
 * Must not already have one, and must not be anulada.
 */
export function canIssueCreditNote(factura: { estado?: string | null }): boolean {
  if (!factura.estado) return false
  return factura.estado !== 'anulada' && factura.estado !== 'con_nota_credito'
}
