import { createClient } from '@/lib/supabase/server'
import LandingClient from './LandingClient'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createClient()

  // Check auth state (may be null for anonymous visitors)
  const { data: { user } } = await supabase.auth.getUser()

  // Resolve role for logged-in users
  let userRole: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle()
    userRole = profile?.rol ?? null
  }

  // Fetch public empresa config (uses anon key, RLS must allow SELECT)
  const { data: empresa } = await supabase
    .from('empresa_config')
    .select('nombre, logo_url')
    .limit(1)
    .maybeSingle()

  // Fetch first 6 active products with lowest price
  const { data: productosRaw } = await supabase
    .from('productos')
    .select(`
      id, nombre, categoria, imagen_url,
      presentaciones(precio, activo)
    `)
    .eq('activo', true)
    .limit(6)
    .order('nombre')

  const productos = (productosRaw ?? []).map((p: any) => {
    const precios = (p.presentaciones ?? [])
      .filter((pr: any) => pr.activo)
      .map((pr: any) => Number(pr.precio))

    return {
      id:           p.id,
      nombre:       p.nombre,
      categoria:    p.categoria ?? null,
      imagen_url:   p.imagen_url ?? null,
      precio_desde: precios.length > 0 ? Math.min(...precios) : 0,
    }
  }).filter((p: any) => p.precio_desde > 0)

  return (
    <LandingClient
      empresa={empresa ?? null}
      productos={productos}
      isLoggedIn={!!user}
      userRole={userRole}
    />
  )
}
