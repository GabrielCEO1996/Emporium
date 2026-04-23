import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/pedidos/[id]/despachar — ADMIN ONLY
// preparando → despachado; auto-creates factura if none exists
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores pueden despachar pedidos' }, { status: 403 })

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, estado, cliente_id, vendedor_id, subtotal, descuento, total, notas')
    .eq('id', params.id)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (pedido.estado !== 'preparando') {
    return NextResponse.json({ error: `Solo se pueden despachar pedidos en preparación (estado: ${pedido.estado})` }, { status: 400 })
  }

  // Auto-create factura if it doesn't exist yet for this pedido
  const { data: existingFactura } = await supabase
    .from('facturas')
    .select('id, numero')
    .eq('pedido_id', params.id)
    .maybeSingle()

  let facturaId: string | null = existingFactura?.id ?? null

  if (!facturaId) {
    // Pull pedido items
    const { data: pedidoItems } = await supabase
      .from('pedido_items')
      .select('*, presentacion:presentaciones(nombre)')
      .eq('pedido_id', params.id)

    const facturaItemsData = (pedidoItems ?? []).map((pi: any) => ({
      presentacion_id: pi.presentacion_id,
      descripcion: pi.presentacion?.nombre ?? 'Artículo',
      cantidad: pi.cantidad,
      precio_unitario: pi.precio_unitario,
      descuento: pi.descuento ?? 0,
      subtotal: pi.subtotal,
    }))

    // Generate factura number
    const { data: seqData } = await supabase.rpc('get_next_sequence', { seq_name: 'facturas' })

    const { data: nuevaFactura, error: facturaError } = await supabase
      .from('facturas')
      .insert({
        numero: seqData,
        pedido_id: params.id,
        cliente_id: pedido.cliente_id,
        vendedor_id: pedido.vendedor_id ?? null,
        estado: 'emitida',
        fecha_emision: new Date().toISOString().split('T')[0],
        subtotal: pedido.subtotal,
        descuento: pedido.descuento ?? 0,
        base_imponible: pedido.subtotal - (pedido.descuento ?? 0),
        tasa_impuesto: 0,
        impuesto: 0,
        total: pedido.total,
        monto_pagado: 0,
        notas: null,
      })
      .select()
      .single()

    if (facturaError || !nuevaFactura) {
      return NextResponse.json({ error: facturaError?.message ?? 'Error al crear factura' }, { status: 500 })
    }

    // Insert factura items
    if (facturaItemsData.length > 0) {
      await supabase.from('factura_items').insert(
        facturaItemsData.map((i: any) => ({ ...i, factura_id: nuevaFactura.id }))
      )
    }

    facturaId = nuevaFactura.id
  }

  // Update pedido to despachado
  const { data, error } = await supabase
    .from('pedidos')
    .update({ estado: 'despachado', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, factura_id: facturaId })
}
