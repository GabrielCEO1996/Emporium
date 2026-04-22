import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, requireRole, sanitize, clean, safeInt, safePositiveDecimal, validateUUID, logActivity } from '@/lib/security'

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

  const presFields = isAdmin
    ? 'id, nombre, precio, costo, stock, stock_minimo, unidad, activo, updated_at'
    : 'id, nombre, precio, stock, stock_minimo, unidad, activo'

  const { data, error: dbError } = await supabase
    .from('productos')
    .select(`id, nombre, descripcion, categoria, imagen_url, activo, created_at, updated_at, presentaciones(${presFields})`)
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

  // Bulk upsert presentations
  if (Array.isArray(body.presentaciones) && body.presentaciones.length > 0) {
    const toUpsert = body.presentaciones.map((p: any) => {
      const { producto: _prod, created_at: _c, ...fields } = p
      return {
        ...fields,
        producto_id:  params.id,
        nombre:       sanitize(fields.nombre ?? '', 200),
        precio:       safePositiveDecimal(fields.precio),
        costo:        safePositiveDecimal(fields.costo),
        stock:        safeInt(fields.stock, 0),
        stock_minimo: safeInt(fields.stock_minimo, 0),
        unidad:       sanitize(fields.unidad ?? 'unidad', 50),
        updated_at:   new Date().toISOString(),
      }
    })

    const { error: upsertError } = await supabase
      .from('presentaciones')
      .upsert(toUpsert, { onConflict: 'id' })

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })
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
    .select('*, presentaciones(*)')
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
