import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Cliente } from '@/lib/types'
import { formatCurrency, formatDate, ESTADO_PEDIDO_LABELS, ESTADO_PEDIDO_COLORS } from '@/lib/utils'
import {
  Users,
  ChevronRight,
  Pencil,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Clock,
  StickyNote,
  Building2,
  Map,
  ShoppingCart,
  CalendarDays,
  TrendingUp,
  Package,
  ArrowRight,
  AlertTriangle,
  Tag,
  History,
  Plus,
  ReceiptText,
} from 'lucide-react'
import ClienteTabBar from '@/components/clientes/ClienteTabBar'

/**
 * Defensive helper: runs a Supabase query-builder promise with a guaranteed
 * array fallback. Any error (missing table, RLS rejection, network hiccup)
 * is swallowed to a warn log so the overall page render never aborts.
 *
 * The page renders with whatever data IS available — that's a better UX than
 * a full server error boundary for a tab detail view.
 */
// Supabase query builders are PromiseLike (thenables), not real Promises.
// Accept the broadest input type so we can pass `.from(...).select(...)`
// directly without a wrapping `.then()`.
async function safeArray<T = unknown>(
  promise: PromiseLike<{ data: T[] | null; error: unknown }>,
  context: string
): Promise<T[]> {
  try {
    const { data, error } = await promise
    if (error) {
      const e = error as { message?: string; code?: string }
      console.warn(`[clientes/[id]] ${context}: ${e?.message ?? e?.code ?? 'unknown'}`)
      return []
    }
    return data ?? []
  } catch (err) {
    const e = err as { message?: string }
    console.warn(`[clientes/[id]] ${context} threw:`, e?.message ?? err)
    return []
  }
}

interface PageProps {
  params: { id: string }
  searchParams?: { tab?: string }
}

type TabId = 'info' | 'pedidos' | 'cuenta' | 'precios' | 'notas'
const VALID_TABS: TabId[] = ['info', 'pedidos', 'cuenta', 'precios', 'notas']

export const dynamic = 'force-dynamic'

