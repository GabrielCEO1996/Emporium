import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'
import { requireAdmin, requireUser } from '@/lib/auth'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RouteContext { params: { id: string } }

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = createClient()

  const gate = await requireUser(supabase)
  if (!gate.ok) return gate.response
  const { user, profile } = gate

  const { data, error } = await supabase
    .from('facturas')
    .select('*, cliente:clientes(*), vendedor:profiles(*), items:factura_items(*)')
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.code === 'PGRST116' ? 'Factura no encontrada' : error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
  }

  // Role-based scoping: non-staff callers can only read facturas linked to
  // their own cliente record. Vendedor sees only their own facturas.
  if (profile.rol === 'vendedor' && (data as any).vendedor_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (profile.rol === 'comprador' || profile.rol === 'cliente') {
    // Match via clientes.user_id → factura.cliente_id chain (cliente column is inlined).
    const clienteUserId = (data as any).cliente?.user_id ?? null
    if (clienteUserId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteContext) {
  const supabase = createClient()

  // AUTH: admin-only. Non-admins should never edit factura totals, monto_pagado,
  // or lock-and-key fields. State changes go through dedicated routes (pagar, enviada).
  const gate = await requireAdmin(supabase)
  if (!gate.ok) return gate.response

  const body = await request.json()

  // Fetch current estado to validate transitions
  const { data: current } = await supabase.from('facturas').select('estado').eq('id', params.id).single()
  if (!current) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

  const allowedFields = ['estado', 'monto_pagado', 'fecha_vencimiento', 'notas']
  const updates: Record<string, any> = {}
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Sin campos válidos para actualizar' }, { status: 400 })
  }

  const validEstados = ['emitida', 'enviada', 'pagada', 'anulada', 'con_nota_credito']
  if (updates.estado && !validEstados.includes(updates.estado)) {
    return NextResponse.json({ error: `Estado inválido. Valores: ${validEstados.join(', ')}` }, { status: 400 })
  }

  // Bound monto_pagado: cannot exceed factura.total and cannot be negative.
  if ('monto_pagado' in updates) {
    const n = Number(updates.monto_pagado)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'monto_pagado inválido' }, { status: 400 })
    }
    const { data: fac } = await supabase.from('facturas').select('total').eq('id', params.id).maybeSingle()
    const cap = Number(fac?.total ?? 0)
    if (n > cap) {
      return NextResponse.json({ error: `monto_pagado no puede superar el total (${cap})` }, { status: 400 })
    }
    updates.monto_pagado = n
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('facturas')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const supabase = createClient()

  // AUTH: admin-only.
  const gate = await requireAdmin(supabase)
  if (!gate.ok) return gate.response
  const { user } = gate

  const { data: existing } = await supabase.from('facturas').select('id, estado, numero, total, cliente_id').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

  if (existing.estado === 'pagada') {
    return NextResponse.json({ error: 'No se puede eliminar una factura pagada. Anúlela primero.' }, { status: 409 })
  }

  // Cascade delete: pagos → transacciones → factura_items → factura
  try {
    await supabase.from('pagos').delete().eq('factura_id', params.id)
    await supabase.from('transacciones').delete().eq('referencia_id', params.id)
    await supabase.from('factura_items').delete().eq('factura_id', params.id)
    const { error } = await supabase.from('facturas').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }

  // Client debt tracking: deleted unpaid invoice → release deuda_total
  if (existing.estado !== 'pagada') {
    try {
      const { data: c } = await supabase
        .from('clientes').select('deuda_total').eq('id', existing.cliente_id).maybeSingle()
      if (c) {
        await supabase.from('clientes')
          .update({ deuda_total: Math.max(0, Number(c.deuda_total ?? 0) - Number(existing.total ?? 0)) })
          .eq('id', existing.cliente_id)
      }
    } catch (err) {
      console.error('[facturas DELETE] deuda_total non-fatal:', err)
    }
  }

  void logActivity(supabase, {
    user_id: user.id,
    action: 'eliminar_factura',
    resource: 'facturas',
    resource_id: params.id,
    estado_anterior: existing.estado,
    estado_nuevo: 'eliminada',
    details: { numero: existing.numero, total: existing.total },
  })

  return NextResponse.json({ message: `Factura ${existing.numero} eliminada` })
}
