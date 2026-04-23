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
      id, stock_total, stock_reservado, stock_disponible, updated_at,
      presentacion:presentaciones(id, nombre, unidad, precio, codigo_barras),
      producto:productos(id, nombre, imagen_url, categoria)
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
  const { inventario_id, tipo, cantidad, notas } = body

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
    .select('stock_total, stock_reservado, presentacion_id, producto_id')
    .eq('id', inventario_id)
    .single()

  if (!inv) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })

  const stock_anterior = inv.stock_total
  let nuevo_total: number

  if (tipo === 'entrada') nuevo_total = stock_anterior + cantidad
  else if (tipo === 'salida') nuevo_total = Math.max(inv.stock_reservado, stock_anterior - cantidad)
  else nuevo_total = Math.max(inv.stock_reservado, cantidad) // ajuste: set absolute value, can't go below reservado

  // Update inventario
  const { error: updateError } = await supabase
    .from('inventario')
    .update({ stock_total: nuevo_total })
    .eq('id', inventario_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Also sync presentaciones.stock for backward compatibility
  await supabase
    .from('presentaciones')
    .update({ stock: nuevo_total, updated_at: new Date().toISOString() })
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

  return NextResponse.json({ ok: true, stock_total: nuevo_total })
}
