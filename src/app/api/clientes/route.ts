import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const activo = searchParams.get('activo')

    let query = supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true })

    if (search) {
      query = query.or(
        `nombre.ilike.%${search}%,rif.ilike.%${search}%,ciudad.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    if (activo !== null && activo !== '') {
      query = query.eq('activo', activo === 'true')
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
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
