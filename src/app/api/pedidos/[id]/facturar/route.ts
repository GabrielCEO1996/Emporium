import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  // Get full pedido with items
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select(`
      *,
      pedido_items(
        *,
        presentaciones(nombre, productos(nombre))
      )
    `)
    .eq('id', params.id)
    .single()

  if (pedidoError || !pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (pedido.estado === 'facturado') return NextResponse.json({ error: 'Pedido ya fue facturado' }, { status: 400 })

  // Get user for vendedor_id
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Generate factura number
  const { data: numData } = await supabase.rpc('get_next_sequence', { seq_name: 'facturas' })

  const base_imponible = pedido.subtotal - pedido.descuento
  const impuesto = 0
  const total = base_imponible

  // Create factura
  const { data: factura, error: facturaError } = await supabase
    .from('facturas')
    .insert({
      numero: numData,
      pedido_id: pedido.id,
      cliente_id: pedido.cliente_id,
      vendedor_id: user?.id || pedido.vendedor_id,
      estado: 'emitida',
      subtotal: pedido.subtotal,
      descuento: pedido.descuento,
      base_imponible,
      tasa_impuesto: 0,
      impuesto: 0,
      total,
      fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })
    .select()
    .single()

  if (facturaError) return NextResponse.json({ error: facturaError.message }, { status: 500 })

  // Create factura items from pedido items
  const facturaItems = pedido.pedido_items.map((item: any) => ({
    factura_id: factura.id,
    presentacion_id: item.presentacion_id,
    descripcion: `${item.presentaciones?.productos?.nombre} - ${item.presentaciones?.nombre}`,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    descuento: item.descuento,
    subtotal: item.subtotal,
  }))

  await supabase.from('factura_items').insert(facturaItems)

  // Update pedido estado to facturado
  await supabase.from('pedidos').update({ estado: 'facturado' }).eq('id', params.id)

  return NextResponse.json(factura, { status: 201 })
}
