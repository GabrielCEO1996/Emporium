import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAdminOrVendedor } from '@/lib/auth'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    // Staff-only — a comprador/cliente has no business listing the cliente book.
    const gate = await requireAdminOrVendedor(supabase)
    if (!gate.ok) return gate.response

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const activo = searchParams.get('activo')
    const page  = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = (page - 1) * limit

    let query = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('nombre', { ascending: true })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(
        `nombre.ilike.%${search}%,rif.ilike.%${search}%,ciudad.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    if (activo !== null && activo !== '') {
      query = query.eq('activo', activo === 'true')
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, total: count ?? 0, page, limit })
  } catch (err: any) {
    console.error('[GET /api/clientes]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    // Staff-only — creating customer records is a back-office action.
    const gate = await requireAdminOrVendedor(supabase)
    if (!gate.ok) return gate.response

    const body = await request.json()

    if (!body.nombre || typeof body.nombre !== 'string' || body.nombre.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre del cliente es requerido' },
        { status: 400 }
      )
    }

    const limiteCredito = Math.max(0, Math.min(1e9, Number(body.limite_credito) || 0))
    const diasCredito   = Math.max(0, Math.min(365,  Number(body.dias_credito)   || 0))

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
      activo: body.activo !== undefined ? Boolean(body.activo) : true,
      notas: body.notas?.trim() || null,
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert(clienteData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/clientes]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
