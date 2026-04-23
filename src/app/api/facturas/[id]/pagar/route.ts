import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RouteContext {
  params: { id: string }
}

// ─── POST /api/facturas/[id]/pagar ──────────────────────────────────────────
// Marks an invoice as fully paid: estado = 'pagada', monto_pagado = total

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Fetch current invoice
    const { data: factura, error: fetchError } = await supabase
      .from('facturas')
      .select('id, numero, estado, total, monto_pagado')
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

    // Update to pagada
    const { data: updated, error: updateError } = await supabase
      .from('facturas')
      .update({
        estado: 'pagada',
        monto_pagado: factura.total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

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

    return NextResponse.json({
      message: `Factura ${factura.numero} marcada como pagada`,
      factura: updated,
    })
  } catch (err) {
    console.error('[POST /api/facturas/[id]/pagar]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
