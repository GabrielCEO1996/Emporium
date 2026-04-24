import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'
import { requireAdminOrVendedor } from '@/lib/auth'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    // AUTH: staff only (admin or vendedor). Non-staff should never be able
    // to flip a factura state to "enviada".
    const gate = await requireAdminOrVendedor(supabase)
    if (!gate.ok) return gate.response
    const { user } = gate

    const { data: prev } = await supabase
      .from('facturas')
      .select('estado, numero, pedido_id, pedidos:pedidos!facturas_pedido_id_fkey(numero)')
      .eq('id', params.id)
      .maybeSingle()

    const { data, error } = await supabase
      .from('facturas')
      .update({ estado: 'enviada', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const pedidoNumero =
      Array.isArray((prev as any)?.pedidos)
        ? (prev as any)?.pedidos[0]?.numero ?? null
        : (prev as any)?.pedidos?.numero ?? null

    void logActivity(supabase as any, {
      user_id: user.id,
      action: 'enviar_factura',
      resource: 'facturas',
      resource_id: params.id,
      estado_anterior: (prev as any)?.estado ?? null,
      estado_nuevo: 'enviada',
      details: {
        factura_id:     params.id,
        factura_numero: (prev as any)?.numero ?? null,
        pedido_id:      (prev as any)?.pedido_id ?? null,
        pedido_numero:  pedidoNumero,
      },
    })

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
