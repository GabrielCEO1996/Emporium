import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// ── GET /api/compras/[id] ─────────────────────────────────────────────────────
// Returns full compra with proveedor + items joined to presentaciones/productos.
// Admin only (contains cost data).

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { data, error } = await supabase
    .from('compras')
    .select(`
      *,
      proveedor:proveedores(id, nombre, empresa),
      items:compra_items(
        id, cantidad, precio_costo, subtotal,
        presentacion:presentaciones(
          id, nombre, stock,
          producto:productos(id, codigo, nombre)
        )
      )
    `)
    .eq('id', params.id)
    .maybeSingle()

  // Distinguish an actual error from "no row found".
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(data)
}

// ── PATCH /api/compras/[id] ───────────────────────────────────────────────────
// Body: { estado: 'confirmada' | 'recibida' }
//
//  'confirmada' → borrador → confirmada  (no stock change)
//  'recibida'   → borrador|confirmada → recibida
//                 For each compra_item:
//                   • Check if inventario row exists for presentacion_id
//                     - YES → UPDATE stock_total += cantidad
//                     - NO  → INSERT new inventario record
//                   • INSERT inventario_movimientos record (tipo: 'entrada')
//                   • UPDATE presentaciones.stock (backward-compat)
//
// Admin only.

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const body  = await req.json().catch(() => ({}))
  const { estado } = body as { estado?: string }

  if (!estado || !['confirmada', 'recibida'].includes(estado)) {
    return NextResponse.json(
      { error: 'Estado inválido. Valores permitidos: confirmada | recibida' },
      { status: 400 }
    )
  }

  // Fetch current compra + items (need presentacion_id and cantidad for inventory)
  const { data: compra } = await supabase
    .from('compras')
    .select(`
      id, estado,
      items:compra_items(
        id, presentacion_id, cantidad, precio_costo,
        presentacion:presentaciones(producto_id)
      )
    `)
    .eq('id', params.id)
    .single()

  if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })

  // ── Validate transition ────────────────────────────────────────────────────

  if (estado === 'confirmada' && compra.estado !== 'borrador') {
    return NextResponse.json(
      { error: `Solo se puede confirmar una compra en borrador (estado actual: ${compra.estado})` },
      { status: 400 }
    )
  }

  if (estado === 'recibida' && !['borrador', 'confirmada'].includes(compra.estado)) {
    return NextResponse.json(
      { error: `Solo se puede recibir una compra en borrador o confirmada (estado actual: ${compra.estado})` },
      { status: 400 }
    )
  }

  // ── Inventory update (only when transitioning to 'recibida') ──────────────

  if (estado === 'recibida') {
    const items: any[] = compra.items ?? []

    await Promise.all(items.map(async (item: any) => {
      const presentacionId: string = item.presentacion_id
      let productoId: string | null = (item.presentacion as any)?.producto_id ?? null
      const cantidad: number = item.cantidad

      // 1. Update presentaciones.stock (backward-compat column) +
      //    resolve producto_id directly from presentaciones if join missed it.
      const { data: pres } = await supabase
        .from('presentaciones')
        .select('stock, producto_id')
        .eq('id', presentacionId)
        .single()

      if (!productoId) productoId = (pres as any)?.producto_id ?? null

      const nuevoStockPres = (pres?.stock ?? 0) + cantidad
      await supabase
        .from('presentaciones')
        .update({ stock: nuevoStockPres, costo: item.precio_costo, updated_at: new Date().toISOString() })
        .eq('id', presentacionId)

      // 2. Check if inventario record exists for this presentacion
      const { data: inv } = await supabase
        .from('inventario')
        .select('id, stock_total')
        .eq('presentacion_id', presentacionId)
        .maybeSingle()

      if (inv) {
        // YES → UPDATE stock_total += cantidad, refresh precio_costo with latest
        const nuevoTotal = (inv.stock_total ?? 0) + cantidad
        await supabase
          .from('inventario')
          .update({
            stock_total:  nuevoTotal,
            precio_costo: Number(item.precio_costo) || 0,
            updated_at:   new Date().toISOString(),
          })
          .eq('id', inv.id)

        // INSERT inventario_movimientos
        await supabase.from('inventario_movimientos').insert({
          producto_id:    productoId,
          presentacion_id: presentacionId,
          tipo:           'entrada',
          cantidad,
          stock_anterior: inv.stock_total ?? 0,
          stock_nuevo:    nuevoTotal,
          referencia_tipo: 'compra',
          referencia_id:  params.id,
          usuario_id:     user.id,
          notas:          'Compra recibida',
        })
      } else if (productoId) {
        // NO → INSERT new inventario record with stock_total = cantidad + precio_costo
        await supabase.from('inventario').insert({
          producto_id:    productoId,
          presentacion_id: presentacionId,
          stock_total:    cantidad,
          stock_reservado: 0,
          precio_costo:   Number(item.precio_costo) || 0,
          precio_venta:   0,
        })

        // INSERT inventario_movimientos (first entry ever)
        await supabase.from('inventario_movimientos').insert({
          producto_id:    productoId,
          presentacion_id: presentacionId,
          tipo:           'entrada',
          cantidad,
          stock_anterior: 0,
          stock_nuevo:    cantidad,
          referencia_tipo: 'compra',
          referencia_id:  params.id,
          usuario_id:     user.id,
          notas:          'Primera entrada — compra recibida',
        })
      }
    }))
  }

  // ── Persist new estado ─────────────────────────────────────────────────────

  const { data, error } = await supabase
    .from('compras')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Ledger: insert gasto when compra is received
  if (estado === 'recibida') {
    await supabase.from('transacciones').insert({
      tipo: 'gasto',
      monto: data.total ?? 0,
      fecha: new Date().toISOString().split('T')[0],
      concepto: `Compra recibida${data.numero ? ` — ${data.numero}` : ''}`,
      referencia_tipo: 'compra',
      referencia_id: params.id,
      usuario_id: user.id,
    })
  }

  return NextResponse.json({ success: true, ...data })
}

