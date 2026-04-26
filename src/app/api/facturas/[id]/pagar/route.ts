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
// Marks an invoice as fully paid: estado = 'pagada', monto_pagado = total

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()

    // AUTH: admin-only — marking an invoice as paid zeroes out the customer's
    // debt and inserts an income entry in transacciones. Must never be exposed
    // to non-admin roles.
    const gate = await requireAdmin(supabase)
    if (!gate.ok) return gate.response
    const { user } = gate

    // Fetch current invoice
    const { data: factura, error: fetchError } = await supabase
      .from('facturas')
      .select('id, numero, estado, total, monto_pagado, cliente_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (factura.estado === 'anulada') {
      return NextResponse.json(
        { error: 'No se puede pagar una factura anulada' },
        { status: 409 }
      )
    }

    if (factura.estado === 'pagada') {
      return NextResponse.json(
        { error: 'La factura ya está marcada como pagada' },
        { status: 409 }
      )
    }

    // Update to pagada — incluye audit Fase 3 (pago_confirmado_at +
    // pago_confirmado_por). Defensive cascade: si las columnas no existen
    // (DB sin migrar Fase 3), retry sin ellas.
    const buildUpdate = (includeAudit: boolean): Record<string, any> => {
      const base: Record<string, any> = {
        estado: 'pagada',
        monto_pagado: factura.total,
        updated_at: new Date().toISOString(),
      }
      if (includeAudit) {
        base.pago_confirmado_at = new Date().toISOString()
        base.pago_confirmado_por = user.id
      }
      return base
    }
    let { data: updated, error: updateError } = await supabase
      .from('facturas').update(buildUpdate(true)).eq('id', params.id).select().single()
    if (updateError && /pago_confirmado/i.test(updateError.message || '')) {
      const r = await supabase
        .from('facturas').update(buildUpdate(false)).eq('id', params.id).select().single()
      updated = r.data
      updateError = r.error
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Ledger: insert ingreso in transacciones (isolated — never blocks payment)
    try {
      const { error: ledgerError } = await supabase.from('transacciones').insert({
        tipo: 'ingreso',
        monto: factura.total,
        fecha: new Date().toISOString().split('T')[0],
        concepto: `Factura ${factura.numero} pagada`,
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

    // Client debt tracking: invoice paid → deuda_total -= total
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
      details: { numero: factura.numero, monto: factura.total },
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
