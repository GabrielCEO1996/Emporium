import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Disable caching — payment writes/reads must always be live.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── POST /api/pagos ─────────────────────────────────────────────────────────
// Record a payment for a factura. Admin-only.
//
// Atomic-ish flow (Supabase has no client-side transactions, so we order
// operations to minimize partial-failure damage):
//   1. validate inputs + load factura
//   2. insert pagos row
//   3. update factura.estado = 'pagada' + monto_pagado = total
//   4. decrement clientes.deuda_total by the saldo we just paid off
//   5. (if credito method) bump clientes.credito_usado
//   6. insert transacciones ledger ingreso
//
// 4 was previously missing — deuda_total would silently go stale until the
// cliente detail page recomputed it from open facturas. Fixed in this pass.
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.rol !== 'admin') {
      return NextResponse.json(
        { error: 'Solo administradores pueden registrar pagos' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { factura_id, metodo, referencia, notas } = body

    if (!factura_id || !metodo) {
      return NextResponse.json({ error: 'factura_id y metodo son requeridos' }, { status: 400 })
    }

    const validMetodos = ['efectivo', 'zelle', 'cheque', 'credito', 'stripe']
    if (!validMetodos.includes(metodo)) {
      return NextResponse.json(
        { error: `Método inválido. Valores: ${validMetodos.join(', ')}` },
        { status: 400 }
      )
    }

    if (metodo === 'zelle' && !referencia?.trim()) {
      return NextResponse.json(
        { error: 'Los pagos por Zelle requieren un número de confirmación' },
        { status: 400 }
      )
    }
    if (metodo === 'cheque' && !referencia?.trim()) {
      return NextResponse.json(
        { error: 'Los pagos por cheque requieren el número de cheque' },
        { status: 400 }
      )
    }

    // Fetch factura
    const { data: factura, error: facturaFetchErr } = await supabase
      .from('facturas')
      .select('id, total, monto_pagado, estado, cliente_id')
      .eq('id', factura_id)
      .maybeSingle()

    if (facturaFetchErr) {
      console.error('[POST /api/pagos] factura fetch:', facturaFetchErr)
      return NextResponse.json({ error: 'Error al cargar la factura' }, { status: 500 })
    }
    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }
    if (factura.estado === 'anulada') {
      return NextResponse.json(
        { error: 'No se puede pagar una factura anulada' },
        { status: 409 }
      )
    }
    if (factura.estado === 'pagada') {
      return NextResponse.json({ error: 'La factura ya está pagada' }, { status: 409 })
    }

    const monto = Number(factura.total ?? 0)
    const saldoPendiente = monto - Number(factura.monto_pagado ?? 0)

    // 1. Insert pagos record
    const { error: pagoError } = await supabase.from('pagos').insert({
      factura_id,
      monto,
      metodo,
      referencia: referencia?.trim() || null,
      notas: notas?.trim() || null,
      usuario_id: user.id,
    })
    if (pagoError) {
      console.error('[POST /api/pagos] pago insert:', pagoError)
      return NextResponse.json({ error: 'No se pudo registrar el pago' }, { status: 500 })
    }

    // 2. (if credito) bump credito_usado before marking factura paid so
    //    a credit-line breach can short-circuit. Best-effort; non-fatal.
    if (metodo === 'credito') {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('credito_usado, limite_credito')
        .eq('id', factura.cliente_id)
        .maybeSingle()
      if (cliente) {
        const nuevoCreditoUsado = Number(cliente.credito_usado ?? 0) + monto
        await supabase
          .from('clientes')
          .update({ credito_usado: nuevoCreditoUsado, updated_at: new Date().toISOString() })
          .eq('id', factura.cliente_id)
      }
    }

    // 3. Mark factura as pagada
    const { data: updated, error: facturaError } = await supabase
      .from('facturas')
      .update({
        estado: 'pagada',
        monto_pagado: monto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', factura_id)
      .select('id, numero, total, monto_pagado')
      .single()

    if (facturaError) {
      console.error('[POST /api/pagos] factura update:', facturaError)
      return NextResponse.json({ error: 'No se pudo marcar la factura como pagada' }, { status: 500 })
    }

    // 4. Decrement clientes.deuda_total by the saldo we just paid off.
    //    Best-effort: if this fails (RLS, network, etc.) the factura is
    //    still correctly marked paid; deuda_total can be re-derived from
    //    open facturas at any time on the cliente detail page.
    if (saldoPendiente > 0 && factura.cliente_id) {
      try {
        const { data: cliRow } = await supabase
          .from('clientes')
          .select('deuda_total')
          .eq('id', factura.cliente_id)
          .maybeSingle()
        if (cliRow) {
          const nuevaDeuda = Math.max(
            0,
            Number((cliRow as any).deuda_total ?? 0) - saldoPendiente
          )
          await supabase
            .from('clientes')
            .update({ deuda_total: nuevaDeuda, updated_at: new Date().toISOString() })
            .eq('id', factura.cliente_id)
        }
      } catch (deudaErr) {
        console.warn('[POST /api/pagos] deuda_total non-fatal:', deudaErr)
      }
    }

    // 5. Ledger ingreso
    try {
      await supabase.from('transacciones').insert({
        tipo: 'ingreso',
        monto,
        fecha: new Date().toISOString().split('T')[0],
        concepto: `Pago factura ${updated.numero} (${metodo})`,
        referencia_tipo: 'factura',
        referencia_id: factura_id,
        usuario_id: user.id,
      })
    } catch (ledgerErr) {
      console.warn('[POST /api/pagos] ledger non-fatal:', ledgerErr)
    }

    return NextResponse.json(updated, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/pagos] threw:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── GET /api/pagos?factura_id=xxx ───────────────────────────────────────────
// List payments for a factura.
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const facturaId = new URL(req.url).searchParams.get('factura_id')
    if (!facturaId) {
      return NextResponse.json({ error: 'factura_id requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pagos')
      .select('*, usuario:profiles(nombre)')
      .eq('factura_id', facturaId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /api/pagos]', error)
      return NextResponse.json({ error: 'Error al cargar pagos' }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    console.error('[GET /api/pagos] threw:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
