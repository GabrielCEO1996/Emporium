import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import Loader from './components/Loader'
import './styles/tienda.css'

// Editorial serif (display) + humanist sans (body/UI). Pesos según el HTML
// de referencia: Cormorant 300/400/500 normal+italic; Inter 300/400/500/600.
// Exposed via CSS vars so the existing Tailwind theme.fontFamily mapping
// (serif → var(--font-serif), sans → var(--font-sans)) sigue funcionando.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
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
    <div
      className={`${cormorant.variable} ${inter.variable} tienda-screen font-sans min-h-screen`}
    >
      {/* Fondo cósmico fixed detrás de TODO. Se monta como hermano de
          children (no como background del wrapper) porque el wrapper a
          veces queda oscurecido por reglas de Tailwind / specificity de
          el body — un div fixed con z-index -1 elimina ese riesgo. */}
      <div className="tienda-bg-cosmos" aria-hidden="true" />
      <Loader />
      {children}
    </div>
  )
}
