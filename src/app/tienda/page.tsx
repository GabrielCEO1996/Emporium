import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TiendaClient from './TiendaClient'

export const dynamic = 'force-dynamic'

export default async function TiendaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, productosRes] = await Promise.all([
    supabase.from('profiles').select('id, nombre, email, rol').eq('id', user.id).single(),
    supabase
      .from('productos')
      .select(`
        id, nombre, descripcion, categoria, imagen_url,
        presentaciones(id, nombre, precio, stock, stock_minimo, unidad, activo)
      `)
      .eq('activo', true)
      .order('nombre'),
  ])

  const profile = profileRes.data
  const productos = (productosRes.data ?? [])
    .filter((p: any) => p.presentaciones?.some((pr: any) => pr.activo))
    .map((p: any) => ({ ...p, presentaciones: p.presentaciones.filter((pr: any) => pr.activo) }))

  // Get cliente linked record for direccion
  const { data: clienteData } = await supabase
    .from('clientes')
    .select('id, direccion, telefono, whatsapp')
    .eq('email', user.email ?? '')
    .maybeSingle()

  return (
    <TiendaClient
      profile={profile as any}
      productos={productos as any[]}
      clienteInfo={clienteData as any}
    />
  )
}
