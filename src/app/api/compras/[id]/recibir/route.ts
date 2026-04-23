import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  // Validate compra exists and is in borrador
  const { data: compra } = await supabase
    .from('compras')
    .select('id, estado, items:compra_items(id, presentacion_id, cantidad, precio_costo, presentaciones(producto_id))')
    .eq('id', params.id)
    .single()

  if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
  if (compra.estado !== 'borrador') {
    return NextResponse.json({ error: 'Solo se pueden recibir compras en estado borrador' }, { status: 400 })
  }

  const items: any[] = compra.items ?? []

  // Update stock and inventario for each item
  await Promise.all(items.map(async (item: any) => {
    const productoId: string | null = item.presentaciones?.producto_id ?? null

    // ── Update presentaciones.stock (backward-compat) ────────────────────────
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

    // ── Upsert inventario ────────────────────────────────────────────────────
    const { data: inv } = await supabase
      .from('inventario')
      .select('id, stock_total')
      .eq('presentacion_id', item.presentacion_id)
      .maybeSingle()

    if (inv) {
      // Update existing record
      const nuevoTotal = (inv.stock_total ?? 0) + item.cantidad
      await supabase
        .from('inventario')
        .update({ stock_total: nuevoTotal })
        .eq('id', inv.id)

      // Log movement
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
        notas: 'Compra recibida',
      })
    } else if (productoId) {
      // Insert new inventario record
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

  // Mark compra as recibida
  const { data, error } = await supabase
    .from('compras')
    .update({ estado: 'recibida', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
