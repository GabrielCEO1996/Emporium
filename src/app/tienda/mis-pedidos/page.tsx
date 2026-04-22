import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MisPedidosClient from './MisPedidosClient'

export const dynamic = 'force-dynamic'

export default async function MisPedidosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find linked cliente
  const { data: clienteData } = await supabase
    .from('clientes')
    .select('id')
    .eq('email', user.email ?? '')
    .maybeSingle()

  const pedidos = clienteData?.id
    ? (await supabase
        .from('pedidos')
        .select(`
          id, numero, estado, fecha_pedido, total, subtotal, notas,
          pedido_items(
            id, cantidad, precio_unitario, subtotal,
            presentaciones(nombre, productos(nombre))
          )
        `)
        .eq('cliente_id', clienteData.id)
        .order('created_at', { ascending: false })
        .limit(50)
      ).data ?? []
    : []

  return <MisPedidosClient pedidos={pedidos as any[]} />
}
