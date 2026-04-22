import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MiCuentaClient from './MiCuentaClient'

export const dynamic = 'force-dynamic'

export default async function MiCuentaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Staff goes to dashboard
  if (profile?.rol && ['admin', 'vendedor', 'conductor'].includes(profile.rol)) {
    redirect('/dashboard')
  }

  // Try to find a matching cliente record by email
  const { data: clienteData } = await supabase
    .from('clientes')
    .select('id')
    .eq('email', user.email ?? '')
    .maybeSingle()

  const clienteId = clienteData?.id ?? null

  // Fetch pedidos and facturas if linked to a cliente record
  const [pedidosRes, facturasRes] = await Promise.all([
    clienteId
      ? supabase
          .from('pedidos')
          .select('id, numero, estado, fecha_pedido, total')
          .eq('cliente_id', clienteId)
          .order('fecha_pedido', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    clienteId
      ? supabase
          .from('facturas')
          .select('id, numero, estado, fecha_emision, total, monto_pagado')
          .eq('cliente_id', clienteId)
          .order('fecha_emision', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <MiCuentaClient
      profile={profile as any}
      pedidos={(pedidosRes.data ?? []) as any[]}
      facturas={(facturasRes.data ?? []) as any[]}
      isLinked={!!clienteId}
    />
  )
}
