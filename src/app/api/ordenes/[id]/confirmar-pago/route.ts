import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RouteContext { params: { id: string } }

// ─── POST /api/ordenes/[id]/confirmar-pago ─────────────────────────────────
// ADMIN ONLY. Confirms a manual payment (Zelle or bank transfer) for a
// pendiente orden, then promotes it to an aprobada orden + borrador pedido
// (mirroring /aprobar). Also stamps the confirmation trail:
//   pago_confirmado       = true
//   pago_confirmado_at    = now()
//   pago_confirmado_por   = auth.uid
// Only valid for tipo_pago ∈ ('zelle','cheque','efectivo','transferencia').
// ('transferencia' kept only for legacy orders; new tienda orders can't
// create it anymore.) Stripe orders are confirmed automatically by the
// webhook; credito orders skip this flow.
// ───────────────────────────────────────────────────────────────────────────

export async function POST(_req: Request, { params }: RouteContext) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).maybeSingle()
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden confirmar pagos' }, { status: 403 })
  }

  // Load the orden
  const { data: orden, error: fetchErr } = await supabase
    .from('ordenes')
    .select(`
      id, numero, estado, cliente_id, notas, direccion_entrega, total,
      tipo_pago, pago_confirmado, numero_referencia,
      items:orden_items(id, presentacion_id, cantidad, precio_unitario, subtotal)
    `)
    .eq('id', params.id)
    .single()

  if (fetchErr || !orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }
  if (orden.estado !== 'pendiente') {
    return NextResponse.json(
      { error: `Solo se pueden confirmar pagos en órdenes pendientes (estado actual: ${orden.estado})` },
      { status: 409 }
    )
  }
  if (!['zelle', 'cheque', 'efectivo', 'transferencia'].includes(orden.tipo_pago)) {
    return NextResponse.json(
      { error: `El tipo de pago "${orden.tipo_pago}" no requiere confirmación manual` },
      { status: 400 }
    )
  }
  if (orden.pago_confirmado) {
    return NextResponse.json({ error: 'Este pago ya fue confirmado' }, { status: 409 })
  }
  if (!orden.items || orden.items.length === 0) {
    return NextResponse.json({ error: 'La orden no tiene productos' }, { status: 400 })
  }

  // Next pedido numero (fallback to timestamp on sequence miss)
  const { data: numData } = await supabase
    .rpc('get_next_sequence', { seq_name: 'pedidos' })
  const pedidoNumero = (numData as string) || `PED-${Date.now()}`

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
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  // Mark orden aprobada + confirm the manual payment trail
  const { error: updErr } = await supabase
    .from('ordenes')
    .update({
      estado: 'aprobada',
      pago_confirmado: true,
      pago_confirmado_at: new Date().toISOString(),
      pago_confirmado_por: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    message: `Pago confirmado para orden ${orden.numero}. Pedido ${pedido.numero} creado.`,
    orden_id: orden.id,
    pedido,
  })
}
