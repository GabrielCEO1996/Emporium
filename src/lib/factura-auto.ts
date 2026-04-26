// ═══════════════════════════════════════════════════════════════════════════
// src/lib/factura-auto.ts
//
// Helper para crear una factura automáticamente al aprobar un pedido.
// El estado inicial de la factura depende del flow que la origina:
//
//   estado='pagada'          → Stripe webhook  (pago verificado por Stripe)
//                            → Zelle/cheque/efectivo confirmar-pago
//                              (Mache confirma que recibió el pago)
//   estado='pendiente_pago'  → B2B "Generar orden" aprobada por Mache
//                              (cliente debe pagar — método se decide al
//                               despachar)
//
// La factura hereda transaccion_id del pedido (Fase 2 — handle maestro
// EMP-YYYY-NNNN compartido por toda la cadena orden→pedido→factura).
//
// Es idempotente vía SELECT previo: si el pedido ya tiene factura, la
// devuelve sin crear duplicado.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CrearFacturaArgs {
  /** Pedido del que se origina. Debe existir y tener pedido_items. */
  pedidoId: string
  /** Estado inicial — depende del flow (Stripe/Zelle/cheque ya pagado vs
   *  B2B credito que arranca pendiente). */
  estadoInicial: 'pagada' | 'pendiente_pago' | 'pendiente_verificacion'
  /** Método de pago. Para B2B "Generar orden" antes del despacho, queda
   *  null (no decidido). Para Stripe siempre 'stripe', para Zelle 'zelle',
   *  etc. */
  tipoPago: 'zelle' | 'stripe' | 'credito' | 'cheque' | 'efectivo' | 'transferencia' | null
  /** Quién marcó el pago como recibido. null cuando es Stripe (webhook,
   *  sin user humano) o cuando estado='pendiente_pago' (todavía no se
   *  cobró). */
  pagoConfirmadoPorUserId?: string | null
  /** Texto opcional para notas. Útil para "Pagado vía Stripe Session: X"
   *  o "Confirmado por Mache · Ref: 12345". */
  notas?: string | null
}

export interface CrearFacturaResult {
  ok: boolean
  factura?: any
  error?: string
}

/**
 * Crea una factura para `pedidoId`. Si ya existe, devuelve la existente.
 * Hereda transaccion_id del pedido. Inserta factura_items espejando los
 * pedido_items con descripcion construida desde producto + presentación.
 *
 * Diseñado para llamarse fire-and-forget en un try/catch del endpoint padre
 * — si la factura falla, el endpoint puede continuar (la factura se puede
 * crear manualmente después con /api/pedidos/[id]/facturar). NO retorna
 * exceptions; siempre devuelve { ok }.
 */
