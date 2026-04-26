import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── DEPRECATED — Fase 4 ────────────────────────────────────────────────────
// El paso "Preparar pedido" se eliminó. En el modelo nuevo:
//   • El pedido nace 'aprobada' + 'por_despachar' (Mache puede prepararlo
//     físicamente pero el sistema no trackea ese estado intermedio).
//   • El próximo movimiento es directo a 'despachado' cuando sale.
//
// Si querés diferenciar "preparado" de "por_despachar", agregá un estado
// nuevo a estado_despacho en una migration aparte. Por ahora, stub.
// ────────────────────────────────────────────────────────────────────────────
export async function POST() {
  return NextResponse.json({
    error:
      'El paso "Preparar pedido" se eliminó del modelo. Pasá directamente a ' +
      '/api/pedidos/[id]/despachar cuando el pedido esté listo para salir.',
  }, { status: 410 })
}
