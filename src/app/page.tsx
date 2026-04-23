import { createClient } from '@/lib/supabase/server'
import LandingClient from './LandingClient'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createClient()

  // Auth state (may be null for anonymous visitors)
  const { data: { user } } = await supabase.auth.getUser()

  // Resolve role for logged-in users so the CTA can deep-link correctly
  let userRole: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle()
    userRole = profile?.rol ?? null
  }

  // Public empresa config (logo + nombre) — uses anon key, RLS must allow SELECT
  const { data: empresa } = await supabase
    .from('empresa_config')
    .select('nombre, logo_url')
    .limit(1)
    .maybeSingle()

  return (
    <LandingClient
      empresa={empresa ?? null}
      productos={[]}
      isLoggedIn={!!user}
      userRole={userRole}
    />
  )
}
