import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MisPedidosClient from './MisPedidosClient'

export const dynamic = 'force-dynamic'

export default async function MisPedidosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find linked cliente record by email
  const { data: clienteData } = await supabase
    .from('clientes')
    .select('id')
    .eq('email', user.email ?? '')
    .maybeSingle()

  const clienteId = clienteData?.id ?? null

  const pedidos = clienteId
    ? (await supabase
        .from('pedidos')
        .select(`
          id, numero, estado, fecha_pedido, total, notas,
          pedido_items(
            id, cantidad, precio_unitario, subtotal, presentacion_id,
            presentaciones(nombre, precio, stock, productos(nombre))
          )
        `)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(50)
      ).data ?? []
    : []

  return <MisPedidosClient pedidos={pedidos as any[]} clienteId={clienteId} />
}
