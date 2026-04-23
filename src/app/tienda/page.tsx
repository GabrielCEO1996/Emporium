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

  // Get cliente linked record (includes credit info + shipping profile).
  // Prefer user_id link; fall back to email for legacy rows.
  let clienteData: any = null
  {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, direccion, telefono, whatsapp, ciudad, tipo_cliente, credito_autorizado, limite_credito, credito_usado')
      .eq('user_id', user.id)
      .maybeSingle()
    clienteData = data
  }
  if (!clienteData && user.email) {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, direccion, telefono, whatsapp, ciudad, tipo_cliente, credito_autorizado, limite_credito, credito_usado')
      .eq('email', user.email)
      .maybeSingle()
    clienteData = data
  }

  return (
    <TiendaClient
      profile={profile as any}
      productos={productos as any[]}
      clienteInfo={clienteData as any}
    />
  )
}
