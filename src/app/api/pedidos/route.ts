import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')
  const cliente_id = searchParams.get('cliente_id')
  const fecha_inicio = searchParams.get('fecha_inicio')
  const fecha_fin = searchParams.get('fecha_fin')
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabase
    .from('pedidos')
    .select(`
      *,
      clientes(id, nombre, rif, telefono),
      conductores(id, nombre),
      profiles!pedidos_vendedor_id_fkey(id, nombre)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (estado && estado !== 'todos') query = query.eq('estado', estado)
  if (cliente_id) query = query.eq('cliente_id', cliente_id)
  if (fecha_inicio) query = query.gte('fecha_pedido', fecha_inicio)
  if (fecha_fin) query = query.lte('fecha_pedido', fecha_fin + 'T23:59:59')

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const body = await request.json()
  const { cliente_id, vendedor_id, items, descuento = 0, notas, direccion_entrega, fecha_entrega_estimada } = body

  if (!cliente_id || !items?.length) {
    return NextResponse.json({ error: 'cliente_id e items son requeridos' }, { status: 400 })
  }

  // Generate sequence number
  const { data: numData, error: numError } = await supabase
    .rpc('get_next_sequence', { seq_name: 'pedidos' })

  if (numError) return NextResponse.json({ error: numError.message }, { status: 500 })

  // Calculate totals
  const subtotal = items.reduce((acc: number, item: any) => acc + item.subtotal, 0)
  const base_imponible = subtotal - descuento
  const impuesto = 0
  const total = base_imponible

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .insert({
      numero: numData,
      cliente_id,
      vendedor_id: vendedor_id || null,
      estado: 'borrador',
      subtotal,
      descuento,
      impuesto,
      total,
      notas,
      direccion_entrega,
      fecha_entrega_estimada: fecha_entrega_estimada || null,
    })
    .select()
    .single()

  if (pedidoError) return NextResponse.json({ error: pedidoError.message }, { status: 500 })

  // Insert items
  const pedidoItems = items.map((item: any) => ({
    pedido_id: pedido.id,
    presentacion_id: item.presentacion_id,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    descuento: item.descuento || 0,
    subtotal: item.subtotal,
  }))

  const { error: itemsError } = await supabase.from('pedido_items').insert(pedidoItems)

  if (itemsError) {
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json(pedido, { status: 201 })
}
