import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET: list all inventario records with product + presentacion info
export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { data, error } = await supabase
    .from('inventario')
    .select(`
      id, stock_total, stock_reservado, stock_disponible, precio_venta, precio_costo, updated_at,
      presentacion:presentaciones(id, nombre, unidad, codigo_barras),
      producto:productos(id, codigo, nombre, imagen_url, categoria)
    `)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST: manual stock adjustment
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const body = await req.json()
  const { inventario_id, tipo, cantidad, notas, precio_venta, precio_costo } = body

  if (!inventario_id || !tipo || cantidad == null) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }
  if (!['entrada', 'salida', 'ajuste'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  if (cantidad < 0) {
    return NextResponse.json({ error: 'La cantidad debe ser positiva' }, { status: 400 })
  }

  // Get current stock
  const { data: inv } = await supabase
    .from('inventario')
    .select('stock_total, stock_reservado, presentacion_id, producto_id, precio_venta, precio_costo')
    .eq('id', inventario_id)
    .single()

  if (!inv) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })

  const stock_anterior = inv.stock_total
  let nuevo_total: number

  if (tipo === 'entrada') nuevo_total = stock_anterior + cantidad
  else if (tipo === 'salida') nuevo_total = Math.max(inv.stock_reservado, stock_anterior - cantidad)
  else nuevo_total = Math.max(inv.stock_reservado, cantidad) // ajuste: set absolute value, can't go below reservado

  // Build update payload
  const updatePayload: Record<string, any> = {
    stock_total: nuevo_total,
    updated_at: new Date().toISOString(),
  }

  const venta = typeof precio_venta === 'number' && Number.isFinite(precio_venta) && precio_venta >= 0
    ? precio_venta
    : null
  const costo = typeof precio_costo === 'number' && Number.isFinite(precio_costo) && precio_costo >= 0
    ? precio_costo
    : null

  if (venta !== null) updatePayload.precio_venta = venta
  if (costo !== null) updatePayload.precio_costo = costo

  // Update inventario
  const { error: updateError } = await supabase
    .from('inventario')
    .update(updatePayload)
    .eq('id', inventario_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Also sync presentaciones.stock/precio/costo for backward compatibility
  const presUpdate: Record<string, any> = {
    stock: nuevo_total,
    updated_at: new Date().toISOString(),
  }
  if (venta !== null) presUpdate.precio = venta
  if (costo !== null) presUpdate.costo = costo
  await supabase
    .from('presentaciones')
    .update(presUpdate)
    .eq('id', inv.presentacion_id)

  // Log movement
  await supabase.from('inventario_movimientos').insert({
    producto_id: inv.producto_id,
    presentacion_id: inv.presentacion_id,
    tipo: tipo === 'ajuste' ? 'ajuste' : tipo === 'entrada' ? 'entrada' : 'salida',
    cantidad,
    stock_anterior,
    stock_nuevo: nuevo_total,
    referencia_tipo: 'ajuste_manual',
    usuario_id: user.id,
    notas: notas ?? null,
  })

  return NextResponse.json({
    ok: true,
    stock_total: nuevo_total,
    precio_venta: venta ?? inv.precio_venta,
    precio_costo: costo ?? inv.precio_costo,
  })
}
