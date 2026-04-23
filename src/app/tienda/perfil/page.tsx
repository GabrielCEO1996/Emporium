import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PerfilClient from './PerfilClient'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nombre, email, rol, solicita_vendedor')
    .eq('id', user.id)
    .single()

  // Prefer user_id; fall back to email for legacy rows
  let clienteData: any = null
  {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, whatsapp, direccion, ciudad, tipo_cliente, credito_autorizado, limite_credito, credito_usado')
      .eq('user_id', user.id)
      .maybeSingle()
    clienteData = data
  }
  if (!clienteData && user.email) {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, whatsapp, direccion, ciudad, tipo_cliente, credito_autorizado, limite_credito, credito_usado')
      .eq('email', user.email)
      .maybeSingle()
    clienteData = data
  }

  return <PerfilClient profile={profile as any} clienteInfo={clienteData as any} />
}
