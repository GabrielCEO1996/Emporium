import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'
import { releaseOrdenStock } from '@/lib/orden-stock'
import { sendCambioEstadoEmail } from '@/lib/email/cambio-estado'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  try {
    const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).single()
      if (profile?.rol !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden aprobar órdenes' }, { status: 403 })
      }

      // Load the orden — incluyendo tipo_pago y estado_pago para el guardia
      // anti-bypass que bloquea aprobaciones manuales de órdenes Stripe sin
      // pago verificado. Defensivo: pago_confirmado y estado_pago pueden no
      // existir en DBs sin las migrations checkout_v2/payment_proofs.
      // transaccion_id viene de transacciones_maestras.sql — lo heredamos
      // al pedido para mantener trazabilidad end-to-end.
      const { data: orden, error: fetchErr } = await supabase
        .from('ordenes')
        .select(`
          id, numero, estado, cliente_id, notas, direccion_entrega, total,
          tipo_pago, pago_confirmado, estado_pago, transaccion_id,
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

      // ── ANTI-BYPASS GUARD ────────────────────────────────────────────────
      // Stripe orders MUST be verified by the webhook (signed payload from
      // Stripe → estado_pago='verificado' or pago_confirmado=true) BEFORE
      // an admin can approve them. Without this check, a logged-in admin
      // could click "Aprobar" on an unpaid Stripe order and the system would
      // create a pedido "como si estuviese pagado".
      //
      // Manual methods (zelle/cheque/efectivo/transferencia) tienen su propio
      // flujo /confirmar-pago donde el admin valida el comprobante. Si por
      // accidente llegan acá, también las bloqueamos hasta que pasen por
      // /confirmar-pago — así el botón correcto del UI los lleva al flujo
      // correcto.
      const tipoPago = (orden as any).tipo_pago as string | null
      const pagoConfirmado = (orden as any).pago_confirmado === true
      const estadoPago = (orden as any).estado_pago as string | null
      const isPaymentVerified = pagoConfirmado || estadoPago === 'verificado'

      if (tipoPago === 'stripe' && !isPaymentVerified) {
        return NextResponse.json({
          error:
            'No se puede aprobar manualmente una orden Stripe sin pago verificado. ' +
            'Esperá a que el cliente complete el pago — el webhook de Stripe la aprobará automáticamente. ' +
            'Si el cliente abandonó, usá "Rechazar".',
        }, { status: 409 })
      }

      const MANUAL_METHODS = ['zelle', 'cheque', 'efectivo', 'transferencia']
      if (tipoPago && MANUAL_METHODS.includes(tipoPago) && !isPaymentVerified) {
        return NextResponse.json({
          error:
            `Para órdenes con pago en ${tipoPago}, usá "Confirmar pago recibido" en lugar de "Aprobar". ` +
            'Eso valida el comprobante y aprueba la orden en un solo paso.',
        }, { status: 409 })
      }
      // tipo_pago='credito' y null (legacy/ordenes B2B sin método): pasan
      // — son los únicos casos donde "Aprobar" manual tiene sentido.

      // Next pedido numero (fallback to timestamp on sequence miss)
      let pedidoNumero: string
      const { data: numData } = await supabase
        .rpc('get_next_sequence', { seq_name: 'pedidos' })
      pedidoNumero = (numData as string) || `PED-${Date.now()}`

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
        console.warn('[ordenes/aprobar] pedidos.transaccion_id missing — retrying without')
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
        // Rollback pedido
        await supabase.from('pedidos').delete().eq('id', pedido.id)
        return NextResponse.json({ error: itemsErr.message }, { status: 500 })
      }

      // Mark orden aprobada + audit trail (aprobado_por/at columns from
      // ordenes_aprobacion_v3 migration). Defensive: if migration not yet
      // applied, retry without those columns.
      const nowIso = new Date().toISOString()
      const buildAprobarUpdate = (includeV3Cols: boolean) => {
        const base: Record<string, any> = {
          estado: 'aprobada',
          updated_at: nowIso,
        }
        if (includeV3Cols) {
          base.aprobado_por = user.id
          base.aprobado_at = nowIso
        }
        return base
      }
      let updErr: any
      {
        const r = await supabase.from('ordenes').update(buildAprobarUpdate(true)).eq('id', params.id)
        updErr = r.error
      }
      if (updErr && /aprobado_(por|at)/i.test(updErr.message || '')) {
        console.warn('[ordenes/aprobar] aprobado_* columns missing — retrying without')
        const r = await supabase.from('ordenes').update(buildAprobarUpdate(false)).eq('id', params.id)
        updErr = r.error
      }
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }

      // ── Release orden stock reservation ────────────────────────────────
      // La orden ya quedó "aprobada" y se materializó como pedido. La
      // reserva en `presentaciones.stock_reservado` ya cumplió su rol
      // (asegurar que el inventario no se vendiera dos veces mientras
      // la orden esperaba aprobación). El pedido toma over con su propio
      // sistema FEFO en `inventario` (lots) cuando se confirme/apruebe.
      // Soft-fail — el activity log captura el conteo.
      const releaseRes = await releaseOrdenStock(supabase, orden.id)
      if (!releaseRes.ok) {
        console.warn('[ordenes/aprobar] partial release:', {
          orden: orden.numero,
          released: releaseRes.itemsReleased,
          total: releaseRes.itemsTotal,
        })
      }

      void logActivity(supabase, {
        user_id: user.id,
        action: 'aprobar_orden',
        resource: 'ordenes',
        resource_id: orden.id,
        estado_anterior: 'pendiente',
        estado_nuevo: 'aprobada',
        details: {
          orden_numero: orden.numero,
          pedido_id: pedido.id,
          pedido_numero: pedido.numero,
          total: orden.total ?? subtotal,
          stock_released: releaseRes.itemsReleased,
          stock_total: releaseRes.itemsTotal,
        },
      })

      // Notify the customer (best-effort, never blocks the response).
      void sendCambioEstadoEmail(supabase, orden.id, 'aprobada', {
        pedidoNumero: pedido.numero,
      }).catch(e => console.error('[ordenes/aprobar] email failed:', e))

      return NextResponse.json({
        message: `Orden ${orden.numero} aprobada. Pedido ${pedido.numero} creado.`,
        orden_id: orden.id,
        pedido,
        stock_released: releaseRes.itemsReleased,
      })

  } catch (err) {
    console.error('[POST /api/ordenes/[id]/aprobar]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
