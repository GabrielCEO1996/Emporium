import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, rateLimitResponse } from '@/lib/security'

// ─── POST /api/tienda/pedido ────────────────────────────────────────────────
// Kept at the same URL for backwards compatibility with TiendaClient and
// the Stripe success page, but now creates an ORDEN (awaiting admin approval)
// instead of a PEDIDO. Returns { numero } so existing UI keeps working.
//
// A tienda submission is a client *request*; it becomes a pedido only after
// admin approval at POST /api/ordenes/[id]/aprobar.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Rate limit: 20 submissions per hour per user
  if (!rateLimit(`tienda_orden:${user.id}`, 20, 60 * 60 * 1000)) {
    return rateLimitResponse(60 * 60 * 1000)
  }

  const body = await req.json()
  const { items, notas, direccion_entrega } = body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
  }
  if (items.length > 100) {
    return NextResponse.json({ error: 'Máximo 100 productos por orden' }, { status: 400 })
  }

  // ── Resolve cliente record (by user_id first, email fallback) ─────────────
  let { data: clienteData } = await supabase
    .from('clientes')
    .select('id')
    .or(`user_id.eq.${user.id},email.eq.${user.email ?? ''}`)
    .maybeSingle()

  if (!clienteData) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('nombre')
      .eq('id', user.id)
      .maybeSingle()

    const nombre =
      perfil?.nombre ??
      user.user_metadata?.full_name ??
      user.email?.split('@')[0] ??
      'Cliente'

    const { data: newCliente, error: createError } = await supabase
      .from('clientes')
      .insert({ nombre, email: user.email!, user_id: user.id, activo: true })
      .select('id')
      .single()

    if (createError || !newCliente) {
      return NextResponse.json(
        { error: 'No se pudo crear el registro de cliente: ' + (createError?.message ?? '') },
        { status: 500 }
      )
    }
    clienteData = newCliente
  } else {
    supabase
      .from('clientes')
      .update({ user_id: user.id })
      .eq('id', clienteData.id)
      .is('user_id', null)
      .then(() => null)
      .catch(() => null)
  }

  const cliente_id = clienteData.id

  const total = items.reduce(
    (acc: number, item: any) => acc + Number(item.precio_unitario) * Number(item.cantidad),
    0
  )

  // Generate sequence number for orden (falls back to timestamp on seq miss)
  let numero: string
  const { data: numData, error: numError } = await supabase
    .rpc('get_next_sequence', { seq_name: 'ordenes' })
  if (numError || !numData) {
    numero = `ORD-${Date.now()}`
  } else {
    numero = numData as string
  }

  const { data: orden, error: ordenError } = await supabase
    .from('ordenes')
    .insert({
      numero,
      cliente_id,
      user_id: user.id,
      estado: 'pendiente',
      notas: notas?.trim() || null,
      direccion_entrega: direccion_entrega?.trim() || null,
      total,
    })
    .select()
    .single()

  if (ordenError) return NextResponse.json({ error: ordenError.message }, { status: 500 })

  const ordenItems = items.map((item: any) => ({
    orden_id: orden.id,
    presentacion_id: item.presentacion_id,
    cantidad: Number(item.cantidad),
    precio_unitario: Number(item.precio_unitario),
    subtotal: Number(item.precio_unitario) * Number(item.cantidad),
  }))

  const { error: itemsError } = await supabase.from('orden_items').insert(ordenItems)
  if (itemsError) {
    await supabase.from('ordenes').delete().eq('id', orden.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // NOTE: no stock reservation and no credit deduction at this stage.
  // Both happen when admin approves the orden and the pedido is created.

  return NextResponse.json(orden, { status: 201 })
}
