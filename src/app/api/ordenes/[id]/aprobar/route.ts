import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RouteContext { params: { id: string } }

// ─── POST /api/ordenes/[id]/aprobar ─────────────────────────────────────────
// ADMIN ONLY. Converts a pending orden into a pedido:
//   1. Validates orden is pendiente
//   2. Generates a pedido numero via get_next_sequence('pedidos')
//   3. Inserts pedido (estado='borrador') with orden_id link
//   4. Copies orden_items → pedido_items
//   5. Marks orden as 'aprobada'
// The pedido then follows its own standard flow
// (confirmada → aprobada → despachada → entregada).
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(_req: Request, { params }: RouteContext) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden aprobar órdenes' }, { status: 403 })
  }

  // Load the orden
  const { data: orden, error: fetchErr } = await supabase
    .from('ordenes')
    .select(`
      id, numero, estado, cliente_id, notas, direccion_entrega, total,
      items:orden_items(id, presentacion_id, cantidad, precio_unitario, subtotal)
    `)
    .eq('id', params.id)
    .single()

  if (fetchErr || !orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }
  if (orden.estado !== 'pendiente') {
    return NextResponse.json(
      { error: `Solo se pueden aprobar órdenes pendientes (estado actual: ${orden.estado})` },
      { status: 409 }
    )
  }
  if (!orden.items || orden.items.length === 0) {
    return NextResponse.json({ error: 'La orden no tiene productos' }, { status: 400 })
  }

  // Next pedido numero (fallback to timestamp on sequence miss)
  let pedidoNumero: string
  const { data: numData } = await supabase
    .rpc('get_next_sequence', { seq_name: 'pedidos' })
  pedidoNumero = (numData as string) || `PED-${Date.now()}`

  // Create pedido in 'borrador' linked to the orden
  const subtotal = (orden.items as any[]).reduce((s, i) => s + Number(i.subtotal), 0)
  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .insert({
      numero: pedidoNumero,
      cliente_id: orden.cliente_id,
      vendedor_id: user.id,
      estado: 'borrador',
      subtotal,
      descuento: 0,
      impuesto: 0,
      total: orden.total ?? subtotal,
      notas: orden.notas,
      direccion_entrega: orden.direccion_entrega,
      orden_id: orden.id,
    })
    .select()
    .single()

  if (pedidoErr || !pedido) {
    return NextResponse.json(
      { error: pedidoErr?.message ?? 'No se pudo crear el pedido' },
      { status: 500 }
    )
  }

  // Copy items
  const pedidoItems = (orden.items as any[]).map(i => ({
    pedido_id: pedido.id,
    presentacion_id: i.presentacion_id,
    cantidad: Number(i.cantidad),
    precio_unitario: Number(i.precio_unitario),
    descuento: 0,
    subtotal: Number(i.subtotal),
  }))
  const { error: itemsErr } = await supabase.from('pedido_items').insert(pedidoItems)
  if (itemsErr) {
    // Rollback pedido
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  // Mark orden aprobada
  const { error: updErr } = await supabase
    .from('ordenes')
    .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
    .eq('id', params.id)
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    message: `Orden ${orden.numero} aprobada. Pedido ${pedido.numero} creado.`,
    orden_id: orden.id,
    pedido,
  })
}
