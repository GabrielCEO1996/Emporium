import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, requireRole, sanitize, clean, safeInt, validateUUID, logActivity } from '@/lib/security'

// ── GET /api/productos/[id] ───────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const idError = validateUUID(params.id, 'ID de producto')
  if (idError) return idError

  const supabase = createClient()
  const { ctx, error } = await getAuthContext(supabase)
  if (error) return error

  const isAdmin = ctx.rol === 'admin'
  const invFields = isAdmin
    ? 'stock_total, stock_reservado, stock_disponible, precio_venta, precio_costo, updated_at'
    : 'stock_total, stock_reservado, stock_disponible, precio_venta, updated_at'

  const { data, error: dbError } = await supabase
    .from('productos')
    .select(
      `id, codigo, nombre, descripcion, categoria, imagen_url, activo, created_at, updated_at,
       presentaciones(
         id, nombre, unidad, codigo_barras, activo, stock_minimo,
         inventario(${invFields})
       )`,
    )
    .eq('id', params.id)
    .single()

  if (dbError) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  return NextResponse.json(data)
}

// ── PUT /api/productos/[id] ───────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const idError = validateUUID(params.id, 'ID de producto')
  if (idError) return idError

  const supabase = createClient()
  const { ctx, error } = await getAuthContext(supabase)
  if (error) return error

  const denied = requireRole(ctx, ['admin'])
  if (denied) return denied

  const body = await request.json()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.nombre !== undefined)      updates.nombre      = sanitize(body.nombre, 200)
  if (body.codigo !== undefined)      updates.codigo      = sanitize(body.codigo, 50) || null
  if (body.descripcion !== undefined) updates.descripcion = clean(body.descripcion, 2000) || null
  if (body.categoria !== undefined)   updates.categoria   = sanitize(body.categoria, 100) || null
  if (body.activo !== undefined)      updates.activo      = Boolean(body.activo)
  if (body.imagen_url !== undefined)  updates.imagen_url  = clean(body.imagen_url, 500) || null

  if (updates.nombre === '') {
    return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
  }

  const { data: producto, error: updateError } = await supabase
    .from('productos')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Upsert presentaciones (catalog fields only — precio/stock live on inventario).
  if (Array.isArray(body.presentaciones) && body.presentaciones.length > 0) {
    const toUpsert = body.presentaciones.map((p: any) => {
      const fields: Record<string, unknown> = {
        producto_id:  params.id,
        nombre:       sanitize(p.nombre ?? '', 200),
        unidad:       sanitize(p.unidad ?? 'unidad', 50),
        codigo_barras: clean(p.codigo_barras, 80) || null,
        stock_minimo: safeInt(p.stock_minimo, 0),
        activo:       typeof p.activo === 'boolean' ? p.activo : true,
        updated_at:   new Date().toISOString(),
      }
      if (p.id) fields.id = p.id
      return fields
    })

    const { data: upserted, error: upsertError } = await supabase
      .from('presentaciones')
      .upsert(toUpsert, { onConflict: 'id' })
      .select('id')

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

    // Ensure every presentacion has an inventario row (seed when missing).
    const presIds = (upserted ?? []).map((r: { id: string }) => r.id)
    if (presIds.length > 0) {
      const { data: existingInv } = await supabase
        .from('inventario')
        .select('presentacion_id')
        .in('presentacion_id', presIds)

      const have = new Set((existingInv ?? []).map((r: any) => r.presentacion_id))
      const missing = presIds.filter((id) => !have.has(id))
      if (missing.length > 0) {
        await supabase.from('inventario').insert(
          missing.map((presentacion_id) => ({
            producto_id: params.id,
            presentacion_id,
            stock_total: 0,
            stock_reservado: 0,
            precio_venta: 0,
            precio_costo: 0,
          })),
        )
      }
    }
  }

  logActivity(supabase, {
    userId:     ctx.userId,
    action:     'actualizar_producto',
    resource:   'productos',
    resourceId: params.id,
    details:    { cambios: Object.keys(updates) },
  })

  const { data: full } = await supabase
    .from('productos')
    .select('*, presentaciones(*, inventario(*))')
    .eq('id', params.id)
    .single()

  return NextResponse.json(full)
}

// ── DELETE /api/productos/[id] ────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const idError = validateUUID(params.id, 'ID de producto')
  if (idError) return idError

  const supabase = createClient()
  const { ctx, error } = await getAuthContext(supabase)
  if (error) return error

  const denied = requireRole(ctx, ['admin'])
  if (denied) return denied

  // Delete presentations first (FK constraint)
  const { error: presError } = await supabase
    .from('presentaciones')
    .delete()
    .eq('producto_id', params.id)

  if (presError) return NextResponse.json({ error: presError.message }, { status: 500 })

  const { error: delError } = await supabase
    .from('productos')
    .delete()
    .eq('id', params.id)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  logActivity(supabase, {
    userId:     ctx.userId,
    action:     'eliminar_producto',
    resource:   'productos',
    resourceId: params.id,
  })

  return NextResponse.json({ success: true })
}
