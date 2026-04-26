// ═══════════════════════════════════════════════════════════════════════════
// src/lib/transaccion.ts
//
// Helpers para el ID maestro EMP-YYYY-NNNN que une orden → pedido → factura
// (ver supabase/transacciones_maestras.sql).
//
// Reglas de oro:
//   • Orden / pedido / factura SIN parent  → generateTransaccionId()
//   • Pedido derivado de una orden         → orden.transaccion_id
//   • Factura derivada de un pedido        → pedido.transaccion_id
//
// NUNCA generes un EMP-XXXX nuevo cuando hay parent. Eso rompe la
// trazabilidad punta a punta que es justamente el motivo de existir
// del handle.
//
// Soft-fail: si la generación falla (RPC error, secuencia no instalada),
// el helper devuelve null. El caller decide si bloquear o continuar; en
// general continúa porque la fila igual tiene su numero (ORD/PED/FAC) que
// es un fallback funcional. El soft-fail se logea para investigación.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generates a fresh master transaction id (e.g. EMP-2026-0042).
 * Use when there's NO parent orden/pedido to inherit from.
 *
 * Returns null on RPC failure — caller logs and decides whether to block.
 */
export async function generateTransaccionId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_next_sequence', {
    seq_name: 'transacciones_maestras',
  })
  if (error) {
    console.error('[generateTransaccionId] RPC failed:', {
      code: (error as any).code,
      message: error.message,
    })
    return null
  }
  if (typeof data !== 'string' || data.length === 0) {
    console.error('[generateTransaccionId] unexpected RPC return:', data)
    return null
  }
  return data
}
