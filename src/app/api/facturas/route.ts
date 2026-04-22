import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ─── GET /api/facturas ───────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)

    const estado = searchParams.get('estado') || ''
    const desde = searchParams.get('desde') || ''
    const hasta = searchParams.get('hasta') || ''
    const clienteId = searchParams.get('cliente_id') || ''
    const clienteNombre = searchParams.get('cliente') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit

    let query = supabase
      .from('facturas')
      .select('*, cliente:clientes(id, nombre, rif)', { count: 'exact' })
      .order('fecha_emision', { ascending: false })
      .range(offset, offset + limit - 1)

    if (estado) {
      query = query.eq('estado', estado)
    }
    if (desde) {
      query = query.gte('fecha_emision', desde)
    }
    if (hasta) {
      query = query.lte('fecha_emision', hasta)
    }
    if (clienteId) {
      query = query.eq('cliente_id', clienteId)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Client-side name filter (since Supabase doesn't easily filter on joined table columns)
    let filtered = data ?? []
    if (clienteNombre) {
      filtered = filtered.filter((f: any) =>
        f.cliente?.nombre?.toLowerCase().includes(clienteNombre.toLowerCase())
      )
    }

    return NextResponse.json({
      data: filtered,
      total: count ?? filtered.length,
      page,
      limit,
    })
  } catch (err) {
    console.error('[GET /api/facturas]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST /api/facturas ──────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()

    const {
      pedido_id,
      cliente_id,
      vendedor_id,
      fecha_emision,
      fecha_vencimiento,
      notas,
      items, // array of { presentacion_id, descripcion, cantidad, precio_unitario, descuento }
      tasa_impuesto = 0,
      descuento: globalDescuento = 0,
    } = body

    if (!cliente_id) {
      return NextResponse.json({ error: 'cliente_id es requerido' }, { status: 400 })
    }

    // If pedido_id provided, pull items from that pedido
    let facturaItems: any[] = items ?? []

    if (pedido_id && (!items || items.length === 0)) {
      const { data: pedidoItems, error: pedidoError } = await supabase
        .from('pedido_items')
        .select('*, presentacion:presentaciones(nombre)')
        .eq('pedido_id', pedido_id)

      if (pedidoError) {
        return NextResponse.json({ error: pedidoError.message }, { status: 500 })
      }

      facturaItems = (pedidoItems ?? []).map((pi: any) => ({
        presentacion_id: pi.presentacion_id,
        descripcion: pi.presentacion?.nombre ?? 'Artículo',
        cantidad: pi.cantidad,
        precio_unitario: pi.precio_unitario,
        descuento: pi.descuento ?? 0,
        subtotal: pi.subtotal,
      }))
    }

    if (facturaItems.length === 0) {
      return NextResponse.json(
        { error: 'La factura debe tener al menos un artículo' },
        { status: 400 }
      )
    }

    // Calculate totals
    const itemsWithSubtotals = facturaItems.map((item) => {
      const basePrice = item.precio_unitario * item.cantidad
      const discountAmount = basePrice * ((item.descuento ?? 0) / 100)
      const subtotal = item.subtotal ?? basePrice - discountAmount
      return { ...item, subtotal }
    })

    const subtotal = itemsWithSubtotals.reduce((sum: number, i: any) => sum + i.subtotal, 0)
    const base_imponible = subtotal - globalDescuento
    const impuesto = 0
    const total = base_imponible

    // Generate invoice number atomically via PostgreSQL sequence (no race condition)
    const { data: seqData, error: seqError } = await supabase
      .rpc('get_next_sequence', { seq_name: 'facturas' })
    if (seqError) return NextResponse.json({ error: seqError.message }, { status: 500 })
    const numero = seqData

    // Create factura
    const { data: factura, error: facturaError } = await supabase
      .from('facturas')
      .insert({
        numero,
        pedido_id: pedido_id ?? null,
        cliente_id,
        vendedor_id: vendedor_id ?? null,
        estado: 'emitida',
        fecha_emision: fecha_emision ?? new Date().toISOString().split('T')[0],
        fecha_vencimiento: fecha_vencimiento ?? null,
        subtotal,
        descuento: globalDescuento,
        base_imponible,
        tasa_impuesto,
        impuesto,
        total,
        monto_pagado: 0,
        notas: notas ?? null,
      })
      .select()
      .single()

    if (facturaError) {
      return NextResponse.json({ error: facturaError.message }, { status: 500 })
    }

    // Insert factura items
    const itemsToInsert = itemsWithSubtotals.map((item: any) => ({
      factura_id: factura.id,
      presentacion_id: item.presentacion_id,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      descuento: item.descuento ?? 0,
      subtotal: item.subtotal,
    }))

    const { error: itemsError } = await supabase
      .from('factura_items')
      .insert(itemsToInsert)

    if (itemsError) {
      // Rollback: delete the created factura
      await supabase.from('facturas').delete().eq('id', factura.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // If from a pedido, mark pedido as facturado
    if (pedido_id) {
      await supabase
        .from('pedidos')
        .update({ estado: 'facturado', updated_at: new Date().toISOString() })
        .eq('id', pedido_id)
    }

    return NextResponse.json(factura, { status: 201 })
  } catch (err) {
    console.error('[POST /api/facturas]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
