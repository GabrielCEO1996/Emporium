import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  // Check current state
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('estado')
    .eq('id', params.id)
    .single()

  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (pedido.estado !== 'borrador') {
    return NextResponse.json({ error: 'Solo se pueden confirmar pedidos en borrador' }, { status: 400 })
  }

  // Discount stock via stored function
  const { error: stockError } = await supabase.rpc('descontar_stock_pedido', { p_pedido_id: params.id })
  if (stockError) return NextResponse.json({ error: stockError.message }, { status: 500 })

  // Update status
  const { data, error } = await supabase
    .from('pedidos')
    .update({ estado: 'confirmado', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
