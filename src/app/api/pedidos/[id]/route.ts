import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      clientes(*),
      conductores(*),
      profiles!pedidos_vendedor_id_fkey(id, nombre, email),
      pedido_items(
        *,
        presentaciones(
          *,
          productos(id, nombre, categoria)
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('pedidos')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('estado')
    .eq('id', params.id)
    .single()

  if (pedido?.estado === 'facturado') {
    return NextResponse.json({ error: 'No se puede eliminar un pedido facturado' }, { status: 409 })
  }

  const { error } = await supabase.from('pedidos').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
