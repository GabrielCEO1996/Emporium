import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/pedidos/[id]/confirmar
// borrador → confirmada
// Vendedor (own pedido) or admin. No inventory change at this stage.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  const isAdmin = profile?.rol === 'admin'
  const isVendedor = profile?.rol === 'vendedor'

  if (!isAdmin && !isVendedor) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('estado, vendedor_id')
    .eq('id', params.id)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  if (isVendedor && pedido.vendedor_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (pedido.estado !== 'borrador') {
    return NextResponse.json(
      { error: `Solo se pueden confirmar pedidos en borrador (estado actual: ${pedido.estado})` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('pedidos')
    .update({ estado: 'confirmada', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
