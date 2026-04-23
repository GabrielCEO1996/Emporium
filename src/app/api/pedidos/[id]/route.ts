import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pedidos/[id]
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      clientes(*),
      conductores(*),
      profiles!pedidos_vendedor_id_fkey(id, nombre, email),
      pedido_items(
        *,
        presentaciones(
          *,
          productos(id, nombre, categoria)
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Vendedores can only see their own pedidos
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol === 'vendedor' && data.vendedor_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  return NextResponse.json(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/pedidos/[id]  — edit safe fields (not estado; use PATCH for estado)
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  const isAdmin = profile?.rol === 'admin'

  const body = await request.json()

  const { data: current } = await supabase.from('pedidos').select('estado, vendedor_id').eq('id', params.id).single()
  if (!current) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  if (profile?.rol === 'vendedor') {
    if (current.vendedor_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    if (current.estado !== 'borrador') {
      return NextResponse.json({ error: 'Solo puedes editar pedidos en borrador' }, { status: 403 })
    }
  }

  if (current.estado !== 'borrador' && !isAdmin) {
    return NextResponse.json({ error: 'Solo administradores pueden modificar pedidos confirmados' }, { status: 403 })
  }

  // Only safe fields; estado changes go through PATCH
  const allowed = ['notas', 'conductor_id', 'direccion_entrega', 'fecha_entrega_estimada', 'fecha_entrega_real']

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase
    .from('pedidos')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/pedidos/[id]  — estado router
//
//   Body: { estado: 'confirmada' | 'aprobada' | 'despachada' | 'entregada' | 'cancelada' }
//
//   Transitions & permissions:
//     borrador   → confirmada   (vendedor own pedido, or admin) — no inventory change
//     confirmada → aprobada     (admin only) — reserves inventory (stock_reservado +=)
//     aprobada   → despachada   (admin only) — creates factura (estado='emitida')
//     despachada → entregada    (admin only) — deducts inventory (stock_total -=, stock_reservado -=)
//     *          → cancelada    (admin any except entregada; vendedor only own borrador)
//                                — if aprobada/despachada, releases reservation
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  const isAdmin = profile?.rol === 'admin'
  const isVendedor = profile?.rol === 'vendedor'

  const body = await request.json().catch(() => ({}))
  const { estado: nuevoEstado } = body as { estado?: string }

  const validStates = ['confirmada', 'aprobada', 'despachada', 'entregada', 'cancelada']
  if (!nuevoEstado || !validStates.includes(nuevoEstado)) {
    return NextResponse.json(
      { error: `Estado inválido. Valores permitidos: ${validStates.join(' | ')}` },
      { status: 400 }
    )
  }

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, estado, cliente_id, vendedor_id, subtotal, descuento, total')
    .eq('id', params.id)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const estadoActual: string = pedido.estado

  // ── Helper: fetch items with presentacion.producto_id ─────────────────────
  const fetchItems = async () => {
    const { data: items } = await supabase
      .from('pedido_items')
      .select('presentacion_id, cantidad, presentaciones(producto_id)')
      .eq('pedido_id', params.id)
    return items ?? []
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // borrador → confirmada   (vendedor own or admin; no inventory)
  // ═══════════════════════════════════════════════════════════════════════════
  if (nuevoEstado === 'confirmada') {
    if (isVendedor && pedido.vendedor_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (!isAdmin && !isVendedor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (estadoActual !== 'borrador') {
      return NextResponse.json(
        { error: `Solo se pueden confirmar pedidos en borrador (estado actual: ${estadoActual})` },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado: 'confirmada', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // confirmada → aprobada   (admin only; RESERVES inventory)
  // ═══════════════════════════════════════════════════════════════════════════
  if (nuevoEstado === 'aprobada') {
    if (!isAdmin) {
      return NextResponse.json({ error: 'Solo administradores pueden aprobar pedidos' }, { status: 403 })
    }
    if (estadoActual !== 'confirmada') {
      return NextResponse.json(
        { error: `Solo se pueden aprobar pedidos confirmados (estado actual: ${estadoActual})` },
        { status: 400 }
      )
    }

    const items = await fetchItems()

    await Promise.all(items.map(async (item: any) => {
      const productoId = item.presentaciones?.producto_id ?? null

      const { data: inv } = await supabase
        .from('inventario')
        .select('id, stock_total, stock_reservado, producto_id')
        .eq('presentacion_id', item.presentacion_id)
        .maybeSingle()

      if (inv) {
        const nuevoReservado = (inv.stock_reservado ?? 0) + item.cantidad
        await supabase
          .from('inventario')
          .update({ stock_reservado: nuevoReservado })
          .eq('id', inv.id)

        await supabase.from('inventario_movimientos').insert({
          producto_id: inv.producto_id ?? productoId,
          presentacion_id: item.presentacion_id,
          tipo: 'reserva',
          cantidad: item.cantidad,
          stock_anterior: inv.stock_reservado ?? 0,
          stock_nuevo: nuevoReservado,
          referencia_tipo: 'pedido_aprobado',
          referencia_id: params.id,
          usuario_id: user.id,
          notas: 'Pedido aprobado — reserva de stock',
        })
      }
    }))

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // aprobada → despachada   (admin only; auto-creates factura estado='emitida')
  // ═══════════════════════════════════════════════════════════════════════════
  if (nuevoEstado === 'despachada') {
    if (!isAdmin) {
      return NextResponse.json({ error: 'Solo administradores pueden despachar pedidos' }, { status: 403 })
    }
    if (estadoActual !== 'aprobada') {
      return NextResponse.json(
        { error: `Solo se pueden despachar pedidos aprobados (estado actual: ${estadoActual})` },
        { status: 400 }
      )
    }

    // Auto-create factura if not exists
    const { data: existingFactura } = await supabase
      .from('facturas')
      .select('id')
      .eq('pedido_id', params.id)
      .maybeSingle()

    let facturaId: string | null = existingFactura?.id ?? null

    if (!facturaId) {
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
        })
        .select()
        .single()

      if (facturaError || !nuevaFactura) {
        return NextResponse.json({ error: facturaError?.message ?? 'Error al crear factura' }, { status: 500 })
      }

      if (facturaItemsData.length > 0) {
        await supabase.from('factura_items').insert(
          facturaItemsData.map((i) => ({ ...i, factura_id: nuevaFactura.id }))
        )
      }

      facturaId = nuevaFactura.id
    }

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado: 'despachada', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ...data, factura_id: facturaId })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // despachada → entregada   (admin only; DEDUCTS inventory)
  // ═══════════════════════════════════════════════════════════════════════════
  if (nuevoEstado === 'entregada') {
    if (!isAdmin) {
      return NextResponse.json({ error: 'Solo administradores pueden entregar pedidos' }, { status: 403 })
    }
    if (!['despachada', 'despachado', 'en_ruta'].includes(estadoActual)) {
      return NextResponse.json(
        { error: `Solo se pueden entregar pedidos despachados (estado actual: ${estadoActual})` },
        { status: 400 }
      )
    }

    const items = await fetchItems()

    await Promise.all(items.map(async (item: any) => {
      const { data: inv } = await supabase
        .from('inventario')
        .select('id, stock_total, stock_reservado, producto_id')
        .eq('presentacion_id', item.presentacion_id)
        .maybeSingle()

      if (inv) {
        const nuevoTotal = Math.max(0, (inv.stock_total ?? 0) - item.cantidad)
        const nuevoReservado = Math.max(0, (inv.stock_reservado ?? 0) - item.cantidad)

        await supabase
          .from('inventario')
          .update({ stock_total: nuevoTotal, stock_reservado: nuevoReservado })
          .eq('id', inv.id)

        await supabase
          .from('presentaciones')
          .update({ stock: nuevoTotal, updated_at: new Date().toISOString() })
          .eq('id', item.presentacion_id)

        await supabase.from('inventario_movimientos').insert({
          producto_id: inv.producto_id,
          presentacion_id: item.presentacion_id,
          tipo: 'salida',
          cantidad: item.cantidad,
          stock_anterior: inv.stock_total ?? 0,
          stock_nuevo: nuevoTotal,
          referencia_tipo: 'pedido_entregado',
          referencia_id: params.id,
          usuario_id: user.id,
          notas: 'Pedido entregado — salida de stock',
        })
      }
    }))

    const { data, error } = await supabase
      .from('pedidos')
      .update({
        estado: 'entregada',
        fecha_entrega_real: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // * → cancelada
  //   vendedor: only own borrador
  //   admin:    any state except entregada/entregado
  //             if aprobada/despachada → release stock_reservado
  // ═══════════════════════════════════════════════════════════════════════════
  if (nuevoEstado === 'cancelada') {
    const estadoEntregada = ['entregada', 'entregado'].includes(estadoActual)

    if (isVendedor) {
      if (pedido.vendedor_id !== user.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
      if (estadoActual !== 'borrador') {
        return NextResponse.json(
          { error: 'Los vendedores solo pueden cancelar pedidos en borrador' },
          { status: 403 }
        )
      }
    } else if (isAdmin) {
      if (estadoEntregada) {
        return NextResponse.json(
          { error: 'No se puede cancelar un pedido ya entregado' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Release reservation if inventory was reserved (aprobada / despachada)
    const requiereLiberacion = ['aprobada', 'despachada', 'despachado', 'en_ruta', 'preparando', 'confirmado'].includes(estadoActual)

    if (requiereLiberacion) {
      const items = await fetchItems()
      await Promise.all(items.map(async (item: any) => {
        const { data: inv } = await supabase
          .from('inventario')
          .select('id, stock_reservado, producto_id')
          .eq('presentacion_id', item.presentacion_id)
          .maybeSingle()

        if (inv) {
          const nuevoReservado = Math.max(0, (inv.stock_reservado ?? 0) - item.cantidad)
          await supabase
            .from('inventario')
            .update({ stock_reservado: nuevoReservado })
            .eq('id', inv.id)

          await supabase.from('inventario_movimientos').insert({
            producto_id: inv.producto_id,
            presentacion_id: item.presentacion_id,
            tipo: 'liberacion',
            cantidad: item.cantidad,
            stock_anterior: inv.stock_reservado ?? 0,
            stock_nuevo: nuevoReservado,
            referencia_tipo: 'pedido_cancelado',
            referencia_id: params.id,
            usuario_id: user.id,
            notas: 'Pedido cancelado — liberación de reserva',
          })
        }
      }))
    }

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Transición no soportada' }, { status: 400 })
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/pedidos/[id]
//   vendedor: only own borrador
//   admin:    any state except entregada/entregado (hard delete + cleanup)
//             if inventory was reserved/deducted, reverses it first
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  const isAdmin = profile?.rol === 'admin'
  const isVendedor = profile?.rol === 'vendedor'

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, estado, vendedor_id')
    .eq('id', params.id)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const estadoActual: string = pedido.estado
  const estadoEntregada = ['entregada', 'entregado'].includes(estadoActual)

  if (isVendedor) {
    if (pedido.vendedor_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (estadoActual !== 'borrador') {
      return NextResponse.json(
        { error: 'Los vendedores solo pueden eliminar pedidos en borrador' },
        { status: 403 }
      )
    }
  } else if (isAdmin) {
    if (estadoEntregada) {
      return NextResponse.json(
        { error: 'No se puede eliminar un pedido ya entregado' },
        { status: 400 }
      )
    }
  } else {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Reverse inventory reservation if applicable
  const requiereLiberacion = ['aprobada', 'despachada', 'despachado', 'en_ruta', 'preparando', 'confirmado'].includes(estadoActual)

  if (requiereLiberacion) {
    const { data: items } = await supabase
      .from('pedido_items')
      .select('presentacion_id, cantidad, presentaciones(producto_id)')
      .eq('pedido_id', params.id)

    if (items && items.length > 0) {
      await Promise.all(items.map(async (item: any) => {
        const { data: inv } = await supabase
          .from('inventario')
          .select('id, stock_reservado, producto_id')
          .eq('presentacion_id', item.presentacion_id)
          .maybeSingle()

        if (inv) {
          const nuevoReservado = Math.max(0, (inv.stock_reservado ?? 0) - item.cantidad)
          await supabase
            .from('inventario')
            .update({ stock_reservado: nuevoReservado })
            .eq('id', inv.id)

          await supabase.from('inventario_movimientos').insert({
            producto_id: inv.producto_id,
            presentacion_id: item.presentacion_id,
            tipo: 'liberacion',
            cantidad: item.cantidad,
            stock_anterior: inv.stock_reservado ?? 0,
            stock_nuevo: nuevoReservado,
            referencia_tipo: 'pedido_eliminado',
            referencia_id: params.id,
            usuario_id: user.id,
            notas: 'Pedido eliminado — liberación de reserva',
          })
        }
      }))
    }
  }

  // Delete any factura associated (only possible if not paid)
  await supabase.from('facturas').delete().eq('pedido_id', params.id)
  await supabase.from('pedido_items').delete().eq('pedido_id', params.id)

  const { error } = await supabase.from('pedidos').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
