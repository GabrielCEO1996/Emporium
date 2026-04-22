import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const cliente_id = searchParams.get('cliente_id')
  const estado = searchParams.get('estado')

  let query = supabase
    .from('notas_credito')
    .select(`*, clientes(id, nombre), facturas(id, numero)`)
    .order('created_at', { ascending: false })

  if (cliente_id) query = query.eq('cliente_id', cliente_id)
  if (estado) query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const body = await request.json()
  const { factura_id, cliente_id, motivo, tipo, items, notas } = body

  if (!factura_id || !cliente_id || !motivo || !items?.length) {
    return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 })
  }

  const { data: numData } = await supabase.rpc('get_next_sequence', { seq_name: 'notas_credito' })

  const subtotal = items.reduce((acc: number, i: any) => acc + i.subtotal, 0)
  const impuesto = 0
  const total = subtotal

  const { data: nc, error } = await supabase
    .from('notas_credito')
    .insert({ numero: numData, factura_id, cliente_id, motivo, tipo: tipo || 'devolucion', estado: 'emitida', subtotal, impuesto, total, notas })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ncItems = items.map((i: any) => ({ ...i, nota_credito_id: nc.id }))
  await supabase.from('nota_credito_items').insert(ncItems)

  // Update factura estado
  await supabase.from('facturas').update({ estado: 'con_nota_credito' }).eq('id', factura_id)

  return NextResponse.json(nc, { status: 201 })
}