// ── DELETE /api/compras/[id] ──────────────────────────────────────────────────
// Admin only. Reverses inventory only if compra was already 'recibida'.

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const { data: compra } = await supabase
    .from('compras')
    .select('*, items:compra_items(presentacion_id, cantidad)')
    .eq('id', params.id)
    .single()

  if (!compra) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  // Borrador / confirmada: just delete, no stock reversal needed
  if (compra.estado !== 'recibida') {
    const { error } = await supabase.from('compras').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Recibida: reverse inventory before deleting
  await Promise.all((compra.items ?? []).map(async (item: any) => {
    const { data: pres } = await supabase
      .from('presentaciones')
      .select('stock, producto_id')
      .eq('id', item.presentacion_id)
      .single()

    if (pres) {
      const newStock = Math.max(0, (pres.stock ?? 0) - item.cantidad)
      await supabase
        .from('presentaciones')
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', item.presentacion_id)

      const { data: inv } = await supabase
        .from('inventario')
        .select('id, stock_total, stock_reservado')
        .eq('presentacion_id', item.presentacion_id)
        .maybeSingle()

      if (inv) {
        const nuevoTotal = Math.max(inv.stock_reservado ?? 0, (inv.stock_total ?? 0) - item.cantidad)
        await supabase.from('inventario').update({ stock_total: nuevoTotal }).eq('id', inv.id)
        await supabase.from('inventario_movimientos').insert({
          producto_id:    pres.producto_id,
          presentacion_id: item.presentacion_id,
          tipo:           'salida',
          cantidad:       item.cantidad,
          stock_anterior: inv.stock_total,
          stock_nuevo:    nuevoTotal,
          referencia_tipo: 'compra',
          referencia_id:  params.id,
          usuario_id:     user.id,
          notas:          'Anulación de compra',
        })
      }
    }
  }))

  const { error } = await supabase.from('compras').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
