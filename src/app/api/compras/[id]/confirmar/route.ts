import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/compras/[id]/confirmar — ADMIN ONLY
// borrador → confirmada (admin reviews and approves the purchase order)
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const { data: compra } = await supabase.from('compras').select('estado').eq('id', params.id).single()
  if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
  if (compra.estado !== 'borrador') {
    return NextResponse.json({ error: `Solo se pueden confirmar compras en borrador (estado: ${compra.estado})` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('compras')
    .update({ estado: 'confirmada', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
