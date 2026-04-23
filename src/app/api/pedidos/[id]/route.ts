import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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

  // Vendedores can only see their own pedidos
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol === 'vendedor' && data.vendedor_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  const isAdmin = profile?.rol === 'admin'

  const body = await request.json()

  // Fetch current pedido estado
  const { data: current } = await supabase.from('pedidos').select('estado, vendedor_id').eq('id', params.id).single()
  if (!current) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  // Vendedores: can only edit their own borrador pedidos; no price changes after borrador
  if (profile?.rol === 'vendedor') {
    if (current.vendedor_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    if (current.estado !== 'borrador') {
      return NextResponse.json({ error: 'Solo puedes editar pedidos en borrador' }, { status: 403 })
    }
  }

  // Post-borrador: only admin can make any changes (except via dedicated transition endpoints)
  if (current.estado !== 'borrador' && !isAdmin) {
    return NextResponse.json({ error: 'Solo administradores pueden modificar pedidos confirmados' }, { status: 403 })
  }

  // Only allow specific safe fields; price changes only in borrador
  const allowed = ['notas', 'conductor_id', 'direccion_entrega', 'fecha_entrega_estimada', 'fecha_entrega_real']
  if (current.estado === 'borrador') allowed.push('estado')

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // Block vendedor from going back to borrador from confirmado
  if (body.estado && body.estado !== 'borrador' && !['borrador', 'confirmado'].includes(body.estado) && !isAdmin) {
    return NextResponse.json({ error: 'Solo administradores pueden cambiar a ese estado' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('pedidos')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden eliminar pedidos' }, { status: 403 })
  }

  const { data: pedido } = await supabase.from('pedidos').select('estado').eq('id', params.id).single()
  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (pedido.estado !== 'borrador') {
    return NextResponse.json(
      { error: `Solo se pueden eliminar pedidos en borrador (estado: ${pedido.estado})` },
      { status: 409 }
    )
  }

  await supabase.from('pedido_items').delete().eq('pedido_id', params.id)
  const { error } = await supabase.from('pedidos').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
