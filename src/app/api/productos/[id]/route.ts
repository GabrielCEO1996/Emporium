import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('productos')
    .select('*, presentaciones(*)')
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const body = await request.json()
  const { nombre, descripcion, categoria, activo, imagen_url, presentaciones } = body

  const { data: producto, error: productoError } = await supabase
    .from('productos')
    .update({ nombre, descripcion, categoria, activo, imagen_url, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (productoError) {
    return NextResponse.json({ error: productoError.message }, { status: 500 })
  }

  if (presentaciones) {
    for (const p of presentaciones) {
      if (p.id) {
        const { id, producto_id, created_at, updated_at, producto: _prod, ...fields } = p
        await supabase
          .from('presentaciones')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', id)
      } else {
        await supabase.from('presentaciones').insert({ ...p, producto_id: params.id })
      }
    }
  }

  const { data: full } = await supabase
    .from('productos')
    .select('*, presentaciones(*)')
    .eq('id', params.id)
    .single()

  return NextResponse.json(full)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { error: presError } = await supabase
    .from('presentaciones')
    .delete()
    .eq('producto_id', params.id)

  if (presError) {
    return NextResponse.json({ error: presError.message }, { status: 500 })
  }

  const { error } = await supabase
    .from('productos')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
