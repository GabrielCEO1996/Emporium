import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  // Only cliente role (and admin for testing) can access the store
  const rol = profile?.rol ?? 'cliente'
  if (['admin', 'vendedor', 'conductor'].includes(rol)) redirect('/dashboard')
  if (rol === 'pendiente') redirect('/pendiente')

  return <>{children}</>
}
