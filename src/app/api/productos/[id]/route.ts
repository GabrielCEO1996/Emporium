import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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

  // Bulk upsert instead of N+1 loop
  if (presentaciones && presentaciones.length > 0) {
    const toUpsert = presentaciones.map((p: any) => {
      const { producto: _prod, created_at: _c, ...fields } = p
      return {
        ...fields,
        producto_id: params.id,
        updated_at: new Date().toISOString(),
      }
    })
    const { error: upsertError } = await supabase
      .from('presentaciones')
      .upsert(toUpsert, { onConflict: 'id' })
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
