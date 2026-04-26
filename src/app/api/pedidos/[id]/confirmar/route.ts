import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── DEPRECATED — Fase 4 ────────────────────────────────────────────────────
// El paso "Confirmar pedido" (borrador → confirmada) se eliminó. El pedido
// ya no tiene estado 'borrador' — nace 'aprobada' directamente. La factura
// se crea automáticamente al aprobar la orden de origen.
//
// Stub 410 Gone para que cualquier cliente legacy se entere si todavía
// llama acá.
// ────────────────────────────────────────────────────────────────────────────
export async function POST() {
  return NextResponse.json({
    error:
      'El paso "Confirmar pedido" se eliminó del modelo. El pedido nace aprobado. ' +
      'Para avanzar el ciclo de despacho, usá /api/pedidos/[id]/despachar.',
  }, { status: 410 })
}
