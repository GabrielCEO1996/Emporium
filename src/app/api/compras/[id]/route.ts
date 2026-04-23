import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Purchase detail contains cost data — admin only
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { data, error } = await supabase
    .from('compras')
    .select(`
      *,
      proveedor:proveedores(id, nombre, empresa),
      items:compra_items(
        id, cantidad, precio_costo, subtotal,
        presentacion:presentaciones(id, nombre, stock, productos(nombre))
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/compras/[id] — ADMIN ONLY
// { estado: 'confirmada' } → borrador → confirmada (no stock change)
// { estado: 'recibida' }   → borrador|confirmada → recibida (updates inventory)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { estado } = body

  if (!estado || !['confirmada', 'recibida'].includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido. Use: confirmada | recibida' }, { status: 400 })
  }

  // Fetch compra with items
  const { data: compra } = await supabase
    .from('compras')
    .select('id, estado, items:compra_items(id, presentacion_id, cantidad, precio_costo, presentaciones(producto_id))')
    .eq('id', params.id)
    .single()

  if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })

  // Validate state transition
  if (estado === 'confirmada') {
    if (compra.estado !== 'borrador') {
      return NextResponse.json({ error: `Solo se pueden confirmar compras en borrador (estado: ${compra.estado})` }, { status: 400 })
    }
  } else if (estado === 'recibida') {
    if (!['borrador', 'confirmada'].includes(compra.estado)) {
      return NextResponse.json({ error: `Solo se pueden recibir compras en borrador o confirmada (estado: ${compra.estado})` }, { status: 400 })
    }

    // Update inventory for each item (same logic as /recibir endpoint)
    const items: any[] = compra.items ?? []
    await Promise.all(items.map(async (item: any) => {
      const productoId: string | null = (item.presentaciones as any)?.producto_id ?? null

      // Update presentaciones.stock
      const { data: pres } = await supabase
        .from('presentaciones')
        .select('stock')
        .eq('id', item.presentacion_id)
        .single()

      const newStock = (pres?.stock ?? 0) + item.cantidad
      await supabase
        .from('presentaciones')
        .update({ stock: newStock, costo: item.precio_costo, updated_at: new Date().toISOString() })
        .eq('id', item.presentacion_id)

      // Upsert inventario
      const { data: inv } = await supabase
        .from('inventario')
        .select('id, stock_total')
        .eq('presentacion_id', item.presentacion_id)
        .maybeSingle()

      if (inv) {
        const nuevoTotal = (inv.stock_total ?? 0) + item.cantidad
        await supabase.from('inventario').update({ stock_total: nuevoTotal }).eq('id', inv.id)
        await supabase.from('inventario_movimientos').insert({
          producto_id: productoId,
          presentacion_id: item.presentacion_id,
          tipo: 'entrada',
          cantidad: item.cantidad,
          stock_anterior: inv.stock_total ?? 0,
          stock_nuevo: nuevoTotal,
          referencia_tipo: 'compra',
          referencia_id: params.id,
          usuario_id: user.id,
          notas: 'Compra recibida (PATCH)',
        })
      } else if (productoId) {
        await supabase.from('inventario').insert({
          producto_id: productoId,
          presentacion_id: item.presentacion_id,
          stock_total: item.cantidad,
          stock_reservado: 0,
        })
        await supabase.from('inventario_movimientos').insert({
          producto_id: productoId,
          presentacion_id: item.presentacion_id,
          tipo: 'entrada',
          cantidad: item.cantidad,
          stock_anterior: 0,
          stock_nuevo: item.cantidad,
          referencia_tipo: 'compra',
          referencia_id: params.id,
          usuario_id: user.id,
          notas: 'Primera entrada — compra recibida',
        })
      }
    }))
  }

  // Update estado
  const { data, error } = await supabase
    .from('compras')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  // Get items to reverse stock
  const { data: compra } = await supabase
    .from('compras')
    .select('*, items:compra_items(presentacion_id, cantidad)')
    .eq('id', params.id)
    .single()

  if (!compra) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  // Only reverse stock when the compra was already received (borrador never touched stock)
  if (compra.estado !== 'recibida') {
    const { error } = await supabase.from('compras').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Reverse stock for all items in parallel
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

      // Sync inventario.stock_total
      const { data: inv } = await supabase
        .from('inventario')
        .select('id, stock_total, stock_reservado')
        .eq('presentacion_id', item.presentacion_id)
        .single()

      if (inv) {
        const nuevoTotal = Math.max(inv.stock_reservado ?? 0, (inv.stock_total ?? 0) - item.cantidad)
        await supabase
          .from('inventario')
          .update({ stock_total: nuevoTotal })
          .eq('id', inv.id)

        await supabase.from('inventario_movimientos').insert({
          producto_id: pres.producto_id,
          presentacion_id: item.presentacion_id,
          tipo: 'salida',
          cantidad: item.cantidad,
          stock_anterior: inv.stock_total,
          stock_nuevo: nuevoTotal,
          referencia_tipo: 'compra',
          referencia_id: params.id,
          usuario_id: user.id,
          notas: 'Anulación de compra',
        })
      }
    }
  }))

  // Delete compra (cascade deletes items)
  const { error } = await supabase.from('compras').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
