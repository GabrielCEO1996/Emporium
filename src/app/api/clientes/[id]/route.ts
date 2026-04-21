import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
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
      activo: Boolean(body.activo),
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Cliente eliminado exitosamente' })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
