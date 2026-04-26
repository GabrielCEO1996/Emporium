import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, rateLimitResponse, logActivity } from '@/lib/security'
import { reserveOrdenStock, rollbackOrdenStock } from '@/lib/orden-stock'
import { generateTransaccionId } from '@/lib/transaccion'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── POST /api/checkout/zelle ──────────────────────────────────────────────
// "Comprar ahora" → "Zelle". Pago manual con comprobante adjunto.
//
// Flow:
//   1. Cliente sube comprobante (screenshot del Zelle) a Supabase Storage
//      → recibe payment_proof_url (la subida pasa por el cliente, no por
//      este endpoint).
//   2. Cliente hace POST acá con items + numero_referencia +
//      payment_proof_url.
//   3. Endpoint crea orden con tipo_pago='zelle', estado='pendiente',
//      estado_pago='pendiente_verificacion'.
//   4. Reserva inventario.
//   5. Email a admins con link al panel para verificar comprobante.
//   6. Admin abre /dashboard/ordenes, valida el comprobante visualmente,
//      hace click "Confirmar pago recibido" → /api/ordenes/[id]/
//      confirmar-pago crea el pedido y libera la reserva.
//
// Roles: cliente, comprador.
//
// Body:
//   {
//     items: Array<...>,
//     numero_referencia: string  (mín 6 chars, anti-fraude básico)
//     payment_proof_url: string  (URL pública de Supabase Storage)
//     notas?: string,
//     direccion_entrega?: string,
//     cliente_data?: { ... }
//   }
//
// Response 201:
//   { success: true, tipo: 'orden', orden_id, numero }
// ───────────────────────────────────────────────────────────────────────────

interface InboundItem {
  presentacion_id: string
  cantidad: number
  precio_unitario: number
  productoNombre?: string
  presentacionNombre?: string
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    // ── Auth ───────────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).maybeSingle()
    const rol = profile?.rol ?? 'comprador'

    if (rol !== 'cliente' && rol !== 'comprador') {
      return NextResponse.json({
        error: 'Tu rol no permite checkout online.',
      }, { status: 403 })
    }

    // ── Rate limit ─────────────────────────────────────────────────────────
    const rateMax = rol === 'comprador' ? 5 : 15
    if (!rateLimit(`checkout_zelle:${user.id}`, rateMax, 60 * 60 * 1000)) {
      return rateLimitResponse(60 * 60 * 1000)
    }

