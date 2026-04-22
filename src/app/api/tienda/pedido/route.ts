import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { items, notas, direccion_entrega } = body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
  }

  // Find the linked cliente record by email
  const { data: clienteData } = await supabase
    .from('clientes')
    .select('id')
    .eq('email', user.email ?? '')
    .maybeSingle()

  const cliente_id = clienteData?.id ?? null

  // Generate sequence number
  const { data: numData, error: numError } = await supabase
    .rpc('get_next_sequence', { seq_name: 'pedidos' })
  if (numError) return NextResponse.json({ error: numError.message }, { status: 500 })

  const subtotal = items.reduce(
    (acc: number, item: any) => acc + Number(item.precio_unitario) * Number(item.cantidad),
    0
  )

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .insert({
      numero: numData,
      cliente_id,
      vendedor_id: null,
      estado: 'borrador',
      subtotal,
      descuento: 0,
      impuesto: 0,
      total: subtotal,
      notas: notas?.trim() || null,
      direccion_entrega: direccion_entrega?.trim() || null,
    })
    .select()
    .single()

  if (pedidoError) return NextResponse.json({ error: pedidoError.message }, { status: 500 })

  const pedidoItems = items.map((item: any) => ({
    pedido_id: pedido.id,
    presentacion_id: item.presentacion_id,
    cantidad: Number(item.cantidad),
    precio_unitario: Number(item.precio_unitario),
    descuento: 0,
    subtotal: Number(item.precio_unitario) * Number(item.cantidad),
  }))

  const { error: itemsError } = await supabase.from('pedido_items').insert(pedidoItems)
  if (itemsError) {
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // ── Reserve stock (non-fatal: RPC created by stock_reservado.sql) ─────────
  await Promise.all(
    items.map(async (item: any) => {
      await supabase
        .rpc('reserve_stock', {
          p_id: item.presentacion_id,
          p_amount: Number(item.cantidad),
        })
        // Silent fail if RPC hasn't been created yet in Supabase
        .then(() => null)
        .catch(() => null)
    })
  )

  return NextResponse.json(pedido, { status: 201 })
}
