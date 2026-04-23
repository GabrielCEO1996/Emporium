import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, rateLimitResponse } from '@/lib/security'

// ─── POST /api/tienda/pedido ────────────────────────────────────────────────
// Client submits cart from /tienda.
//   1. Prefers creating an ORDEN (awaiting admin approval) if the
//      `ordenes` table exists.
//   2. If the table is missing (migration not yet applied), transparently
//      falls back to creating a PEDIDO in estado 'borrador' so checkout
//      is never broken while SQL is pending.
//
// ALWAYS returns a JSON response. Logs everything so failures are visible
// in the server console.
// ─────────────────────────────────────────────────────────────────────────────

// Postgres "relation does not exist" surface through supabase-js in a few
// shapes depending on version; normalise the check here.
function isMissingRelation(err: any): boolean {
  if (!err) return false
  const code = err.code ?? err.details?.code
  const msg = (err.message ?? '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' || // PostgREST: schema cache could not find table
    msg.includes('relation') && msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes("schema cache")
  )
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) console.error('[tienda/pedido] auth error:', authError)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Rate limit: 20 submissions per hour per user
    if (!rateLimit(`tienda_orden:${user.id}`, 20, 60 * 60 * 1000)) {
      return rateLimitResponse(60 * 60 * 1000)
    }

    let body: any
    try {
      body = await req.json()
    } catch (parseErr) {
      console.error('[tienda/pedido] invalid JSON body:', parseErr)
      return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
    }

    const { items, notas, direccion_entrega, tipo_pago = 'pendiente' } = body ?? {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
    }
    if (items.length > 100) {
      return NextResponse.json({ error: 'Máximo 100 productos por orden' }, { status: 400 })
    }

    // ── Resolve cliente record (by user_id first, email fallback) ─────────
    let clienteData: { id: string } | null = null

    // Try user_id match first (safer than .or with a possibly-empty email)
    {
      const { data, error } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) console.error('[tienda/pedido] cliente by user_id error:', error)
      if (data) clienteData = data
    }

    // Fallback: by email
    if (!clienteData && user.email) {
      const { data, error } = await supabase
        .from('clientes')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()
      if (error) console.error('[tienda/pedido] cliente by email error:', error)
      if (data) {
        clienteData = data
        // Backfill user_id (best-effort)
        await supabase
          .from('clientes')
          .update({ user_id: user.id })
          .eq('id', data.id)
          .is('user_id', null)
          .then(() => null, err => console.error('[tienda/pedido] backfill user_id failed:', err))
      }
    }

    // Auto-create cliente if still missing
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
        console.error('[tienda/pedido] cliente insert failed:', createError)
        return NextResponse.json(
          { error: 'No se pudo crear el registro de cliente: ' + (createError?.message ?? '') },
          { status: 500 }
        )
      }
      clienteData = newCliente
    }

    const cliente_id = clienteData.id

    const total = items.reduce(
      (acc: number, item: any) => acc + Number(item.precio_unitario) * Number(item.cantidad),
      0
    )

    // ── Sequence helper ───────────────────────────────────────────────────
    const nextNumero = async (seqName: string, prefix: string): Promise<string> => {
      const { data, error } = await supabase.rpc('get_next_sequence', { seq_name: seqName })
      if (error || !data) {
        console.warn(`[tienda/pedido] get_next_sequence('${seqName}') fallback:`, error?.message ?? 'no data')
        return `${prefix}-${Date.now()}`
      }
      return data as string
    }

    // ════════════════════════════════════════════════════════════════════════
    // Path A: try ORDENES first
    // ════════════════════════════════════════════════════════════════════════
    const ordenNumero = await nextNumero('ordenes', 'ORD')

    const { data: orden, error: ordenError } = await supabase
      .from('ordenes')
      .insert({
        numero: ordenNumero,
        cliente_id,
        user_id: user.id,
        estado: 'pendiente',
        notas: notas?.trim() || null,
        direccion_entrega: direccion_entrega?.trim() || null,
        total,
      })
      .select()
      .single()

    if (!ordenError && orden) {
      // Insert orden_items
      const ordenItems = items.map((item: any) => ({
        orden_id: orden.id,
        presentacion_id: item.presentacion_id,
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        subtotal: Number(item.precio_unitario) * Number(item.cantidad),
      }))

      const { error: itemsError } = await supabase.from('orden_items').insert(ordenItems)
      if (itemsError) {
        console.error('[tienda/pedido] orden_items insert failed:', itemsError)
        await supabase.from('ordenes').delete().eq('id', orden.id)

        // If orden_items table is the one missing, fall through to pedidos path
        if (!isMissingRelation(itemsError)) {
          return NextResponse.json(
            { error: itemsError.message ?? 'Error al guardar los productos' },
            { status: 500 }
          )
        }
        console.warn('[tienda/pedido] orden_items table missing — falling back to pedidos')
      } else {
        // Success
        return NextResponse.json(
          {
            success: true,
            orden_id: orden.id,
            numero: orden.numero,
            ...orden,
          },
          { status: 201 }
        )
      }
    } else if (ordenError && !isMissingRelation(ordenError)) {
      // Real error — not a missing table. Surface it, don't hide as fallback.
      console.error('[tienda/pedido] ordenes insert failed:', ordenError)
      return NextResponse.json(
        { error: ordenError.message ?? 'Error al crear la orden' },
        { status: 500 }
      )
    } else if (ordenError) {
      console.warn('[tienda/pedido] ordenes table missing — falling back to pedidos')
    }

    // ════════════════════════════════════════════════════════════════════════
    // Path B: fallback — create a PEDIDO directly (legacy path)
    // ════════════════════════════════════════════════════════════════════════
    const pedidoNumero = await nextNumero('pedidos', 'PED')

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        numero: pedidoNumero,
        cliente_id,
        vendedor_id: null,
        estado: 'borrador',
        tipo_pago,
        subtotal: total,
        descuento: 0,
        impuesto: 0,
        total,
        notas: notas?.trim() || null,
        direccion_entrega: direccion_entrega?.trim() || null,
      })
      .select()
      .single()

    if (pedidoError || !pedido) {
      console.error('[tienda/pedido] pedido insert failed:', pedidoError)
      return NextResponse.json(
        { error: pedidoError?.message ?? 'Error al crear el pedido' },
        { status: 500 }
      )
    }

    const pedidoItems = items.map((item: any) => ({
      pedido_id: pedido.id,
      presentacion_id: item.presentacion_id,
      cantidad: Number(item.cantidad),
      precio_unitario: Number(item.precio_unitario),
      descuento: 0,
      subtotal: Number(item.precio_unitario) * Number(item.cantidad),
    }))

    const { error: pedidoItemsError } = await supabase.from('pedido_items').insert(pedidoItems)
    if (pedidoItemsError) {
      console.error('[tienda/pedido] pedido_items insert failed:', pedidoItemsError)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      return NextResponse.json(
        { error: pedidoItemsError.message ?? 'Error al guardar los productos' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        pedido_id: pedido.id,
        numero: pedido.numero,
        ...pedido,
      },
      { status: 201 }
    )
  } catch (err: any) {
    // Last-resort: never let the request hang
    console.error('[tienda/pedido] unhandled exception:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
