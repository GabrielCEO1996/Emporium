import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RouteContext { params: { id: string } }

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('facturas')
    .select('*, cliente:clientes(*), vendedor:profiles(*), items:factura_items(*)')
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.code === 'PGRST116' ? 'Factura no encontrada' : error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  const isAdmin = profile?.rol === 'admin'

  const body = await request.json()

  // Fetch current estado to validate transitions
  const { data: current } = await supabase.from('facturas').select('estado').eq('id', params.id).single()
  if (!current) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

  // Admin-only estados
  const adminOnlyEstados = ['anulada', 'pagada']
  if (body.estado && adminOnlyEstados.includes(body.estado) && !isAdmin) {
    return NextResponse.json({ error: 'Solo administradores pueden cambiar a ese estado' }, { status: 403 })
  }

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Only admins can delete facturas
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores pueden eliminar facturas' }, { status: 403 })

  const { data: existing } = await supabase.from('facturas').select('id, estado, numero').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

  if (existing.estado === 'pagada') {
    return NextResponse.json({ error: 'No se puede eliminar una factura pagada. Anúlela primero.' }, { status: 409 })
  }

  await supabase.from('factura_items').delete().eq('factura_id', params.id)
  const { error } = await supabase.from('facturas').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: `Factura ${existing.numero} eliminada` })
}
