import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TiendaClient from './TiendaClient'
import { isStripeConfigured } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export default async function TiendaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, productosRes] = await Promise.all([
    // maybeSingle() so a missing profile row doesn't crash the page
    // for a freshly signed-up user whose trigger hasn't run yet.
    supabase.from('profiles').select('id, nombre, email, rol').eq('id', user.id).maybeSingle(),
    supabase
      .from('productos')
      .select(`
        id, codigo, nombre, descripcion, categoria, imagen_url,
        presentaciones(
          id, nombre, precio, stock, stock_minimo, unidad, activo,
          inventario(stock_total, stock_reservado, stock_disponible, precio_venta)
        )
      `)
      .eq('activo', true)
      .order('nombre'),
  ])

  const profile = profileRes.data
  const productos = (productosRes.data ?? [])
    .filter((p: any) => p.presentaciones?.some((pr: any) => pr.activo))
    .map((p: any) => ({
      ...p,
      presentaciones: p.presentaciones
        .filter((pr: any) => pr.activo)
        .map((pr: any) => {
          const inv = Array.isArray(pr.inventario) ? pr.inventario[0] : pr.inventario
          const stockDisponible = inv?.stock_disponible ?? pr.stock ?? 0
          const precioVenta = inv?.precio_venta && inv.precio_venta > 0 ? inv.precio_venta : (pr.precio ?? 0)
          return {
            ...pr,
            precio: precioVenta,
            stock: stockDisponible,
            stock_disponible: stockDisponible,
            agotado: stockDisponible <= 0,
            ultimas_unidades: stockDisponible > 0 && stockDisponible <= 5,
          }
        }),
    }))

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

  // Empresa payment info — shown inside the checkout modal when the client
  // picks Zelle or bank transfer, so they know where to send the money.
  const { data: empresaPayment } = await supabase
    .from('empresa_config')
    .select('zelle_numero, zelle_titular, banco_nombre, banco_cuenta, banco_routing, banco_titular')
    .limit(1)
    .maybeSingle()

  return (
    <TiendaClient
      profile={profile as any}
      productos={productos as any[]}
      clienteInfo={clienteData as any}
      empresaPayment={empresaPayment as any}
      stripeEnabled={isStripeConfigured()}
    />
  )
}
