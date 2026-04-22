import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, requireRole, sanitize, clean, safeInt, safePositiveDecimal, validateUUID, logActivity } from '@/lib/security'

// ── GET /api/productos ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { ctx, error } = await getAuthContext(supabase)
  if (error) return error

  const isAdmin = ctx.rol === 'admin'

  const { searchParams } = new URL(request.url)
  const page   = Math.max(1, safeInt(searchParams.get('page'), 1))
  const limit  = Math.min(200, Math.max(1, safeInt(searchParams.get('limit'), 100)))
  const offset = (page - 1) * limit

  // Admin sees costo; everyone else does not
  const presFields = isAdmin
    ? 'id, nombre, precio, costo, stock, stock_minimo, unidad, activo, updated_at'
    : 'id, nombre, precio, stock, stock_minimo, unidad, activo'

  const { data, error: dbError, count } = await supabase
    .from('productos')
    .select(`id, nombre, descripcion, categoria, imagen_url, activo, created_at, updated_at, presentaciones(${presFields})`, { count: 'exact' })
    .order('nombre')
    .range(offset, offset + limit - 1)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ data, total: count ?? 0, page, limit })
}

// ── POST /api/productos ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { ctx, error } = await getAuthContext(supabase)
  if (error) return error

  // Only admin can create products
  const denied = requireRole(ctx, ['admin'])
  if (denied) return denied

  const body = await request.json()

  const nombre = sanitize(body.nombre, 200)
  if (!nombre) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  const productoData = {
    nombre,
    descripcion: clean(body.descripcion, 2000) || null,
    categoria:   sanitize(body.categoria, 100) || null,
    activo:      typeof body.activo === 'boolean' ? body.activo : true,
    imagen_url:  clean(body.imagen_url, 500) || null,
  }

  const { data: producto, error: productoError } = await supabase
    .from('productos')
    .insert(productoData)
    .select()
    .single()

  if (productoError) return NextResponse.json({ error: productoError.message }, { status: 500 })

  // Insert presentations if provided
  if (Array.isArray(body.presentaciones) && body.presentaciones.length > 0) {
    const presentacionesData = body.presentaciones.map((p: any) => ({
      producto_id:  producto.id,
      nombre:       sanitize(p.nombre, 200),
      precio:       safePositiveDecimal(p.precio),
      costo:        safePositiveDecimal(p.costo),
      stock:        safeInt(p.stock, 0),
      stock_minimo: safeInt(p.stock_minimo, 0),
      unidad:       sanitize(p.unidad, 50) || 'unidad',
      activo:       typeof p.activo === 'boolean' ? p.activo : true,
    }))

    const { error: presError } = await supabase.from('presentaciones').insert(presentacionesData)
    if (presError) {
      await supabase.from('productos').delete().eq('id', producto.id)
      return NextResponse.json({ error: presError.message }, { status: 500 })
    }
  }

  logActivity(supabase, {
    userId:     ctx.userId,
    action:     'crear_producto',
    resource:   'productos',
    resourceId: producto.id,
    details:    { nombre: producto.nombre },
  })

  const { data: full } = await supabase
    .from('productos')
    .select('*, presentaciones(*)')
    .eq('id', producto.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}
