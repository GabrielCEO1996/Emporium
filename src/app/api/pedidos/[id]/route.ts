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
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const allowed = ['estado', 'notas', 'conductor_id', 'direccion_entrega', 'fecha_entrega_estimada', 'fecha_entrega_real']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // Get current estado before updating (for inventario sync)
  const { data: pedidoActual } = await supabase
    .from('pedidos')
    .select('estado')
    .eq('id', params.id)
    .single()

  const { data, error } = await supabase
    .from('pedidos')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Sync inventario on estado transitions ────────────────────────────────
  const nuevoEstado = body.estado as string | undefined
  const estadoAnterior = pedidoActual?.estado as string | undefined

  const isTransitionTo = (target: string) =>
    nuevoEstado === target && estadoAnterior !== target

  // entregado: stock_total -= cantidad, stock_reservado -= cantidad (goods leave warehouse)
  // cancelado: stock_reservado -= cantidad (release reservation without changing stock_total)
  if (isTransitionTo('entregado') || isTransitionTo('cancelado')) {
    const { data: items } = await supabase
      .from('pedido_items')
      .select('presentacion_id, cantidad, presentaciones(producto_id)')
      .eq('pedido_id', params.id)

    if (items && items.length > 0) {
      await Promise.all(items.map(async (item: any) => {
        const { data: inv } = await supabase
          .from('inventario')
          .select('id, stock_total, stock_reservado, producto_id')
          .eq('presentacion_id', item.presentacion_id)
          .single()

        if (inv) {
          const nuevoReservado = Math.max(0, (inv.stock_reservado ?? 0) - item.cantidad)
          const nuevoTotal = isTransitionTo('entregado')
            ? Math.max(0, (inv.stock_total ?? 0) - item.cantidad)
            : inv.stock_total

          await supabase
            .from('inventario')
            .update({ stock_total: nuevoTotal, stock_reservado: nuevoReservado })
            .eq('id', inv.id)

          await supabase.from('inventario_movimientos').insert({
            producto_id: inv.producto_id,
            presentacion_id: item.presentacion_id,
            tipo: isTransitionTo('entregado') ? 'salida' : 'liberacion',
            cantidad: item.cantidad,
            stock_anterior: inv.stock_total,
            stock_nuevo: nuevoTotal,
            referencia_tipo: isTransitionTo('entregado') ? 'pedido_entregado' : 'pedido_cancelado',
            referencia_id: params.id,
            usuario_id: user.id,
          })
        }
      }))
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  // Only admins can delete pedidos
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores pueden eliminar pedidos' }, { status: 403 })

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('estado')
    .eq('id', params.id)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  if (pedido.estado !== 'borrador') {
    return NextResponse.json(
      { error: `Solo se pueden eliminar pedidos en estado "borrador". Este está en "${pedido.estado}".` },
      { status: 409 }
    )
  }

  // Delete items first
  await supabase.from('pedido_items').delete().eq('pedido_id', params.id)
  const { error } = await supabase.from('pedidos').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
