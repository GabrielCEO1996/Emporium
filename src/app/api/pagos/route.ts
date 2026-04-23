import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/pagos — record a payment for a factura (admin only)
export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores pueden registrar pagos' }, { status: 403 })

  const body = await req.json()
  const { factura_id, metodo, referencia, notas } = body

  if (!factura_id || !metodo) {
    return NextResponse.json({ error: 'factura_id y metodo son requeridos' }, { status: 400 })
  }

  const validMetodos = ['efectivo', 'transferencia', 'credito', 'stripe']
  if (!validMetodos.includes(metodo)) {
    return NextResponse.json({ error: `Método inválido. Valores: ${validMetodos.join(', ')}` }, { status: 400 })
  }

  if (metodo === 'transferencia' && !referencia?.trim()) {
    return NextResponse.json({ error: 'Las transferencias requieren un número de referencia' }, { status: 400 })
  }

  // Fetch factura
  const { data: factura } = await supabase
    .from('facturas')
    .select('id, total, monto_pagado, estado, cliente_id')
    .eq('id', factura_id)
    .single()

  if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  if (factura.estado === 'anulada') return NextResponse.json({ error: 'No se puede pagar una factura anulada' }, { status: 409 })
  if (factura.estado === 'pagada') return NextResponse.json({ error: 'La factura ya está pagada' }, { status: 409 })

  const monto = factura.total

  // Insert pago record
  const { error: pagoError } = await supabase.from('pagos').insert({
    factura_id,
    monto,
    metodo,
    referencia: referencia?.trim() || null,
    notas: notas?.trim() || null,
    usuario_id: user.id,
  })

  if (pagoError) return NextResponse.json({ error: pagoError.message }, { status: 500 })

  // If credito: update cliente.credito_usado
  if (metodo === 'credito') {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('credito_usado, limite_credito')
      .eq('id', factura.cliente_id)
      .single()

    if (cliente) {
      const nuevoCreditoUsado = (cliente.credito_usado ?? 0) + monto
      await supabase
        .from('clientes')
        .update({ credito_usado: nuevoCreditoUsado, updated_at: new Date().toISOString() })
        .eq('id', factura.cliente_id)
    }
  }

  // Mark factura as pagada
  const { data: updated, error: facturaError } = await supabase
    .from('facturas')
    .update({
      estado: 'pagada',
      monto_pagado: monto,
      updated_at: new Date().toISOString(),
    })
    .eq('id', factura_id)
    .select('id, numero, total, monto_pagado')
    .single()

  if (facturaError) return NextResponse.json({ error: facturaError.message }, { status: 500 })

  // Ledger: insert ingreso in transacciones
  await supabase.from('transacciones').insert({
    tipo: 'ingreso',
    monto,
    fecha: new Date().toISOString().split('T')[0],
    concepto: `Pago factura ${updated.numero} (${metodo})`,
    referencia_tipo: 'factura',
    referencia_id: factura_id,
    usuario_id: user.id,
  })

  return NextResponse.json(updated, { status: 201 })
}

// GET /api/pagos?factura_id=xxx — list payments for a factura
export async function GET(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const facturaId = new URL(req.url).searchParams.get('factura_id')
  if (!facturaId) return NextResponse.json({ error: 'factura_id requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('pagos')
    .select('*, usuario:profiles(nombre)')
    .eq('factura_id', facturaId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
