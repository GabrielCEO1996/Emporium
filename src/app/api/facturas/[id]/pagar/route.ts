import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'
import { requireAdmin } from '@/lib/auth'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RouteContext {
  params: { id: string }
}

// ─── POST /api/facturas/[id]/pagar ──────────────────────────────────────────
// Registra un pago contra la factura — el handler unificado que recibe el
// modal "Registrar pago" en /facturas/[id]:
//
//   Body opcional:
//     metodo:          'efectivo'|'zelle'|'cheque'|'transferencia'|'tarjeta_fisica'|'stripe'|'credito'
//     monto:           number  (default = factura.total)
//     referencia:      string | null
//     comprobante_url: string | null  (Supabase Storage public URL)
//     notas:           string | null
//
// Si el body viene vacío (legacy), se asume método='efectivo' + monto=total
// y se crea solo la transición de estado sin row en pagos.
//
// Side effects:
//   1. UPDATE facturas → estado='pagada', tipo_pago, pago_confirmado_*,
//                        monto_pagado.
//   2. INSERT pagos (si metodo provisto) — audit del cobro per row.
//   3. INSERT transacciones (ingreso) — libro contable.
//   4. UPDATE clientes.deuda_total -= total.
// ───────────────────────────────────────────────────────────────────────────

const VALID_METODOS = [
  'efectivo', 'zelle', 'cheque', 'transferencia',
  'tarjeta_fisica', 'stripe', 'credito',
] as const
type Metodo = typeof VALID_METODOS[number]

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()

    const gate = await requireAdmin(supabase)
    if (!gate.ok) return gate.response
    const { user } = gate

    // ── Parse body (opcional) ──────────────────────────────────────────────
    let body: any = {}
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch {
      // Body opcional. Si es JSON inválido, ignoramos.
    }

    const metodoIn = typeof body?.metodo === 'string' ? body.metodo : null
    const metodo: Metodo | null =
      metodoIn && (VALID_METODOS as readonly string[]).includes(metodoIn)
        ? (metodoIn as Metodo)
        : null

    const referencia = typeof body?.referencia === 'string' ? body.referencia.trim() || null : null
    const comprobanteUrl = typeof body?.comprobante_url === 'string' ? body.comprobante_url.trim() || null : null
    const notas = typeof body?.notas === 'string' ? body.notas.trim() || null : null
    const montoIn = Number(body?.monto)

    // ── Fetch current invoice ──────────────────────────────────────────────
    const { data: factura, error: fetchError } = await supabase
      .from('facturas')
      .select('id, numero, estado, total, monto_pagado, cliente_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (factura.estado === 'anulada') {
      return NextResponse.json({ error: 'No se puede pagar una factura anulada' }, { status: 409 })
    }
    if (factura.estado === 'pagada') {
      return NextResponse.json({ error: 'La factura ya está marcada como pagada' }, { status: 409 })
    }

    const monto = Number.isFinite(montoIn) && montoIn > 0
      ? montoIn
      : Number(factura.total ?? 0)

    // ── UPDATE factura → pagada ────────────────────────────────────────────
    // Incluye Fase 3 audit (pago_confirmado_*) + tipo_pago si vino método.
    // Cascade defensiva contra DBs sin migrar.
    const buildUpdate = (includeAudit: boolean, includeTipoPago: boolean): Record<string, any> => {
      const base: Record<string, any> = {
        estado: 'pagada',
        monto_pagado: factura.total,
        updated_at: new Date().toISOString(),
      }
      if (includeAudit) {
        base.pago_confirmado_at = new Date().toISOString()
        base.pago_confirmado_por = user.id
      }
      if (includeTipoPago && metodo) {
        base.tipo_pago = metodo
      }
      return base
    }
    let { data: updated, error: updateError } = await supabase
      .from('facturas').update(buildUpdate(true, true)).eq('id', params.id).select().single()
    if (updateError && /tipo_pago/i.test(updateError.message || '')) {
      const r = await supabase
        .from('facturas').update(buildUpdate(true, false)).eq('id', params.id).select().single()
      updated = r.data
      updateError = r.error
    }
    if (updateError && /pago_confirmado/i.test(updateError.message || '')) {
      const r = await supabase
        .from('facturas').update(buildUpdate(false, false)).eq('id', params.id).select().single()
      updated = r.data
      updateError = r.error
    }
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // ── INSERT pagos row (audit por cobro) ─────────────────────────────────
    // Soft-fail: si la inserción del registro de pago falla, igual la factura
    // ya quedó marcada como pagada. Se registra el error.
    if (metodo) {
      const buildPagoPayload = (includeComprobante: boolean): Record<string, any> => {
        const base: Record<string, any> = {
          factura_id: params.id,
          monto,
          metodo,
          referencia,
          notas,
          usuario_id: user.id,
        }
        if (includeComprobante) base.comprobante_url = comprobanteUrl
        return base
      }
      let { error: pagoErr } = await supabase
        .from('pagos').insert(buildPagoPayload(true))
      if (pagoErr && /comprobante_url/i.test(pagoErr.message || '')) {
        // Migration pagos_comprobante.sql no aplicada — retry sin la columna.
        const r = await supabase.from('pagos').insert(buildPagoPayload(false))
        pagoErr = r.error
      }
      if (pagoErr) {
        console.error('[pagar] pagos insert failed (non-fatal):', pagoErr)
      }
    }

    // ── Ledger: insert ingreso in transacciones ────────────────────────────
    try {
      const { error: ledgerError } = await supabase.from('transacciones').insert({
        tipo: 'ingreso',
        monto: factura.total,
        fecha: new Date().toISOString().split('T')[0],
        concepto: metodo
          ? `Factura ${factura.numero} pagada · ${metodo}${referencia ? ` · Ref ${referencia}` : ''}`
          : `Factura ${factura.numero} pagada`,
        referencia_tipo: 'factura',
        referencia_id: params.id,
        usuario_id: user.id,
      })
      if (ledgerError) {
        console.error('[pagar] ledger insert failed (non-fatal):', ledgerError)
      }
    } catch (ledgerErr) {
      console.error('[pagar] ledger insert threw (non-fatal):', ledgerErr)
    }

    // ── Client debt tracking ───────────────────────────────────────────────
    try {
      const { data: c } = await supabase
        .from('clientes').select('deuda_total').eq('id', factura.cliente_id).maybeSingle()
      if (c) {
        await supabase.from('clientes')
          .update({ deuda_total: Math.max(0, Number(c.deuda_total ?? 0) - Number(factura.total ?? 0)) })
          .eq('id', factura.cliente_id)
      }
    } catch (err) {
      console.error('[pagar] deuda_total non-fatal:', err)
    }

    void logActivity(supabase, {
      user_id: user.id,
      action: 'pagar_factura',
      resource: 'facturas',
      resource_id: params.id,
      estado_anterior: factura.estado,
      estado_nuevo: 'pagada',
      details: {
        numero: factura.numero,
        monto: factura.total,
        metodo: metodo ?? null,
        referencia: referencia ?? null,
        has_comprobante: Boolean(comprobanteUrl),
      },
    })

    return NextResponse.json({
      message: `Factura ${factura.numero} marcada como pagada`,
      factura: updated,
    })
  } catch (err) {
    console.error('[POST /api/facturas/[id]/pagar]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