export default async function ClienteDetailPage({ params, searchParams }: PageProps) {
  const supabase = createClient()

  // ── Main fetch ──────────────────────────────────────────────────────────────
  // Try `clientes.id` first (the canonical case). If that returns nothing,
  // fall back to `clientes.user_id` so old links / app-user routes that may
  // have surfaced the auth user's UUID still resolve to the right cliente.
  // 404 only when neither lookup matches.
  let cliente: any = null
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()
    if (error) {
      console.warn(`[clientes/[id]] main fetch: ${error.message}`)
    }
    cliente = data
  } catch (err: any) {
    console.warn(`[clientes/[id]] main fetch threw:`, err?.message ?? err)
  }

  if (!cliente) {
    // Fallback: maybe the URL has a user_id (auth UUID) instead of clientes.id.
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', params.id)
        .maybeSingle()
      if (error) {
        console.warn(`[clientes/[id]] user_id fallback: ${error.message}`)
      }
      cliente = data
    } catch (err: any) {
      console.warn(`[clientes/[id]] user_id fallback threw:`, err?.message ?? err)
    }
  }

  if (!cliente) notFound()

  // From here on use the canonical cliente.id, NEVER params.id, so all
  // child queries and links resolve correctly regardless of which UUID
  // the URL originally carried.
  const clienteId: string = cliente.id

  const requestedTab = (searchParams?.tab as TabId) ?? 'info'
  const activeTab: TabId = VALID_TABS.includes(requestedTab) ? requestedTab : 'info'

  // ── Data fetching (all tabs — counts drive the badges) ─────────────────────
  // Each query is wrapped in safeArray so a missing table / RLS error /
  // network blip can't take the whole page down. Worst case a tab shows
  // "no data".
  const sixMonthsAgo = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 6)
    return d.toISOString().split('T')[0]
  })()

  const [pedidosAll, facturasUnpaid, facturasAllCliente, historialRaw] = await Promise.all([
    safeArray(
      supabase.from('pedidos')
        .select('id, numero, estado, fecha_pedido, subtotal, descuento, impuesto, total, notas, direccion_entrega')
        .eq('cliente_id', clienteId)
        .order('fecha_pedido', { ascending: false })
        .limit(100),
      'pedidos',
    ),
    safeArray(
      supabase.from('facturas')
        .select('id, numero, total, monto_pagado, fecha_emision, fecha_vencimiento, estado')
        .eq('cliente_id', clienteId)
        .in('estado', ['emitida', 'enviada'])
        .order('fecha_emision', { ascending: false }),
      'facturas:unpaid',
    ),
    safeArray(
      supabase.from('facturas')
        .select('id, numero, total, monto_pagado, fecha_emision, estado')
        .eq('cliente_id', clienteId)
        .order('fecha_emision', { ascending: false })
        .limit(50),
      'facturas:all',
    ),
    safeArray(
      supabase.from('historial_precios_cliente')
        .select(`
          id, fecha, precio_vendido, cantidad, producto_id, presentacion_id, factura_id,
          producto:productos(id, nombre, categoria),
          presentacion:presentaciones(id, nombre, precio)
        `)
        .eq('cliente_id', clienteId)
        .gte('fecha', sixMonthsAgo)
        .order('fecha', { ascending: false })
        .limit(500),
      'historial_precios_cliente',
    ),
  ])

  const pedidos = pedidosAll
  const totalPedidos = pedidos.length
  const totalFacturado = pedidos.reduce((sum, p: any) => sum + Number(p.total ?? 0), 0)
  const pedidosActivos = pedidos.filter((p: any) =>
    ['confirmado', 'en_ruta'].includes(p.estado)
  ).length

  const deudaTotal = Number(
    (cliente as any).deuda_total ??
      facturasUnpaid.reduce(
        (s: number, f: any) => s + (Number(f.total ?? 0) - Number(f.monto_pagado ?? 0)),
        0
      )
  ) || 0

  // Historial aggregation per producto/presentacion.
  type HistRow = {
    key: string
    producto_nombre: string
    presentacion_nombre: string
    precio_oficial_actual: number
    ultima_venta_precio: number
    ultima_venta_fecha: string
    veces_vendido: number
    promedio_precio: number
    total_unidades: number
  }
  const histMap: Record<string, HistRow & { _sumPrecio: number; _count: number }> = {}
  for (const h of historialRaw as any[]) {
    const key = h?.presentacion_id ?? h?.producto_id
    if (!key) continue
    if (!histMap[key]) {
      histMap[key] = {
        key,
        producto_nombre: h?.producto?.nombre ?? '—',
        presentacion_nombre: h?.presentacion?.nombre ?? '—',
        precio_oficial_actual: Number(h?.presentacion?.precio ?? 0),
        ultima_venta_precio: Number(h?.precio_vendido ?? 0),
        ultima_venta_fecha: h?.fecha ?? '',
        veces_vendido: 0,
        promedio_precio: 0,
        total_unidades: 0,
        _sumPrecio: 0,
        _count: 0,
      }
    }
    const row = histMap[key]
    row.veces_vendido += 1
    row.total_unidades += Number(h?.cantidad ?? 0)
    row._sumPrecio += Number(h?.precio_vendido ?? 0)
    row._count += 1
  }
  const historial: HistRow[] = Object.values(histMap).map((r) => ({
    ...r,
    promedio_precio: r._count > 0 ? r._sumPrecio / r._count : 0,
  }))
  historial.sort((a, b) => (b.ultima_venta_fecha ?? '').localeCompare(a.ultima_venta_fecha ?? ''))

  const c = cliente as Cliente & { deuda_total?: number }
  const descuentoPct = Number((c as any).descuento_porcentaje ?? 0) || 0

  // Aging buckets for estado de cuenta.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const aging = {
    corriente: 0,
    '1_30': 0,
    '31_60': 0,
    '61_90': 0,
    mas_90: 0,
  }
  for (const f of facturasUnpaid as any[]) {
    const saldo = Number(f?.total ?? 0) - Number(f?.monto_pagado ?? 0)
    if (saldo <= 0) continue
    const dueRaw = f?.fecha_vencimiento ?? f?.fecha_emision
    if (!dueRaw) {
      aging.corriente += saldo
      continue
    }
    const dueDate = new Date(dueRaw)
    if (Number.isNaN(dueDate.getTime())) {
      aging.corriente += saldo
      continue
    }
    const diff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 0) aging.corriente += saldo
    else if (diff <= 30) aging['1_30'] += saldo
    else if (diff <= 60) aging['31_60'] += saldo
    else if (diff <= 90) aging['61_90'] += saldo
    else aging.mas_90 += saldo
  }

  // Tab defs for the tab bar — pass icon NAMES (strings), not component
  // references. The ClienteTabBar is a client component and component
  // refs are not serializable across the RSC boundary (= React #419).
  const tabs = [
    { id: 'info',     label: 'Información',           iconName: 'user' as const },
    { id: 'pedidos',  label: 'Historial de pedidos',  iconName: 'shoppingCart' as const, count: totalPedidos },
    { id: 'cuenta',   label: 'Estado de cuenta',      iconName: 'creditCard' as const,   count: facturasUnpaid.length, tone: facturasUnpaid.length > 0 ? 'danger' as const : undefined },
    { id: 'precios',  label: 'Historial de precios',  iconName: 'history' as const,      count: historial.length, tone: historial.length > 0 ? 'violet' as const : undefined },
    { id: 'notas',    label: 'Notas',                 iconName: 'stickyNote' as const,   tone: undefined },
  ]

  return (
    <div className="min-h-full bg-slate-50">
      {/* ── Header: breadcrumb + identity + PERSISTENT actions ── */}
      <div className="border-b border-slate-200 bg-white px-4 sm:px-6 py-5">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href="/clientes" className="flex items-center gap-1.5 hover:text-teal-600 transition-colors">
            <Users className="h-3.5 w-3.5" />
            Clientes
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900 font-medium truncate max-w-xs">{c.nombre ?? '—'}</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white text-lg font-bold shrink-0">
              {(c.nombre ?? '?').charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-slate-900 truncate">{c.nombre ?? 'Cliente sin nombre'}</h1>
                {c.activo ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Inactivo
                  </span>
                )}
                {descuentoPct > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 ring-1 ring-inset ring-violet-600/20">
                    <Tag className="h-3 w-3" />
                    {descuentoPct.toFixed(descuentoPct % 1 === 0 ? 0 : 1)}% descuento global
                  </span>
                )}
                {deudaTotal > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/30">
                    <AlertTriangle className="h-3 w-3" />
                    Deuda: {formatCurrency(deudaTotal)}
                  </span>
                )}
              </div>
              {c.rif && (
                <p className="mt-0.5 text-sm text-slate-500">RIF: {c.rif}</p>
              )}
              <p className="text-xs text-slate-400 mt-0.5">
                Registrado el {formatDate(c.created_at)}
              </p>
            </div>
          </div>

          {/* Persistent CTAs — visible on every tab */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/pedidos/nuevo?cliente=${c.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Nuevo pedido
            </Link>
            <Link
              href={`/clientes/${c.id}/editar`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="border-b border-slate-100 bg-white px-4 sm:px-6 py-4">
        <div className="grid grid-cols-3 gap-3 max-w-3xl">
          <StatTile icon={<ShoppingCart className="h-4 w-4 text-teal-600" />} bg="bg-teal-50" label="Total pedidos" value={String(totalPedidos)} />
          <StatTile icon={<TrendingUp className="h-4 w-4 text-green-600" />} bg="bg-green-50" label="Total facturado" value={formatCurrency(totalFacturado)} />
          <StatTile icon={<Package className="h-4 w-4 text-amber-600" />} bg="bg-amber-50" label="Pedidos activos" value={String(pedidosActivos)} />
        </div>
      </div>

      {/* ── Tabs ── */}
      {/* Suspense is required for client components that call useSearchParams */}
      <Suspense fallback={<div className="border-b border-slate-200 bg-white h-12" />}>
        <ClienteTabBar tabs={tabs} activeTab={activeTab} />
      </Suspense>

      {/* ── Tab content ── */}
      <div className="p-4 sm:p-6 space-y-5 max-w-6xl">
        {activeTab === 'info' && (
          <InfoTab c={c} descuentoPct={descuentoPct} />
        )}

        {activeTab === 'pedidos' && (
          <PedidosTab pedidos={pedidos} totalFacturado={totalFacturado} clienteId={c.id} />
        )}

        {activeTab === 'cuenta' && (
          <CuentaTab
            deudaTotal={deudaTotal}
            facturasUnpaid={facturasUnpaid as any[]}
            facturasAll={facturasAllCliente as any[]}
            aging={aging}
          />
        )}

        {activeTab === 'precios' && (
          <PreciosTab historial={historial} />
        )}

        {activeTab === 'notas' && (
          <NotasTab notas={c.notas} clienteId={c.id} />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Información
// ─────────────────────────────────────────────────────────────────────────────

function InfoTab({
  c,
  descuentoPct,
}: {
  c: Cliente & { deuda_total?: number }
  descuentoPct: number
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Contacto */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Contacto</h2>
        </div>
        <div className="divide-y divide-slate-50 px-5">
          <InfoRow icon={<Phone className="h-4 w-4 text-slate-400" />} label="Teléfono" value={c.telefono} />
          <InfoRow icon={<Mail className="h-4 w-4 text-slate-400" />} label="Correo" value={c.email} />
          {c.whatsapp && (
            <InfoRow icon={<Phone className="h-4 w-4 text-green-500" />} label="WhatsApp" value={c.whatsapp} />
          )}
        </div>
      </div>

      {/* Ubicacion */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Ubicación</h2>
        </div>
        <div className="divide-y divide-slate-50 px-5">
          <InfoRow icon={<MapPin className="h-4 w-4 text-slate-400" />} label="Dirección" value={c.direccion} />
          <InfoRow icon={<Building2 className="h-4 w-4 text-slate-400" />} label="Ciudad" value={c.ciudad} />
          <InfoRow icon={<Map className="h-4 w-4 text-slate-400" />} label="Zona" value={c.zona} />
        </div>
      </div>

      {/* Credito */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Condiciones de crédito</h2>
        </div>
        <div className="divide-y divide-slate-50 px-5">
          <InfoRow
            icon={<CreditCard className="h-4 w-4 text-slate-400" />}
            label="Límite de crédito"
            value={formatCurrency(c.limite_credito ?? 0)}
          />
          <InfoRow
            icon={<Clock className="h-4 w-4 text-slate-400" />}
            label="Días de crédito"
            value={c.dias_credito != null ? `${c.dias_credito} días` : null}
          />
        </div>
      </div>

      {/* Descuento global (pricing inteligente) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Tag className="h-4 w-4 text-violet-600" />
            Descuento global
          </h2>
        </div>
        <div className="px-5 py-4">
          {descuentoPct > 0 ? (
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-violet-700">
                {descuentoPct.toFixed(descuentoPct % 1 === 0 ? 0 : 1)}%
              </span>
              <span className="text-sm text-slate-500">se aplica automáticamente al crear pedidos</span>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Sin descuento — paga precios oficiales.{' '}
              <Link href={`/clientes/${c.id}/editar`} className="text-teal-600 hover:underline">
                Configurar →
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Historial de pedidos
// ─────────────────────────────────────────────────────────────────────────────

function PedidosTab({
  pedidos,
  totalFacturado,
  clienteId,
}: {
  pedidos: any[]
  totalFacturado: number
  clienteId: string
}) {
  if (pedidos.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm py-12 text-center">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100">
          <ShoppingCart className="h-6 w-6 text-slate-400" />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-900">Sin pedidos</p>
        <p className="mt-1 text-xs text-slate-500">Este cliente aún no tiene pedidos registrados.</p>
        <Link
          href={`/pedidos/nuevo?cliente=${clienteId}`}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
        >
          Crear primer pedido
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShoppingCart className="h-4 w-4 text-teal-600" />
          Historial completo de pedidos
        </h2>
        <span className="text-xs text-slate-500">
          {pedidos.length} pedido{pedidos.length === 1 ? '' : 's'} · Total: {formatCurrency(totalFacturado)}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {pedidos.map((pedido: any) => (
          <Link
            key={pedido.id}
            href={`/pedidos/${pedido.id}`}
            className="flex items-start justify-between p-4 hover:bg-slate-50 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-slate-900">
                  #{pedido.numero}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    ESTADO_PEDIDO_COLORS[pedido.estado] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {ESTADO_PEDIDO_LABELS[pedido.estado] ?? pedido.estado}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(pedido.fecha_pedido)}
                </span>
                {pedido.notas && (
                  <span className="truncate max-w-xs hidden sm:block">{pedido.notas}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 ml-3 shrink-0">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">
                  {formatCurrency(pedido.total ?? 0)}
                </p>
                {pedido.descuento > 0 && (
                  <p className="text-xs text-slate-400">
                    Desc: {formatCurrency(pedido.descuento)}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Estado de cuenta
// ─────────────────────────────────────────────────────────────────────────────

function CuentaTab({
  deudaTotal,
  facturasUnpaid,
  facturasAll,
  aging,
}: {
  deudaTotal: number
  facturasUnpaid: any[]
  facturasAll: any[]
  aging: { corriente: number; '1_30': number; '31_60': number; '61_90': number; mas_90: number }
}) {
  return (
    <div className="space-y-5">
      {/* Summary + aging */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Deuda total</p>
          <p className={`mt-1 text-3xl font-bold ${deudaTotal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatCurrency(deudaTotal)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {facturasUnpaid.length} factura{facturasUnpaid.length === 1 ? '' : 's'} con saldo pendiente
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">Aging de deuda</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            <AgingCell label="Corriente" value={aging.corriente} tone="emerald" />
            <AgingCell label="1–30 d" value={aging['1_30']} tone="amber" />
            <AgingCell label="31–60 d" value={aging['31_60']} tone="orange" />
            <AgingCell label="61–90 d" value={aging['61_90']} tone="red" />
            <AgingCell label=">90 d" value={aging.mas_90} tone="red" />
          </div>
        </div>
      </div>

      {/* Unpaid facturas */}
      {facturasUnpaid.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Facturas pendientes
              <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {facturasUnpaid.length}
              </span>
            </h2>
            <span className="text-sm font-bold text-red-700">{formatCurrency(deudaTotal)}</span>
          </div>
          <div className="divide-y divide-red-50">
            {facturasUnpaid.map((f: any) => {
              const saldo = Number(f.total ?? 0) - Number(f.monto_pagado ?? 0)
              const vencida = f.fecha_vencimiento && new Date(f.fecha_vencimiento) < new Date()
              return (
                <Link
                  key={f.id}
                  href={`/facturas/${f.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-red-50/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-900">{f.numero}</span>
                      {vencida && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Vencida
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Emitida: {formatDate(f.fecha_emision)}
                      {f.fecha_vencimiento && ` · Vence: ${formatDate(f.fecha_vencimiento)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-red-700">{formatCurrency(saldo)}</p>
                    <p className="text-xs text-slate-400">saldo</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          ✓ Este cliente no tiene facturas con saldo pendiente.
        </div>
      )}

      {/* All facturas (history) */}
      {facturasAll.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ReceiptText className="h-4 w-4 text-slate-500" />
              Historial de facturación
            </h2>
            <span className="text-xs text-slate-400">Últimas {facturasAll.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Factura</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Pagado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facturasAll.map((f: any) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5">
                      <Link href={`/facturas/${f.id}`} className="font-mono text-sm font-semibold text-teal-600 hover:underline">
                        {f.numero}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{formatDate(f.fecha_emision)}</td>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize">
                        {f.estado}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(f.total ?? 0)}</td>
                    <td className="px-5 py-2.5 text-right text-emerald-700 font-medium">{formatCurrency(f.monto_pagado ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function AgingCell({
  label, value, tone
}: {
  label: string; value: number
  tone: 'emerald' | 'amber' | 'orange' | 'red'
}) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'amber' ? 'text-amber-600' :
    tone === 'orange' ? 'text-orange-600' :
    'text-red-600'
  return (
    <div className="rounded-lg border border-slate-100 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xs font-bold ${value > 0 ? toneCls : 'text-slate-300'}`}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Historial de precios
// ─────────────────────────────────────────────────────────────────────────────

function PreciosTab({ historial }: { historial: any[] }) {
  if (historial.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm py-12 text-center">
        <History className="h-8 w-8 text-slate-300 mx-auto" />
        <p className="mt-3 text-sm font-medium text-slate-900">Sin historial de precios</p>
        <p className="mt-1 text-xs text-slate-500">
          Al facturar productos a este cliente se registrará el precio vendido aquí.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="h-4 w-4 text-violet-600" />
          Historial de precios
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            Últimos 6 meses
          </span>
        </h2>
        <span className="text-xs text-slate-400">
          {historial.length} producto{historial.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Producto</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Precio oficial</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Última venta</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Veces</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Promedio</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Desc. aplicado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {historial.map((row: any) => {
              const desc = row.precio_oficial_actual > 0
                ? ((row.precio_oficial_actual - row.ultima_venta_precio) / row.precio_oficial_actual) * 100
                : 0
              return (
                <tr key={row.key} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 truncate">{row.producto_nombre}</p>
                    <p className="text-xs text-slate-500 truncate">{row.presentacion_nombre}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.precio_oficial_actual > 0 ? formatCurrency(row.precio_oficial_actual) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-amber-700">{formatCurrency(row.ultima_venta_precio)}</p>
                    <p className="text-xs text-slate-400">{formatDate(row.ultima_venta_fecha)}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{row.veces_vendido}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(row.promedio_precio)}</td>
                  <td className="px-4 py-3 text-right">
                    {desc > 0.5 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                        <Tag className="h-3 w-3" />
                        -{desc.toFixed(1)}%
                      </span>
                    ) : desc < -0.5 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        +{Math.abs(desc).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Notas
// ─────────────────────────────────────────────────────────────────────────────

function NotasTab({ notas, clienteId }: { notas?: string; clienteId: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <StickyNote className="h-4 w-4 text-amber-500" />
          Notas internas
        </h2>
        <Link
          href={`/clientes/${clienteId}/editar`}
          className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
        >
          <Pencil className="h-3 w-3" />
          Editar
        </Link>
      </div>
      <div className="px-5 py-4">
        {notas ? (
          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{notas}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">
            Sin notas. Usa "Editar" para agregar observaciones sobre este cliente (preferencias de entrega, historial de pagos, contacto preferido, etc.).
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value?: string | null
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm text-slate-900 break-words">
          {value || <span className="text-slate-400">—</span>}
        </p>
      </div>
    </div>
  )
}

function StatTile({
  icon, bg, label, value,
}: {
  icon: React.ReactNode; bg: string; label: string; value: string
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 font-medium truncate">{label}</p>
          <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
        </div>
      </div>
    </div>
  )
}