    // ── Parse + validate ───────────────────────────────────────────────────
    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
    }

    const {
      items,
      numero_referencia,
      payment_proof_url,
      notas,
      direccion_entrega,
      cliente_data,
    } = body ?? {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
    }
    if (items.length > 100) {
      return NextResponse.json({ error: 'Máximo 100 productos' }, { status: 400 })
    }

    const referencia = typeof numero_referencia === 'string' ? numero_referencia.trim() : ''
    if (!referencia) {
      return NextResponse.json({
        error: 'Debés proporcionar el número de confirmación del Zelle',
      }, { status: 400 })
    }
    if (referencia.length < 6) {
      return NextResponse.json({
        error: 'El número de confirmación del Zelle debe tener al menos 6 caracteres',
      }, { status: 400 })
    }

    const proofUrl = typeof payment_proof_url === 'string' ? payment_proof_url.trim() : ''
    if (!proofUrl) {
      return NextResponse.json({
        error: 'Debés adjuntar una captura de pantalla del pago Zelle',
      }, { status: 400 })
    }
    // Sanity: comprobante DEBE estar hospedado en nuestro storage (anti
    // injection de URLs externos).
    if (!proofUrl.includes('/storage/v1/object/public/payment-proofs/')) {
      return NextResponse.json({
        error: 'El comprobante adjunto no es válido',
      }, { status: 400 })
    }

    const sanitized: InboundItem[] = items.map((it: any) => ({
      presentacion_id: String(it.presentacion_id ?? ''),
      cantidad:        Number(it.cantidad ?? 0),
      precio_unitario: Number(it.precio_unitario ?? 0),
      productoNombre:    typeof it.productoNombre === 'string' ? it.productoNombre : undefined,
      presentacionNombre: typeof it.presentacionNombre === 'string' ? it.presentacionNombre : undefined,
    }))
    for (const it of sanitized) {
      if (!it.presentacion_id || !Number.isFinite(it.cantidad) || it.cantidad <= 0) {
        return NextResponse.json({ error: 'Items inválidos' }, { status: 400 })
      }
      if (!Number.isFinite(it.precio_unitario) || it.precio_unitario < 0) {
        return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
      }
    }

    // ── Resolve / autocreate cliente ───────────────────────────────────────
    const cd = (cliente_data && typeof cliente_data === 'object') ? cliente_data : null
    const clientePatch: Record<string, any> = {}
    if (cd) {
      if (typeof cd.nombre === 'string'        && cd.nombre.trim())        clientePatch.nombre        = cd.nombre.trim()
      if (typeof cd.telefono === 'string'      && cd.telefono.trim())      clientePatch.telefono      = cd.telefono.trim()
      if (typeof cd.whatsapp === 'string'      && cd.whatsapp.trim())      clientePatch.whatsapp      = cd.whatsapp.trim()
      if (typeof cd.direccion === 'string'     && cd.direccion.trim())     clientePatch.direccion     = cd.direccion.trim()
      if (typeof cd.ciudad === 'string'        && cd.ciudad.trim())        clientePatch.ciudad        = cd.ciudad.trim()
      if (typeof cd.tipo_cliente === 'string'  && cd.tipo_cliente.trim())  clientePatch.tipo_cliente  = cd.tipo_cliente.trim()
    }

    let clienteRow: { id: string } | null = null
    {
      const { data } = await supabase.from('clientes').select('id').eq('user_id', user.id).maybeSingle()
      if (data) clienteRow = data as any
    }
    if (!clienteRow && user.email) {
      const { data } = await supabase.from('clientes').select('id').eq('email', user.email).maybeSingle()
      if (data) {
        clienteRow = data as any
        void supabase.from('clientes').update({ user_id: user.id }).eq('id', data.id).is('user_id', null)
          .then(() => null, e => console.error('[checkout/zelle] backfill user_id:', e))
      }
    }
    if (!clienteRow) {
      const { data: perfil } = await supabase.from('profiles').select('nombre').eq('id', user.id).maybeSingle()
      const nombre = clientePatch.nombre ?? perfil?.nombre ?? user.email?.split('@')[0] ?? 'Cliente'
      const { data: newCli, error: createErr } = await supabase
        .from('clientes')
        .insert({ nombre, email: user.email!, user_id: user.id, activo: true, ...clientePatch })
        .select('id').single()
      if (createErr || !newCli) {
        return NextResponse.json({
          error: 'No se pudo registrar el cliente: ' + (createErr?.message ?? 'error'),
        }, { status: 500 })
      }
      clienteRow = newCli as any
    }
    const cliente_id = clienteRow!.id
    const total = sanitized.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0)

    // ── Reserve inventory ──────────────────────────────────────────────────
    const stockItems = sanitized.map(it => ({
      presentacion_id: it.presentacion_id,
      cantidad: it.cantidad,
    }))
    const reserveRes = await reserveOrdenStock(supabase, stockItems)
    if (!reserveRes.ok) {
      await rollbackOrdenStock(supabase, stockItems)
      return NextResponse.json({
        error: 'No se pudo reservar inventario. Revisá disponibilidad.',
        detail: reserveRes.error,
      }, { status: 409 })
    }

    // ── Sequence number ───────────────────────────────────────────────────
    const { data: numData } = await supabase.rpc('get_next_sequence', { seq_name: 'ordenes' })
    let ordenNumero = (numData as string) || ''
    if (!ordenNumero) {
      const year = new Date().getFullYear()
      ordenNumero = `ORD-${year}-${String(Date.now()).slice(-4)}`
    }

    // ── Generate master transaccion_id ────────────────────────────────────
    const transaccionId = await generateTransaccionId(supabase)

    // ── Insert orden ──────────────────────────────────────────────────────
    // Defensive cascade: payment_proof_url + transaccion_id pueden faltar
    // si las migrations correspondientes no se aplicaron. Retry sin esos
    // campos en cada caso.
    const buildPayload = (includeProofCols: boolean, includeTxId: boolean) => {
      const base: Record<string, any> = {
        numero: ordenNumero,
        cliente_id,
        user_id: user.id,
        estado: 'pendiente',
        tipo_pago: 'zelle',
        estado_pago: 'pendiente_verificacion',
        numero_referencia: referencia,
        notas: notas?.trim() || null,
        direccion_entrega: direccion_entrega?.trim() || null,
        total,
      }
      if (includeProofCols) {
        base.payment_proof_url = proofUrl
        base.payment_reference = referencia
      }
      if (includeTxId && transaccionId) base.transaccion_id = transaccionId
      return base
    }

    let { data: orden, error: ordenErr } = await supabase
      .from('ordenes').insert(buildPayload(true, true)).select().single()

    if (ordenErr && /transaccion_id/i.test(ordenErr.message || '')) {
      console.warn('[checkout/zelle] transaccion_id column missing — retrying without')
      const r = await supabase.from('ordenes').insert(buildPayload(true, false)).select().single()
      orden = r.data
      ordenErr = r.error
    }
    if (ordenErr && /payment_proof_url|payment_reference/i.test(ordenErr.message || '')) {
      console.warn('[checkout/zelle] payment_proofs columns missing — retrying without')
      const r = await supabase.from('ordenes').insert(buildPayload(false, false)).select().single()
      orden = r.data
      ordenErr = r.error
    }

    if (ordenErr || !orden) {
      await rollbackOrdenStock(supabase, stockItems)
      console.error('[checkout/zelle] orden insert failed:', ordenErr)
      return NextResponse.json({
        error: 'No se pudo crear la orden: ' + (ordenErr?.message ?? 'error'),
      }, { status: 500 })
    }

    // ── Insert orden_items ─────────────────────────────────────────────────
    const ordenItems = sanitized.map(it => ({
      orden_id: orden.id,
      presentacion_id: it.presentacion_id,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      subtotal: it.precio_unitario * it.cantidad,
    }))
    const { error: itemsErr } = await supabase.from('orden_items').insert(ordenItems)
    if (itemsErr) {
      await rollbackOrdenStock(supabase, stockItems)
      await supabase.from('ordenes').delete().eq('id', orden.id)
      console.error('[checkout/zelle] orden_items insert failed:', itemsErr)
      return NextResponse.json({
        error: 'No se pudieron guardar los productos: ' + itemsErr.message,
      }, { status: 500 })
    }

    // ── Activity log ──────────────────────────────────────────────────────
    logActivity(supabase, {
      userId: user.id,
      action: 'checkout_zelle_orden_creada',
      resource: 'ordenes',
      resourceId: orden.id,
      details: {
        rol,
        orden_numero: orden.numero,
        numero_referencia: referencia,
        total,
        items_count: sanitized.length,
        has_proof: true,
      },
    })

    // ── Email to admins ───────────────────────────────────────────────────
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
    if (siteOrigin) {
      fetch(`${siteOrigin}/api/email/nueva-orden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden_id: orden.id }),
      }).catch(err => console.error('[checkout/zelle] email trigger failed:', err))
    }

    return NextResponse.json({
      success: true,
      tipo: 'orden',
      numero: orden.numero,
      orden_id: orden.id,
      transaccion_id: (orden as any).transaccion_id ?? null,
    }, { status: 201 })
  } catch (err: any) {
    console.error('[checkout/zelle] unhandled:', err)
    return NextResponse.json({
      error: 'Error interno: ' + (err?.message ?? String(err)),
    }, { status: 500 })
  }
}
