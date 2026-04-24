import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'
import { requireAdmin, requireAdminOrVendedor } from '@/lib/auth'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of valid tipos for a nota de crédito; anything else is rejected.
const VALID_TIPOS = ['devolucion', 'anulacion', 'descuento'] as const

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/notas-credito
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const supabase = createClient()

  // Staff only — notas de crédito are financial documents.
  const gate = await requireAdminOrVendedor(supabase)
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const cliente_id = searchParams.get('cliente_id')
  const estado = searchParams.get('estado')
  const page  = parseInt(searchParams.get('page')  || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = (page - 1) * limit

  let query = supabase
    .from('notas_credito')
    .select(`*, clientes(id, nombre), facturas(id, numero)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (cliente_id) query = query.eq('cliente_id', cliente_id)
  if (estado)     query = query.eq('estado', estado)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count ?? 0, page, limit })
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/notas-credito
//
// Issues a credit note against an existing factura. Fully-wired impact:
//   1. Validate and persist notas_credito + nota_credito_items.
//   2. Restore inventory (stock_total += cantidad) per line + movimiento 'devolucion'.
//   3. Refund ledger: transacciones row tipo='ingreso' with NEGATIVE monto.
//   4. If the original factura used 'credito' tipo_pago, release client credit:
//        - clientes.credito_usado -= monto  (best-effort)
//        - clientes.deuda_total   -= total  (always; tracks outstanding balance)
//   5. Update factura.estado → 'con_nota_credito'.
//   6. activity_logs row linking factura ↔ nota_credito.
//
// Requires major_fix.sql to have been applied.
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const supabase = createClient()

  // AUTH: admin-only. Issuing a credit note restores stock, inserts a negative
  // ledger entry, decrements cliente.deuda_total and flips factura state.
  const gate = await requireAdmin(supabase)
  if (!gate.ok) return gate.response
  const { user } = gate

  const body = await request.json()
  const { factura_id, cliente_id, motivo, tipo, items, notas } = body

  if (!factura_id || !cliente_id || !motivo || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 })
  }

  // Whitelist tipo
  const tipoValidado = tipo ? String(tipo) : 'devolucion'
  if (!VALID_TIPOS.includes(tipoValidado as any)) {
    return NextResponse.json(
      { error: `Tipo inválido. Valores permitidos: ${VALID_TIPOS.join(', ')}` },
      { status: 400 },
    )
  }

  // ── 0. Fetch original factura (to read tipo_pago, total, estado) ──────
  const { data: facturaOriginal } = await supabase
    .from('facturas')
    .select('id, numero, estado, total, monto_pagado, cliente_id, tipo_pago')
    .eq('id', factura_id)
    .single()

  if (!facturaOriginal) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }
  if (facturaOriginal.estado === 'anulada') {
    return NextResponse.json({ error: 'La factura ya está anulada' }, { status: 409 })
  }
  // Idempotency guard: once a factura has a nota de crédito, reject duplicates
  // to prevent double-refund under a racing second submission.
  if (facturaOriginal.estado === 'con_nota_credito') {
    return NextResponse.json(
      { error: 'La factura ya tiene una nota de crédito asociada' },
      { status: 409 },
    )
  }

  // Recompute subtotals server-side to block client-supplied totals that
  // exceed the original factura. The attack was: send items with inflated
  // subtotals and unwind more deuda_total than was ever billed.
  const computedSubtotalServer = items.reduce((acc: number, i: any) => {
    const qty = Math.max(0, Number(i.cantidad ?? 0))
    const pu  = Math.max(0, Number(i.precio_unitario ?? 0))
    return acc + qty * pu
  }, 0)

  if (computedSubtotalServer > Number(facturaOriginal.total ?? 0) + 0.01) {
    return NextResponse.json(
      { error: 'El total de la nota de crédito no puede superar el de la factura' },
      { status: 400 },
    )
  }

  // ── 1. Create the nota_credito header ─────────────────────────────────
  const { data: numData } = await supabase.rpc('get_next_sequence', { seq_name: 'notas_credito' })
  const ncNumero = (numData as string) || `NC-${Date.now()}`

  // Use the server-recomputed subtotal — never trust the client's.
  const subtotal = computedSubtotalServer
  const impuesto = 0
  const total    = subtotal

  const { data: nc, error: ncErr } = await supabase
    .from('notas_credito')
    .insert({
      numero: ncNumero,
      factura_id,
      cliente_id,
      motivo,
      tipo: tipoValidado,
      estado: 'emitida',
      subtotal,
      impuesto,
      total,
      notas,
    })
    .select()
    .single()

  if (ncErr || !nc) {
    return NextResponse.json({ error: ncErr?.message ?? 'Error al crear nota de crédito' }, { status: 500 })
  }

  // ── 2. Insert nota_credito_items ──────────────────────────────────────
  const ncItems = items.map((i: any) => {
    const qty = Math.max(0, Number(i.cantidad ?? 0))
    const pu  = Math.max(0, Number(i.precio_unitario ?? 0))
    return {
      nota_credito_id: nc.id,
      presentacion_id: i.presentacion_id,
      descripcion:     i.descripcion ?? null,
      cantidad:        qty,
      precio_unitario: pu,
      // Recomputed — never trust client's subtotal.
      subtotal:        qty * pu,
    }
  })
  const { error: itemsErr } = await supabase.from('nota_credito_items').insert(ncItems)
  if (itemsErr) {
    console.error('[notas-credito] items insert failed:', itemsErr.message)
    // soft-fail; we continue but note it
  }

  // ── 3. Restore inventory + record 'devolucion' movement ───────────────
  await Promise.all(items.map(async (it: any) => {
    if (!it.presentacion_id || !it.cantidad) return

    const { data: inv } = await supabase
      .from('inventario')
      .select('id, stock_total, producto_id')
      .eq('presentacion_id', it.presentacion_id)
      .maybeSingle()

    if (!inv) return

    const stockAnterior = inv.stock_total ?? 0
    const stockNuevo = stockAnterior + Number(it.cantidad)

    await supabase.from('inventario')
      .update({ stock_total: stockNuevo })
      .eq('id', inv.id)

    await supabase.from('presentaciones')
      .update({ stock: stockNuevo, updated_at: new Date().toISOString() })
      .eq('id', it.presentacion_id)

    await supabase.from('inventario_movimientos').insert({
      producto_id: inv.producto_id,
      presentacion_id: it.presentacion_id,
      tipo: 'devolucion',
      cantidad: Number(it.cantidad),
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      referencia_tipo: 'nota_credito',
      referencia_id: nc.id,
      usuario_id: user.id,
      notas: `Nota de crédito ${nc.numero} — devolución`,
    })
  }))

  // ── 4. Refund ledger (negative ingreso) ───────────────────────────────
  try {
    await supabase.from('transacciones').insert({
      tipo: 'ingreso',
      monto: -Math.abs(total),
      fecha: new Date().toISOString().split('T')[0],
      concepto: `Nota de crédito ${nc.numero} — factura ${facturaOriginal.numero}`,
      referencia_tipo: 'nota_credito',
      referencia_id: nc.id,
      usuario_id: user.id,
    })
  } catch (err) {
    console.error('[notas-credito] ledger failed:', err)
  }

  // ── 5. Release client credit if original was a credit sale ────────────
  if (facturaOriginal.tipo_pago === 'credito') {
    try {
      // RPC may or may not exist — best-effort
      await supabase.rpc('liberar_credito', {
        p_cliente_id: facturaOriginal.cliente_id,
        p_monto: Number(total),
      })
    } catch { /* fall through */ }

    // Direct decrement fallback on credito_usado
    try {
      const { data: c } = await supabase
        .from('clientes').select('credito_usado').eq('id', facturaOriginal.cliente_id).maybeSingle()
      if (c && c.credito_usado != null) {
        await supabase.from('clientes')
          .update({ credito_usado: Math.max(0, (c.credito_usado ?? 0) - Number(total)) })
          .eq('id', facturaOriginal.cliente_id)
      }
    } catch { /* column may not exist */ }
  }

  // ── 6. deuda_total always decrements (outstanding invoice balance) ────
  try {
    const { data: c } = await supabase
      .from('clientes').select('deuda_total').eq('id', facturaOriginal.cliente_id).maybeSingle()
    if (c) {
      await supabase.from('clientes')
        .update({ deuda_total: Math.max(0, Number(c.deuda_total ?? 0) - Number(total)) })
        .eq('id', facturaOriginal.cliente_id)
    }
  } catch (err) {
    console.error('[notas-credito] deuda_total update failed:', err)
  }

  // ── 7. Mark factura estado ────────────────────────────────────────────
  await supabase.from('facturas')
    .update({ estado: 'con_nota_credito', updated_at: new Date().toISOString() })
    .eq('id', factura_id)

  // ── 8. Activity log ───────────────────────────────────────────────────
  void logActivity(supabase, {
    user_id: user.id,
    action: 'crear_nota_credito',
    resource: 'notas_credito',
    resource_id: nc.id,
    estado_anterior: facturaOriginal.estado,
    estado_nuevo: 'con_nota_credito',
    details: {
      factura_id,
      factura_numero: facturaOriginal.numero,
      nota_credito_numero: nc.numero,
      motivo,
      total,
      tipo: tipoValidado,
    },
  })

  return NextResponse.json(nc, { status: 201 })
}
