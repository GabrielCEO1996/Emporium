import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/pedidos/[id]/preparar — ADMIN ONLY
// confirmado → preparando (warehouse is picking the order)
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores pueden preparar pedidos' }, { status: 403 })

  const { data: pedido } = await supabase.from('pedidos').select('estado').eq('id', params.id).single()
  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (pedido.estado !== 'confirmado') {
    return NextResponse.json({ error: `Solo se pueden preparar pedidos confirmados (estado actual: ${pedido.estado})` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('pedidos')
    .update({ estado: 'preparando', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
