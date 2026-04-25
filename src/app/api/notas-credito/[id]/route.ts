import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireAdminOrVendedor } from '@/lib/auth'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of valid estados — anything else is rejected.
const VALID_ESTADOS = ['emitida', 'aplicada', 'anulada'] as const

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()

      // Staff only — notas de crédito are financial documents.
      const gate = await requireAdminOrVendedor(supabase)
      if (!gate.ok) return gate.response

      const { data, error } = await supabase
        .from('notas_credito')
        .select(`*, clientes(*), facturas(*, clientes(*)), nota_credito_items(*)`)
        .eq('id', params.id)
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json(data)

  } catch (err) {
    console.error('[GET /api/notas-credito/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()

      // AUTH: admin-only. Edits to estado / motivo can alter downstream reporting
      // and inventory reconciliation — must not be performed by vendedor or below.
      const gate = await requireAdmin(supabase)
      if (!gate.ok) return gate.response

      const body = await request.json()
      const allowed = ['estado', 'notas', 'motivo']
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const key of allowed) {
        if (key in body) updates[key] = body[key]
      }

      // Whitelist estado
      if ('estado' in updates && !VALID_ESTADOS.includes(updates.estado as any)) {
        return NextResponse.json(
          { error: `Estado inválido. Valores permitidos: ${VALID_ESTADOS.join(', ')}` },
          { status: 400 },
        )
      }

      if (Object.keys(updates).length === 1) {
        // only updated_at — nothing to change
        return NextResponse.json({ error: 'Sin campos válidos para actualizar' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('notas_credito')
        .update(updates)
        .eq('id', params.id)
        .select()
        .single()

      if (error) {
        console.error('[PUT /api/notas-credito/[id]]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(data)

  } catch (err) {
    console.error('[PUT /api/notas-credito/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
