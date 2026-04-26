import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── DEPRECATED — Fase 4 ────────────────────────────────────────────────────
// El concepto "aprobar pedido" se eliminó del modelo. El pedido nace YA
// aprobado al materializarse desde una orden (vía /api/ordenes/[id]/aprobar
// o /api/ordenes/[id]/confirmar-pago) o al confirmarse el pago en Stripe.
//
// Este endpoint queda como stub que devuelve 410 Gone para que cualquier
// cliente que aún lo invoque se entere — en vez de fallar silencioso.
// La UI ya no muestra el botón "Aprobar pedido". Si llega un POST acá,
// es bug del frontend que no se actualizó.
// ────────────────────────────────────────────────────────────────────────────
export async function POST() {
  return NextResponse.json({
    error:
      'El paso "Aprobar pedido" se eliminó del modelo. El pedido nace ya aprobado ' +
      'al materializarse desde la orden. Si necesitás avanzar el ciclo, usá ' +
      '/api/pedidos/[id]/despachar.',
  }, { status: 410 })
}
