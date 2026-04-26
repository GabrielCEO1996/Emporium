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

  const [pedidosRes, ordenesRes, facturasRes] = await Promise.all([
    clienteId
      ? supabase
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
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from('ordenes')
      .select(`
        id, numero, estado, total, notas, motivo_rechazo, created_at,
        orden_items(
          id, cantidad, precio_unitario, subtotal,
          presentaciones(nombre, productos(nombre))
        ),
        pedido:pedidos!orden_id(id, numero, estado)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    clienteId
      ? supabase
          .from('facturas')
          .select(`
            id, numero, estado, total, monto_pagado,
            fecha_emision, fecha_vencimiento, pedido_id
          `)
          .eq('cliente_id', clienteId)
          .order('fecha_emision', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as any[] }),
  ])

  return (
    <MisPedidosClient
      pedidos={(pedidosRes.data ?? []) as any[]}
      ordenes={(ordenesRes.data ?? []) as any[]}
      facturas={(facturasRes.data ?? []) as any[]}
      clienteId={clienteId}
      userId={user.id}
    />
  )
}
