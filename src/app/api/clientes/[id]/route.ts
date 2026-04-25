import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAdmin, requireAdminOrVendedor } from '@/lib/auth'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    // Staff-only — non-staff have no business reading arbitrary cliente rows.
    const gate = await requireAdminOrVendedor(supabase)
    if (!gate.ok) return gate.response

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
      }
      console.error('[GET /api/clientes/[id]]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[GET /api/clientes/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    // AUTH: admin-only. Updates to limite_credito / credito_autorizado /
    // activo are financially sensitive and must not be performed by anyone
    // other than an administrator.
    const gate = await requireAdmin(supabase)
    if (!gate.ok) return gate.response

    const body = await request.json()

    if (!body.nombre || typeof body.nombre !== 'string' || body.nombre.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre del cliente es requerido' },
        { status: 400 }
      )
    }

    // Clamp numeric fields to sane bounds to block tampering.
    const limiteCredito = Math.max(0, Math.min(1e9, Number(body.limite_credito) || 0))
    const diasCredito   = Math.max(0, Math.min(365,  Number(body.dias_credito)   || 0))
    const descuentoPct  = Math.max(0, Math.min(100,  Number(body.descuento_porcentaje) || 0))

    const clienteData = {
      nombre: body.nombre.trim(),
      rif: body.rif?.trim() || null,
      email: body.email?.trim() || null,
      telefono: body.telefono?.trim() || null,
      whatsapp: body.whatsapp?.trim() || null,
      direccion: body.direccion?.trim() || null,
      ciudad: body.ciudad?.trim() || null,
      zona: body.zona?.trim() || null,
      limite_credito: limiteCredito,
      dias_credito: diasCredito,
      descuento_porcentaje: descuentoPct,
      activo: Boolean(body.activo),
      credito_autorizado: Boolean(body.credito_autorizado),
      notas: body.notas?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('clientes')
      .update(clienteData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
      }
      console.error('[PUT /api/clientes/[id]]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[PUT /api/clientes/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    // AUTH: admin-only.
    const gate = await requireAdmin(supabase)
    if (!gate.ok) return gate.response

    // Check if client has associated orders
    const { count } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', params.id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar el cliente porque tiene pedidos asociados' },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('[DELETE /api/clientes/[id]]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Cliente eliminado exitosamente' })
  } catch (err: any) {
    console.error('[DELETE /api/clientes/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