export async function crearFacturaDesdePedido(
  supabase: SupabaseClient,
  args: CrearFacturaArgs,
): Promise<CrearFacturaResult> {
  try {
    // ── Idempotency: si ya existe factura para este pedido, devolverla ──
    const { data: existente } = await supabase
      .from('facturas')
      .select('id, numero, estado, transaccion_id')
      .eq('pedido_id', args.pedidoId)
      .maybeSingle()
    if (existente) {
      return { ok: true, factura: existente }
    }

    // ── Cargar pedido + items para armar la factura ─────────────────────
    const { data: pedido, error: pErr } = await supabase
      .from('pedidos')
      .select(`
        id, cliente_id, vendedor_id, subtotal, descuento, total,
        transaccion_id, notas,
        items:pedido_items(
          id, presentacion_id, cantidad, precio_unitario, subtotal
        )
      `)
      .eq('id', args.pedidoId)
      .maybeSingle()
    if (pErr || !pedido) {
      return { ok: false, error: `pedido no encontrado: ${pErr?.message ?? args.pedidoId}` }
    }

    const items = ((pedido as any).items ?? []) as Array<{
      presentacion_id: string
      cantidad: number
      precio_unitario: number
      subtotal: number
    }>

    if (items.length === 0) {
      return { ok: false, error: 'pedido sin items, no se puede facturar' }
    }

    // ── Resolver descripciones para factura_items.descripcion ──────────
    const presentacionIds = Array.from(new Set(items.map(i => i.presentacion_id)))
    const { data: presData } = await supabase
      .from('presentaciones')
      .select('id, nombre, producto:productos(nombre)')
      .in('id', presentacionIds)

    const descMap = new Map<string, string>()
    for (const p of (presData ?? []) as any[]) {
      const prodNombre = p.producto?.nombre ?? ''
      const presNombre = p.nombre ?? ''
      const desc = [prodNombre, presNombre].filter(Boolean).join(' — ') || 'Producto'
      descMap.set(p.id, desc)
    }

    // ── Numero secuencial de factura ───────────────────────────────────
    const { data: numData } = await supabase
      .rpc('get_next_sequence', { seq_name: 'facturas' })
    const facturaNumero = (numData as string) || `FAC-${Date.now()}`

    // ── Insert factura ─────────────────────────────────────────────────
    const subtotal  = Math.max(0, Number((pedido as any).subtotal  ?? 0))
    const descuento = Math.max(0, Number((pedido as any).descuento ?? 0))
    const base_imponible = Math.max(0, subtotal - descuento)
    const total = Number((pedido as any).total ?? base_imponible)
    const isPagada = args.estadoInicial === 'pagada'

    const pedidoTxId = (pedido as any).transaccion_id as string | null | undefined

    const buildPayload = (
      includeTxId: boolean,
      includeNewFields: boolean,  // tipo_pago, pago_confirmado_*
    ): Record<string, any> => {
      const base: Record<string, any> = {
        numero: facturaNumero,
        pedido_id: args.pedidoId,
        cliente_id: (pedido as any).cliente_id,
        vendedor_id: (pedido as any).vendedor_id ?? null,
        estado: args.estadoInicial,
        fecha_emision: new Date().toISOString().split('T')[0],
        fecha_vencimiento: !isPagada
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null,
        subtotal,
        descuento,
        base_imponible,
        tasa_impuesto: 0,
        impuesto: 0,
        total,
        monto_pagado: isPagada ? total : 0,
        notas: args.notas ?? null,
      }
      if (includeTxId && pedidoTxId) base.transaccion_id = pedidoTxId
      if (includeNewFields) {
        if (args.tipoPago) base.tipo_pago = args.tipoPago
        if (isPagada) {
          base.pago_confirmado_at = new Date().toISOString()
          if (args.pagoConfirmadoPorUserId) {
            base.pago_confirmado_por = args.pagoConfirmadoPorUserId
          }
        }
      }
      return base
    }

    // Cascade: full → drop new fields → drop tx + new fields. Cubre DBs
    // sin la migration v2 aplicada.
    let { data: factura, error: facErr } = await supabase
      .from('facturas').insert(buildPayload(true, true)).select().single()

    if (facErr && /tipo_pago|pago_confirmado/i.test(facErr.message || '')) {
      console.warn('[crearFacturaDesdePedido] new fields missing — retrying without')
      const r = await supabase
        .from('facturas').insert(buildPayload(true, false)).select().single()
      factura = r.data
      facErr = r.error
    }
    if (facErr && /transaccion_id/i.test(facErr.message || '')) {
      console.warn('[crearFacturaDesdePedido] transaccion_id missing — retrying without')
      const r = await supabase
        .from('facturas').insert(buildPayload(false, false)).select().single()
      factura = r.data
      facErr = r.error
    }
    if (facErr && /facturas_estado_check/i.test(facErr.message || '')) {
      // Migration de estados v2 no aplicada — usar 'emitida' como fallback
      // legacy para 'pendiente_pago' / 'pendiente_verificacion'.
      console.warn('[crearFacturaDesdePedido] estados v2 missing — falling back to emitida')
      const fallback = isPagada ? 'pagada' : 'emitida'
      const payload = buildPayload(true, true)
      payload.estado = fallback
      const r = await supabase.from('facturas').insert(payload).select().single()
      factura = r.data
      facErr = r.error
    }
    if (facErr || !factura) {
      console.error('[crearFacturaDesdePedido] insert failed:', facErr)
      return { ok: false, error: facErr?.message ?? 'insert failed' }
    }

    // ── Insert factura_items ───────────────────────────────────────────
    const facturaItems = items.map(i => ({
      factura_id: factura.id,
      presentacion_id: i.presentacion_id,
      descripcion: descMap.get(i.presentacion_id) ?? 'Producto',
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      descuento: 0,
      subtotal: Number(i.subtotal),
    }))
    const { error: itemsErr } = await supabase.from('factura_items').insert(facturaItems)
    if (itemsErr) {
      // factura quedó creada pero sin items — el caller decide. Log y
      // devolvemos ok=false para que el endpoint pueda hacer rollback si
      // quiere.
      console.error('[crearFacturaDesdePedido] factura_items failed (non-fatal):', itemsErr)
      return { ok: false, factura, error: `factura_items: ${itemsErr.message}` }
    }

    return { ok: true, factura }
  } catch (err: any) {
    console.error('[crearFacturaDesdePedido] threw:', err)
    return { ok: false, error: err?.message ?? 'unexpected' }
  }
}
