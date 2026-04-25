import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAdminOrVendedor } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/clientes/[id]/contexto
 *
 * Lightweight snapshot used by the pedido creation UI to show the
 * negotiator (Mache) everything she needs to quote confidently:
 *
 *   - descuento_porcentaje (global discount, %)
 *   - deuda_total          (outstanding balance, computed from
 *                           clientes.deuda_total if set, otherwise
 *                           derived from unpaid facturas)
 *   - pedidos_recientes    (last 5 orders: numero, estado, total, fecha)
 *   - total_pedidos        (count of all orders, to guide context)
 *
 * Access: admin OR vendedor.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const gate = await requireAdminOrVendedor(supabase)
    if (!gate.ok) return gate.response

    const clienteId = params.id

    const [
      { data: cliente },
      { data: pedidosRecientes },
      { count: totalPedidos },
      { data: facturasUnpaid },
    ] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, nombre, descuento_porcentaje, deuda_total, limite_credito, dias_credito')
        .eq('id', clienteId)
        .maybeSingle(),
      supabase
        .from('pedidos')
        .select('id, numero, estado, total, fecha_pedido')
        .eq('cliente_id', clienteId)
        .order('fecha_pedido', { ascending: false })
        .limit(5),
      supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', clienteId),
      supabase
        .from('facturas')
        .select('total, monto_pagado, fecha_vencimiento')
        .eq('cliente_id', clienteId)
        .in('estado', ['emitida', 'enviada']),
    ])

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Prefer the denormalized deuda_total column when present; fall back to
    // summing the saldo pendiente across open facturas.
    const deudaFromFacturas = (facturasUnpaid ?? []).reduce(
      (s: number, f: any) => s + (Number(f.total ?? 0) - Number(f.monto_pagado ?? 0)),
      0
    )
    const deudaTotal = Number((cliente as any).deuda_total ?? deudaFromFacturas)

    // Overdue bucket summary — vencidas = facturas whose fecha_vencimiento passed.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let facturasVencidasCount = 0
    let montoVencido = 0
    for (const f of (facturasUnpaid ?? []) as any[]) {
      const saldo = Number(f.total ?? 0) - Number(f.monto_pagado ?? 0)
      if (saldo <= 0) continue
      if (!f.fecha_vencimiento) continue
      if (new Date(f.fecha_vencimiento) < today) {
        facturasVencidasCount += 1
        montoVencido += saldo
      }
    }

    return NextResponse.json({
      cliente: {
        id: cliente.id,
        nombre: (cliente as any).nombre,
        descuento_porcentaje: Number((cliente as any).descuento_porcentaje ?? 0),
        limite_credito: Number((cliente as any).limite_credito ?? 0),
        dias_credito: Number((cliente as any).dias_credito ?? 0),
      },
      deuda: {
        total: deudaTotal,
        facturas_pendientes: (facturasUnpaid ?? []).length,
        facturas_vencidas: facturasVencidasCount,
        monto_vencido: montoVencido,
      },
      pedidos_recientes: (pedidosRecientes ?? []).map((p: any) => ({
        id: p.id,
        numero: p.numero,
        estado: p.estado,
        total: Number(p.total ?? 0),
        fecha_pedido: p.fecha_pedido,
      })),
      total_pedidos: totalPedidos ?? 0,
    })
  } catch (err: any) {
    console.error('[GET /api/clientes/[id]/contexto]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
