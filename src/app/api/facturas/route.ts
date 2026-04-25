import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAdminOrVendedor, requireUser } from '@/lib/auth'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── GET /api/facturas ───────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    // AUTH: any authenticated user. Non-staff callers are scoped below to
    // their own cliente.user_id so they cannot enumerate the factura book.
    const gate = await requireUser(supabase)
    if (!gate.ok) return gate.response
    const { user, profile } = gate

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

    // Role-based scoping: non-staff callers only see their own facturas.
    // - vendedor:   their own sales
    // - comprador / cliente:  only facturas where cliente.user_id === user.id
    if (profile.rol === 'vendedor') {
      query = query.eq('vendedor_id', user.id)
    } else if (profile.rol === 'comprador' || profile.rol === 'cliente') {
      const { data: ownCliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!ownCliente) {
        return NextResponse.json({ data: [], total: 0, page, limit })
      }
      query = query.eq('cliente_id', ownCliente.id)
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

    // AUTH: staff only. Creating a factura inserts into facturas + factura_items
    // and must not be reachable by comprador/cliente accounts.
    const gate = await requireAdminOrVendedor(supabase)
    if (!gate.ok) return gate.response

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

    // Calculate totals — recompute server-side; clamp negatives to block tampering.
    const itemsWithSubtotals = facturaItems.map((item: any) => {
      const cantidad = Math.max(0, Number(item.cantidad ?? 0))
      const precio_unitario = Math.max(0, Number(item.precio_unitario ?? 0))
      const descuentoPct = Math.max(0, Math.min(100, Number(item.descuento ?? 0)))
      const basePrice = precio_unitario * cantidad
      const discountAmount = basePrice * (descuentoPct / 100)
      const subtotal = Math.max(0, basePrice - discountAmount)
      return { ...item, cantidad, precio_unitario, descuento: descuentoPct, subtotal }
    })

    const subtotal = itemsWithSubtotals.reduce((sum: number, i: any) => sum + i.subtotal, 0)
    // Clamp the global discount to [0, subtotal] so a tampered request can't
    // create a factura with negative base_imponible / total.
    const safeGlobalDescuento = Math.min(
      subtotal,
      Math.max(0, Number(globalDescuento) || 0)
    )
    const base_imponible = Math.max(0, subtotal - safeGlobalDescuento)
    const impuesto = 0
    const total = base_imponible

    // Generate invoice number atomically via PostgreSQL sequence (no race condition)
    const { data: seqData, error: seqError } = await supabase
      .rpc('get_next_sequence', { seq_name: 'facturas' })
    if (seqError) {
      console.error('[POST /api/facturas] sequence:', seqError)
      return NextResponse.json({ error: 'No se pudo generar el número de factura' }, { status: 500 })
    }
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
        descuento: safeGlobalDescuento,
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

    // ─── Record price memory ─────────────────────────────────────────────────
    // One row per line into historial_precios_cliente so Mache can see the
    // exact last price sold to this cliente for each producto next time.
    // We need producto_id, which is not on factura_items — look it up from
    // presentaciones in one batch.
    try {
      const presIds = Array.from(
        new Set(itemsWithSubtotals.map((i: any) => i.presentacion_id).filter(Boolean))
      )
      if (presIds.length > 0) {
        const { data: presRows } = await supabase
          .from('presentaciones')
          .select('id, producto_id')
          .in('id', presIds)
        const productoByPres: Record<string, string> = {}
        for (const p of presRows ?? []) {
          productoByPres[(p as any).id] = (p as any).producto_id
        }

        const historialRows = itemsWithSubtotals
          .map((it: any) => {
            const producto_id = productoByPres[it.presentacion_id]
            if (!producto_id) return null
            return {
              cliente_id,
              producto_id,
              presentacion_id: it.presentacion_id,
              precio_vendido: it.precio_unitario,
              cantidad: it.cantidad,
              fecha: factura.fecha_emision,
              factura_id: factura.id,
              pedido_id: pedido_id ?? null,
            }
          })
          .filter(Boolean)

        if (historialRows.length > 0) {
          // Non-fatal: failure here should NOT roll back the factura.
          const { error: histErr } = await supabase
            .from('historial_precios_cliente')
            .insert(historialRows)
          if (histErr) {
            console.warn('[POST /api/facturas] historial_precios insert failed:', histErr.message)
          }
        }
      }
    } catch (histErr) {
      // Never block the factura creation on price-memory errors.
      console.warn('[POST /api/facturas] historial_precios non-fatal error:', histErr)
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
