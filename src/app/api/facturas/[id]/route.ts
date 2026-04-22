import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RouteContext {
  params: { id: string }
}

// ─── GET /api/facturas/[id] ──────────────────────────────────────────────────

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data, error } = await supabase
      .from('facturas')
      .select(
        `
        *,
        cliente:clientes(*),
        vendedor:profiles(*),
        items:factura_items(*)
        `
      )
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/facturas/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── PUT /api/facturas/[id] ──────────────────────────────────────────────────

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()

    // Only allow specific fields to be updated
    const allowedFields = [
      'estado',
      'monto_pagado',
      'fecha_vencimiento',
      'notas',
    ]

    const updates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos válidos para actualizar' },
        { status: 400 }
      )
    }

    // Validate estado if provided
    const validEstados = ['emitida', 'pagada', 'anulada', 'con_nota_credito']
    if (updates.estado && !validEstados.includes(updates.estado)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${validEstados.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate monto_pagado if provided
    if (updates.monto_pagado !== undefined) {
      if (typeof updates.monto_pagado !== 'number' || updates.monto_pagado < 0) {
        return NextResponse.json(
          { error: 'monto_pagado debe ser un número no negativo' },
          { status: 400 }
        )
      }
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('facturas')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[PUT /api/facturas/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── DELETE /api/facturas/[id] ───────────────────────────────────────────────

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Only allow deletion of 'anulada' or 'emitida' invoices
    const { data: existing, error: fetchError } = await supabase
      .from('facturas')
      .select('id, estado, numero')
      .eq('id', params.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (existing.estado === 'pagada') {
      return NextResponse.json(
        { error: 'No se puede eliminar una factura pagada. Anúlela primero.' },
        { status: 409 }
      )
    }

    // Delete items first (foreign key constraint)
    const { error: itemsError } = await supabase
      .from('factura_items')
      .delete()
      .eq('factura_id', params.id)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    const { error } = await supabase
      .from('facturas')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { message: `Factura ${existing.numero} eliminada correctamente` },
      { status: 200 }
    )
  } catch (err) {
    console.error('[DELETE /api/facturas/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
