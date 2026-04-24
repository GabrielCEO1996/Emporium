import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, requireRole, sanitize, clean, safeInt, logActivity } from '@/lib/security'

// ─── codigo (SKU) helpers ────────────────────────────────────────────────────
// Format: PRD-0001. When the caller omits it, we find the max existing
// PRD-XXXX and increment. Collisions still throw at the DB unique constraint.

async function nextCodigo(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from('productos')
    .select('codigo')
    .like('codigo', 'PRD-%')
    .order('codigo', { ascending: false })
    .limit(1)

  const last = (data?.[0] as { codigo?: string | null } | undefined)?.codigo ?? null
  const lastNum = last ? Number(last.replace(/^PRD-/, '')) : 0
  const next = Number.isFinite(lastNum) ? lastNum + 1 : 1
  return `PRD-${String(next).padStart(4, '0')}`
}

// ─── GET /api/productos ──────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { ctx, error } = await getAuthContext(supabase)
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page   = Math.max(1, safeInt(searchParams.get('page'), 1))
  const limit  = Math.min(200, Math.max(1, safeInt(searchParams.get('limit'), 100)))
  const offset = (page - 1) * limit

  // Catalog-only fields on productos. Pricing + stock come from inventario.
  // Everyone sees precio_venta; only admin sees precio_costo.
  const isAdmin = ctx.rol === 'admin'
  const invSelect = isAdmin
    ? `stock_total, stock_reservado, stock_disponible, precio_venta, precio_costo, numero_lote, fecha_vencimiento, updated_at`
    : `stock_total, stock_reservado, stock_disponible, precio_venta, numero_lote, fecha_vencimiento, updated_at`

  const { data, error: dbError, count } = await supabase
    .from('productos')
    .select(
      `id, codigo, nombre, descripcion, categoria, imagen_url, activo,
       tiene_vencimiento, stock_minimo, precio_venta_sugerido,
       created_at, updated_at,
       presentaciones(
         id, nombre, unidad, codigo_barras, activo, stock_minimo,
         inventario(${invSelect})
       )`,
      { count: 'exact' },
    )
    .order('nombre')
    .range(offset, offset + limit - 1)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ data, total: count ?? 0, page, limit })
}

// ─── POST /api/productos ─────────────────────────────────────────────────────
// Creates the catalog row + presentaciones + seeds an inventario row per
// presentacion (stock 0, precio 0). Admin edits prices/stock in /inventario.
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { ctx, error } = await getAuthContext(supabase)
  if (error) return error

  const denied = requireRole(ctx, ['admin'])
  if (denied) return denied

  const body = await request.json()

  const nombre = sanitize(body.nombre, 200)
  if (!nombre) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  const codigo = sanitize(body.codigo ?? '', 50) || (await nextCodigo(supabase))

  const productoData = {
    codigo,
    nombre,
    descripcion: clean(body.descripcion, 2000) || null,
    categoria:   sanitize(body.categoria, 100) || null,
    activo:      typeof body.activo === 'boolean' ? body.activo : true,
    imagen_url:  clean(body.imagen_url, 500) || null,
    tiene_vencimiento:      typeof body.tiene_vencimiento === 'boolean' ? body.tiene_vencimiento : false,
    stock_minimo:           Math.max(0, safeInt(body.stock_minimo, 0)),
    precio_venta_sugerido:  Math.max(0, Number(body.precio_venta_sugerido) || 0),
  }

  const { data: producto, error: productoError } = await supabase
    .from('productos')
    .insert(productoData)
    .select()
    .single()

  if (productoError) return NextResponse.json({ error: productoError.message }, { status: 500 })

  // Insert presentaciones (catalog fields only) and seed inventario rows.
  if (Array.isArray(body.presentaciones) && body.presentaciones.length > 0) {
    const presentacionesData = body.presentaciones.map((p: any) => ({
      producto_id:  producto.id,
      nombre:       sanitize(p.nombre, 200),
      unidad:       sanitize(p.unidad, 50) || 'unidad',
      codigo_barras: clean(p.codigo_barras, 80) || null,
      stock_minimo: safeInt(p.stock_minimo, 0),
      activo:       typeof p.activo === 'boolean' ? p.activo : true,
      // Legacy columns — kept as 0 for backward compat with older read paths.
      precio: 0,
      costo:  0,
      stock:  0,
    }))

    const { data: presentacionesInserted, error: presError } = await supabase
      .from('presentaciones')
      .insert(presentacionesData)
      .select('id')

    if (presError) {
      await supabase.from('productos').delete().eq('id', producto.id)
      return NextResponse.json({ error: presError.message }, { status: 500 })
    }

    // Seed inventario rows (one per presentacion). Ignore failures silently —
    // the admin can still edit from /inventario; a missing row gets created then.
    const invRows = (presentacionesInserted ?? []).map((pr: { id: string }) => ({
      producto_id:     producto.id,
      presentacion_id: pr.id,
      stock_total:     0,
      stock_reservado: 0,
      precio_venta:    0,
      precio_costo:    0,
    }))
    if (invRows.length > 0) {
      await supabase.from('inventario').insert(invRows)
    }
  }

  logActivity(supabase, {
    userId:     ctx.userId,
    action:     'crear_producto',
    resource:   'productos',
    resourceId: producto.id,
    details:    { nombre: producto.nombre, codigo: producto.codigo },
  })

  const { data: full } = await supabase
    .from('productos')
    .select('*, presentaciones(*, inventario(*))')
    .eq('id', producto.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}
