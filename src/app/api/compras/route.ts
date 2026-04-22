import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const proveedorId = url.searchParams.get('proveedor_id')
  const desde = url.searchParams.get('desde')
  const hasta = url.searchParams.get('hasta')

  let query = supabase
    .from('compras')
    .select(`
      *,
      proveedor:proveedores(id, nombre, empresa),
      items:compra_items(
        id, cantidad, precio_costo, subtotal,
        presentacion:presentaciones(id, nombre, productos(nombre))
      )
    `)
    .order('fecha', { ascending: false })

  if (proveedorId) query = query.eq('proveedor_id', proveedorId)
  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const body = await req.json()
  const { proveedor_id, fecha, notas, items } = body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Debes agregar al menos un producto' }, { status: 400 })
  }

  // Validate items
  for (const item of items) {
    if (!item.presentacion_id || !item.cantidad || !item.precio_costo) {
      return NextResponse.json({ error: 'Todos los items deben tener presentación, cantidad y costo' }, { status: 400 })
    }
  }

  const total = items.reduce(
    (sum: number, i: any) => sum + Number(i.cantidad) * Number(i.precio_costo), 0
  )

  // Create compra
  const { data: compra, error: compraError } = await supabase
    .from('compras')
    .insert({
      proveedor_id: proveedor_id || null,
      fecha: fecha || new Date().toISOString().split('T')[0],
      total,
      estado: 'recibida',
      notas: notas?.trim() || null,
    })
    .select()
    .single()

  if (compraError || !compra) {
    return NextResponse.json({ error: compraError?.message ?? 'Error al crear compra' }, { status: 500 })
  }

  // Create items
  const itemsToInsert = items.map((i: any) => ({
    compra_id: compra.id,
    presentacion_id: i.presentacion_id,
    cantidad: Number(i.cantidad),
    precio_costo: Number(i.precio_costo),
  }))

  const { error: itemsError } = await supabase.from('compra_items').insert(itemsToInsert)
  if (itemsError) {
    // Rollback compra
    await supabase.from('compras').delete().eq('id', compra.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Update stock for each item
  for (const item of items) {
    await supabase.rpc('increment_stock', {
      p_id: item.presentacion_id,
      p_amount: Number(item.cantidad),
    }).then(({ error }) => {
      if (error) {
        // Fallback: manual update
        supabase
          .from('presentaciones')
          .select('stock')
          .eq('id', item.presentacion_id)
          .single()
          .then(({ data: pres }) => {
            if (pres) {
              supabase
                .from('presentaciones')
                .update({ stock: (pres.stock ?? 0) + Number(item.cantidad) })
                .eq('id', item.presentacion_id)
            }
          })
      }
    })
  }

  // Also update costo in presentaciones to the new purchase cost
  for (const item of items) {
    await supabase
      .from('presentaciones')
      .update({ costo: Number(item.precio_costo) })
      .eq('id', item.presentacion_id)
  }

  return NextResponse.json(compra, { status: 201 })
}
