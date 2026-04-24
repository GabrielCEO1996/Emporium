import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Playfair_Display, Inter } from 'next/font/google'

// Luxury typography: editorial serif for headers, humanist sans for body.
// Exposed as CSS variables so Tailwind can consume them via the theme
// extension in tailwind.config.ts (fontFamily.serif / fontFamily.sans).
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // NOTE: We intentionally use `.maybeSingle()` here. A newly signed-up
  // user may briefly lack a profile row while the `handle_new_user`
  // trigger runs — `.single()` would throw and surface as a client
  // exception page. With `.maybeSingle()` we gracefully fall through
  // to the default `comprador` role and let them into /tienda.
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle()

  // Only cliente/comprador roles (and admin for testing) can access the store
  const rol = profile?.rol ?? 'comprador'
  if (['admin', 'vendedor', 'conductor'].includes(rol)) redirect('/dashboard')
  if (rol === 'pendiente') redirect('/pendiente')

  return (
    <div className={`${playfair.variable} ${inter.variable} font-sans bg-brand-cream min-h-screen text-brand-navy`}>
      {children}
    </div>
  )
}
