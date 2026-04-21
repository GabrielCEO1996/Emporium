import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('productos')
    .select(`
      *,
      presentaciones (*)
    `)
    .order('nombre')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const body = await request.json()
  const { nombre, descripcion, categoria, activo, imagen_url, presentaciones } = body

  if (!nombre) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  const { data: producto, error: productoError } = await supabase
    .from('productos')
    .insert({ nombre, descripcion, categoria, activo: activo ?? true, imagen_url })
    .select()
    .single()

  if (productoError) {
    return NextResponse.json({ error: productoError.message }, { status: 500 })
  }

  if (presentaciones && presentaciones.length > 0) {
    const presentacionesData = presentaciones.map((p: Record<string, unknown>) => ({
      ...p,
      producto_id: producto.id,
    }))

    const { error: presentacionesError } = await supabase
      .from('presentaciones')
      .insert(presentacionesData)

    if (presentacionesError) {
      await supabase.from('productos').delete().eq('id', producto.id)
      return NextResponse.json({ error: presentacionesError.message }, { status: 500 })
    }
  }

  const { data: full } = await supabase
    .from('productos')
    .select('*, presentaciones(*)')
    .eq('id', producto.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}
