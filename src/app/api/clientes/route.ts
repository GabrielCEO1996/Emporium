import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()

    if (!body.nombre || body.nombre.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre del cliente es requerido' },
        { status: 400 }
      )
    }

    const clienteData = {
      nombre: body.nombre.trim(),
      rif: body.rif?.trim() || null,
      email: body.email?.trim() || null,
      telefono: body.telefono?.trim() || null,
      whatsapp: body.whatsapp?.trim() || null,
      direccion: body.direccion?.trim() || null,
      ciudad: body.ciudad?.trim() || null,
      zona: body.zona?.trim() || null,
      limite_credito: Number(body.limite_credito) || 0,
      dias_credito: Number(body.dias_credito) || 0,
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
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
