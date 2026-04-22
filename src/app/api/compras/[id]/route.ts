import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Purchase detail contains cost data — admin only
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { data, error } = await supabase
    .from('compras')
    .select(`
      *,
      proveedor:proveedores(id, nombre, empresa),
      items:compra_items(
        id, cantidad, precio_costo, subtotal,
        presentacion:presentaciones(id, nombre, stock, productos(nombre))
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  // Get items to reverse stock
  const { data: compra } = await supabase
    .from('compras')
    .select('*, items:compra_items(presentacion_id, cantidad)')
    .eq('id', params.id)
    .single()

  if (!compra) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  // Reverse stock for all items in parallel (replaces sequential loop)
  await Promise.all((compra.items ?? []).map(async (item: any) => {
    const { data: pres } = await supabase
      .from('presentaciones')
      .select('stock')
      .eq('id', item.presentacion_id)
      .single()
    if (pres) {
      const newStock = Math.max(0, (pres.stock ?? 0) - item.cantidad)
      await supabase
        .from('presentaciones')
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', item.presentacion_id)
    }
  }))

  // Delete compra (cascade deletes items)
  const { error } = await supabase.from('compras').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
