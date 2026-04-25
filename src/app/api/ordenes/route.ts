import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── GET /api/ordenes ───────────────────────────────────────────────────────
// Lists ordenes. Admin/vendedor see all; clients see only their own.
// Optional filter: ?estado=pendiente|aprobada|rechazada|cancelada
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single()

      const isStaff = profile?.rol === 'admin' || profile?.rol === 'vendedor'

      const url = new URL(req.url)
      const estado = url.searchParams.get('estado')

      let query = supabase
        .from('ordenes')
        .select(`
          id, numero, estado, total, notas, direccion_entrega,
          motivo_rechazo, created_at, updated_at,
          cliente:clientes(id, nombre, rif, email, telefono),
          items:orden_items(
            id, cantidad, precio_unitario, subtotal,
            presentacion:presentaciones(id, nombre, producto:productos(id, nombre))
          ),
          pedido:pedidos!pedidos_orden_id_fkey(id, numero, estado)
        `)
        .order('created_at', { ascending: false })

      if (!isStaff) {
        query = query.eq('user_id', user.id)
      }
      if (estado) {
        query = query.eq('estado', estado)
      }

      const { data, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)

  } catch (err) {
    console.error('[GET /api/ordenes]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
