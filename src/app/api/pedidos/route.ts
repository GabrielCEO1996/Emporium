import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol, id').eq('id', user.id).single()
  const isAdmin = profile?.rol === 'admin'
  const isVendedor = profile?.rol === 'vendedor'

  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')
  const cliente_id = searchParams.get('cliente_id')
  const fecha_inicio = searchParams.get('fecha_inicio')
  const fecha_fin = searchParams.get('fecha_fin')
  const page  = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = (page - 1) * limit

  let query = supabase
    .from('pedidos')
    .select(`
      *,
      clientes(id, nombre, rif, telefono),
      conductores(id, nombre),
      profiles!pedidos_vendedor_id_fkey(id, nombre)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Vendedores only see their own pedidos (anti-fraud)
  if (isVendedor) query = query.eq('vendedor_id', user.id)

  if (estado && estado !== 'todos') query = query.eq('estado', estado)
  if (cliente_id) query = query.eq('cliente_id', cliente_id)
  if (fecha_inicio) query = query.gte('fecha_pedido', fecha_inicio)
  if (fecha_fin) query = query.lte('fecha_pedido', fecha_fin + 'T23:59:59')

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count ?? 0, page, limit })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', authUser.id).single()
  if (!['admin', 'vendedor'].includes(profile?.rol ?? '')) {
    return NextResponse.json({ error: 'Sin permiso para crear pedidos' }, { status: 403 })
  }

  const body = await request.json()
  const { cliente_id, vendedor_id, items, descuento = 0, notas, direccion_entrega, fecha_entrega_estimada } = body

  if (!cliente_id || !items?.length) {
    return NextResponse.json({ error: 'cliente_id e items son requeridos' }, { status: 400 })
  }

  // Vendedores can only create pedidos in their own name
  const effectiveVendedorId = profile?.rol === 'vendedor' ? authUser.id : (vendedor_id || null)

  const { data: numData, error: numError } = await supabase.rpc('get_next_sequence', { seq_name: 'pedidos' })
  if (numError) return NextResponse.json({ error: numError.message }, { status: 500 })

  const subtotal = items.reduce((acc: number, item: any) => acc + item.subtotal, 0)
  const total = subtotal - descuento

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .insert({
      numero: numData,
      cliente_id,
      vendedor_id: effectiveVendedorId,
      estado: 'borrador',
      subtotal,
      descuento,
      impuesto: 0,
      total,
      notas,
      direccion_entrega,
      fecha_entrega_estimada: fecha_entrega_estimada || null,
    })
    .select()
    .single()

  if (pedidoError) return NextResponse.json({ error: pedidoError.message }, { status: 500 })

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
