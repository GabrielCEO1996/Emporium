import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrVendedor } from '@/lib/auth'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  // AUTH FIRST: staff only. Previously auth was checked AFTER two DB reads —
  // that leaked pedido existence to anonymous callers. Gate before any query.
  const gate = await requireAdminOrVendedor(supabase)
  if (!gate.ok) return gate.response
  const { user } = gate

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

  if (pedidoError || !pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  // Check if factura already exists (new flow auto-creates on despachar).
  // Idempotency guard: reject duplicates instead of double-billing.
  const { data: existingFactura } = await supabase
    .from('facturas')
    .select('id')
    .eq('pedido_id', pedido.id)
    .maybeSingle()
  if (existingFactura) {
    return NextResponse.json(
      { error: 'Este pedido ya tiene factura emitida' },
      { status: 409 },
    )
  }

  // Generate factura number
  const { data: numData } = await supabase.rpc('get_next_sequence', { seq_name: 'facturas' })

  // Recompute server-side — never trust pedido totals blindly.
  const subtotal  = Math.max(0, Number(pedido.subtotal  ?? 0))
  const descuento = Math.max(0, Number(pedido.descuento ?? 0))
  const base_imponible = Math.max(0, subtotal - descuento)
  const impuesto = 0
  const total = base_imponible

  // Create factura
  const { data: factura, error: facturaError } = await supabase
    .from('facturas')
    .insert({
      numero: numData,
      pedido_id: pedido.id,
      cliente_id: pedido.cliente_id,
      vendedor_id: user.id || pedido.vendedor_id,
      estado: 'emitida',
      subtotal,
      descuento,
      base_imponible,
      tasa_impuesto: 0,
      impuesto,
      total,
      fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })
    .select()
    .single()

  if (facturaError) {
    console.error('[pedidos/[id]/facturar] factura insert failed:', facturaError)
    return NextResponse.json({ error: facturaError.message }, { status: 500 })
  }

  // Create factura items from pedido items
  const facturaItems = (pedido.pedido_items ?? []).map((item: any) => ({
    factura_id: factura.id,
    presentacion_id: item.presentacion_id,
    descripcion: `${item.presentaciones?.productos?.nombre ?? ''} - ${item.presentaciones?.nombre ?? ''}`.trim(),
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    descuento: item.descuento,
    subtotal: item.subtotal,
  }))

  if (facturaItems.length > 0) {
    const { error: itemsErr } = await supabase.from('factura_items').insert(facturaItems)
    if (itemsErr) {
      console.error('[pedidos/[id]/facturar] items insert failed:', itemsErr)
    }
  }

  // NOTE: pedido estado is NOT changed here; use /despachar or PATCH for state transitions

  return NextResponse.json(factura, { status: 201 })
}
