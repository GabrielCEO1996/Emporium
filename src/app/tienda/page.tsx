import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TiendaClient from './TiendaClient'
import { isStripeConfigured } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// Window for "productos nuevos" — created in the last 30 days.
const NEW_PRODUCT_WINDOW_DAYS = 30

// "Pedidos en preparación" — schema's CHECK constraint allows
// 'borrador'/'confirmado'/'en_ruta'/'entregado'/'cancelado'/'facturado'.
// Active-and-not-yet-completed means: borrador (just placed) + confirmado
// (accepted) + en_ruta (out for delivery). The user's ask was for
// "pendiente, en_preparacion" which don't exist as values; this is the
// closest semantic equivalent.
const PEDIDOS_EN_PREPARACION = ['borrador', 'confirmado', 'en_ruta'] as const

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
  // picks Zelle / bank transfer / cheque, so they know where to send the money.
  // Falls back gracefully if direccion_envio_cheques (checkout_v2) hasn't
  // been added to the column list yet.
  let empresaPayment: any = null
  {
    const { data, error } = await supabase
      .from('empresa_config')
      .select('zelle_numero, zelle_titular, banco_nombre, banco_cuenta, banco_routing, banco_titular, direccion_envio_cheques')
      .limit(1)
      .maybeSingle()
    if (error && /direccion_envio_cheques/i.test(error.message || '')) {
      const retry = await supabase
        .from('empresa_config')
        .select('zelle_numero, zelle_titular, banco_nombre, banco_cuenta, banco_routing, banco_titular')
        .limit(1)
        .maybeSingle()
      empresaPayment = retry.data
    } else {
      empresaPayment = data
    }
  }

  // ─── Hero stats — Fase 5 ────────────────────────────────────────────────
  // Four small parallel queries that feed the personalised hero subtitle,
  // the meta column on the right, and the "(N)" badge on the secondary CTA.
  // Everything runs server-side under Promise.all so a slow query doesn't
  // block the others. If any one fails we degrade to zero/null silently —
  // the hero still renders with a sensible default.
  const newSinceISO = new Date(
    Date.now() - NEW_PRODUCT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const clienteId: string | undefined = clienteData?.id

  const [
    pedidosPendientesRes,
    pedidosTotalesRes,
    ultimaFacturaRes,
    productosNuevosRes,
  ] = await Promise.all([
    clienteId
      ? supabase
          .from('pedidos')
          .select('id', { count: 'exact', head: true })
          .eq('cliente_id', clienteId)
          .in('estado', PEDIDOS_EN_PREPARACION as unknown as string[])
      : Promise.resolve({ count: 0, error: null } as any),
    clienteId
      ? supabase
          .from('pedidos')
          .select('id', { count: 'exact', head: true })
          .eq('cliente_id', clienteId)
      : Promise.resolve({ count: 0, error: null } as any),
    clienteId
      ? supabase
          .from('facturas')
          .select('id, fecha_emision, total')
          .eq('cliente_id', clienteId)
          .order('fecha_emision', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    supabase
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('activo', true)
      .gte('created_at', newSinceISO),
  ])

  const isClienteB2B = profile?.rol === 'cliente'
  const tieneCredito = isClienteB2B && Boolean(clienteData?.credito_autorizado)
  const creditoDisponible = tieneCredito
    ? Math.max(
        0,
        Number(clienteData?.limite_credito ?? 0) - Number(clienteData?.credito_usado ?? 0),
      )
    : null

  const ultimaFactura = ultimaFacturaRes.data as
    | { id: string; fecha_emision: string; total: number }
    | null

  const clientStats = {
    pedidosPendientes: pedidosPendientesRes.count ?? 0,
    pedidosTotales:    pedidosTotalesRes.count ?? 0,
    ultimaCompra: ultimaFactura
      ? { fecha: ultimaFactura.fecha_emision, total: Number(ultimaFactura.total) }
      : null,
    productosNuevos:   productosNuevosRes.count ?? 0,
    creditoDisponible,
    esB2B: isClienteB2B,
  } as const

  return (
    <TiendaClient
      profile={profile as any}
      productos={productos as any[]}
      clienteInfo={clienteData as any}
      empresaPayment={empresaPayment as any}
      stripeEnabled={isStripeConfigured()}
      clientStats={clientStats}
    />
  )
}
