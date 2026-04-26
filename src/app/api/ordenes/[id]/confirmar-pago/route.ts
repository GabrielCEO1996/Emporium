import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'
import { releaseOrdenStock } from '@/lib/orden-stock'
import { sendCambioEstadoEmail } from '@/lib/email/cambio-estado'
import { crearFacturaDesdePedido } from '@/lib/factura-auto'

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
  try {
    const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).maybeSingle()
      if (profile?.rol !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden confirmar pagos' }, { status: 403 })
      }

      // Load the orden — transaccion_id se hereda al pedido para
      // mantener tracking end-to-end.
      const { data: orden, error: fetchErr } = await supabase
        .from('ordenes')
        .select(`
          id, numero, estado, cliente_id, notas, direccion_entrega, total,
          tipo_pago, pago_confirmado, numero_referencia, transaccion_id,
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
      const ordenTxId = (orden as any).transaccion_id as string | null | undefined
      const buildPedidoPayload = (includeTxId: boolean): Record<string, any> => {
        const base: Record<string, any> = {
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
        }
        if (includeTxId && ordenTxId) base.transaccion_id = ordenTxId
        return base
      }
      let { data: pedido, error: pedidoErr } = await supabase
        .from('pedidos').insert(buildPedidoPayload(true)).select().single()
      if (pedidoErr && /transaccion_id/i.test(pedidoErr.message || '')) {
        console.warn('[ordenes/confirmar-pago] pedidos.transaccion_id missing — retrying without')
        const r = await supabase.from('pedidos').insert(buildPedidoPayload(false)).select().single()
        pedido = r.data
        pedidoErr = r.error
      }

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

      // Mark orden aprobada + confirm the manual payment trail.
      // checkout_v2: estado_pago='verificado' with verificado_por/at audit stamps.
      // Defensive: if the migration hasn't been applied yet, retry without the
      // new columns so an unmigrated DB still works.
      const nowIso = new Date().toISOString()
      const buildUpdate = (includeV2Cols: boolean) => {
        const base: Record<string, any> = {
          estado: 'aprobada',
          pago_confirmado: true,
          pago_confirmado_at: nowIso,
          pago_confirmado_por: user.id,
          updated_at: nowIso,
        }
        if (includeV2Cols) {
          base.estado_pago = 'verificado'
          base.verificado_por = user.id
          base.verificado_at = nowIso
        }
        return base
      }

      let updErr: any
      {
        const { error } = await supabase.from('ordenes').update(buildUpdate(true)).eq('id', params.id)
        updErr = error
      }
      if (updErr && /estado_pago|verificado_(por|at)/i.test(updErr.message || '')) {
        console.warn('[ordenes/confirmar-pago] estado_pago columns missing — retrying without')
        const { error } = await supabase.from('ordenes').update(buildUpdate(false)).eq('id', params.id)
        updErr = error
      }
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }

      // ── Auto-crear factura ─────────────────────────────────────────────
      // Modelo nuevo (Fase 3): la factura nace junto con el pedido. Para
      // Zelle/cheque/efectivo, este endpoint = "Mache verifica el pago",
      // así que la factura nace 'pagada' con tipo_pago = el método que
      // usó el cliente. pago_confirmado_por queda registrado al user que
      // tocó el botón. Soft-fail.
      const tipoPagoSafe = (orden.tipo_pago === 'zelle' || orden.tipo_pago === 'cheque'
        || orden.tipo_pago === 'efectivo' || orden.tipo_pago === 'transferencia')
        ? orden.tipo_pago : null
      const refTxt = orden.numero_referencia ? ` · Ref ${orden.numero_referencia}` : ''
      const facturaRes = await crearFacturaDesdePedido(supabase, {
        pedidoId: pedido.id,
        estadoInicial: 'pagada',
        tipoPago: tipoPagoSafe,
        pagoConfirmadoPorUserId: user.id,
        notas: `Pago confirmado vía ${orden.tipo_pago ?? 'manual'}${refTxt} · Orden ${orden.numero}`,
      })
      if (!facturaRes.ok) {
        console.warn('[ordenes/confirmar-pago] factura no creada:', {
          orden: orden.numero, pedido: pedido.numero, error: facturaRes.error,
        })
      }

      // ── Release orden stock reservation ────────────────────────────────
      // La orden ya está aprobada y existe como pedido — el pedido tiene
      // su propio sistema FEFO. Liberamos la reserva transitoria de la
      // orden para que stock_reservado vuelva a su nivel base.
      const releaseRes = await releaseOrdenStock(supabase, orden.id)
      if (!releaseRes.ok) {
        console.warn('[ordenes/confirmar-pago] partial release:', {
          orden: orden.numero,
          released: releaseRes.itemsReleased,
          total: releaseRes.itemsTotal,
        })
      }

      void logActivity(supabase as any, {
        user_id: user.id,
        action: 'confirmar_pago_orden',
        resource: 'ordenes',
        resource_id: orden.id,
        estado_anterior: 'pendiente',
        estado_nuevo: 'aprobada',
        details: {
          orden_numero: orden.numero,
          pedido_id: pedido.id,
          pedido_numero: pedido.numero,
          factura_id: facturaRes.factura?.id ?? null,
          factura_numero: facturaRes.factura?.numero ?? null,
          tipo_pago: orden.tipo_pago,
          numero_referencia: orden.numero_referencia ?? null,
          stock_released: releaseRes.itemsReleased,
          stock_total: releaseRes.itemsTotal,
        },
      })

      // Notify the customer that their manual payment was verified.
      void sendCambioEstadoEmail(supabase, orden.id, 'pago_verificado', {
        pedidoNumero: pedido.numero,
      }).catch(e => console.error('[ordenes/confirmar-pago] email failed:', e))

      return NextResponse.json({
        message: `Pago confirmado para orden ${orden.numero}. Pedido ${pedido.numero} creado.`,
        orden_id: orden.id,
        pedido,
        stock_released: releaseRes.itemsReleased,
      })

  } catch (err) {
    console.error('[POST /api/ordenes/[id]/confirmar-pago]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
