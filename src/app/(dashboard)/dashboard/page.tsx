import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import {
  ShoppingCart,
  Users,
  ReceiptText,
  TrendingUp,
  Package,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Star,
} from 'lucide-react'
import Link from 'next/link'
import VentasChart from '@/components/dashboard/VentasChart'
import AnimatedPage from '@/components/ui/AnimatedPage'
import CountUp from '@/components/ui/CountUp'

export const dynamic = 'force-dynamic'

// ── Date helpers ─────────────────────────────────────────────────────────────

function startOf(unit: 'day' | 'week' | 'month'): Date {
  const d = new Date()
  if (unit === 'day') {
    d.setHours(0, 0, 0, 0)
  } else if (unit === 'week') {
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  }
  return d
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// ─────────────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()

  const startDay   = startOf('day').toISOString()
  const startWeek  = startOf('week').toISOString()
  const startMonth = startOf('month').toISOString()

  // 7 days ago for chart
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [
    { count: totalPedidos },
    { count: totalClientes },
    { count: totalProductos },
    { count: clientesNuevosMes },
    { data: pedidosPendientes },
    { data: stockBajo },
    { data: facturasParaMetricas },
    { data: facturasRecientes },
    { data: topProductosRaw },
  ] = await Promise.all([
    supabase.from('pedidos').select('*', { count: 'exact', head: true }),
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('productos').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('clientes').select('*', { count: 'exact', head: true }).gte('created_at', startMonth),
    supabase.from('pedidos')
      .select('id, numero, total, estado, fecha_pedido, clientes(nombre)')
      .in('estado', ['confirmado', 'en_ruta'])
      .order('fecha_pedido', { ascending: false })
      .limit(5),
    supabase.from('presentaciones')
      .select('id, nombre, stock, stock_minimo, productos(nombre)')
      .lt('stock', 5)
      .eq('activo', true)
      .limit(6),
    // All invoices from last 7 days for chart + day/week/month totals
    supabase.from('facturas')
      .select('total, fecha_emision')
      .gte('fecha_emision', sevenDaysAgo.toISOString())
      .neq('estado', 'anulada'),
    supabase.from('facturas')
      .select('id, numero, total, estado, fecha_emision, clientes(nombre)')
      .order('fecha_emision', { ascending: false })
      .limit(5),
    // Top 5 products by quantity sold
    supabase.from('factura_items')
      .select('descripcion, cantidad, subtotal')
      .order('cantidad', { ascending: false })
      .limit(100),
  ])

  // ── Calculate period totals ───────────────────────────────────────────────

  const allFacturas = facturasParaMetricas || []
  const ventasHoy    = allFacturas.filter(f => f.fecha_emision >= startDay).reduce((a, f) => a + f.total, 0)
  const ventasSemana = allFacturas.filter(f => f.fecha_emision >= startWeek).reduce((a, f) => a + f.total, 0)
  const ventasMes    = allFacturas.filter(f => f.fecha_emision >= startMonth).reduce((a, f) => a + f.total, 0)

  // ── Build 7-day chart data ────────────────────────────────────────────────

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const nextD = new Date(d)
    nextD.setDate(d.getDate() + 1)

    const total = allFacturas
      .filter(f => f.fecha_emision >= d.toISOString() && f.fecha_emision < nextD.toISOString())
      .reduce((acc, f) => acc + f.total, 0)

    return {
      dia: DAY_NAMES[d.getDay()],
      total,
      isToday: i === 6,
    }
  })

  // ── Top 5 products ────────────────────────────────────────────────────────

  const productoMap: Record<string, { nombre: string; cantidad: number; subtotal: number }> = {}
  for (const item of topProductosRaw || []) {
    const key = item.descripcion
    if (!productoMap[key]) {
      productoMap[key] = { nombre: item.descripcion, cantidad: 0, subtotal: 0 }
    }
    productoMap[key].cantidad += item.cantidad
    productoMap[key].subtotal += item.subtotal
  }
  const topProductos = Object.values(productoMap)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5)
  const maxCantidad = topProductos[0]?.cantidad || 1

  // ── Estado colors ─────────────────────────────────────────────────────────

  const estadoColors: Record<string, string> = {
    confirmado: 'bg-teal-100 text-teal-700',
    en_ruta:    'bg-yellow-100 text-yellow-700',
    entregado:  'bg-green-100 text-green-700',
    facturado:  'bg-purple-100 text-purple-700',
    emitida:    'bg-teal-100 text-teal-700',
    pagada:     'bg-green-100 text-green-700',
    anulada:    'bg-red-100 text-red-700',
  }

  return (
    <AnimatedPage className="p-4 lg:p-8 space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between pt-2 lg:pt-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/pedidos/nuevo"
          className="hidden sm:inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm shadow-teal-500/20 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          Nuevo Pedido
        </Link>
      </div>

      {/* ── Sales period cards (día / semana / mes) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Ventas Hoy', value: ventasHoy, icon: Calendar, color: 'text-teal-600', bg: 'bg-teal-50' },
          { label: 'Esta Semana', value: ventasSemana, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Este Mes', value: ventasMes, icon: ReceiptText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{s.label}</p>
                <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                <CountUp value={s.value} prefix="$" decimals={2} />
              </p>
            </div>
          )
        })}
      </div>

      {/* ── Quick counters ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pedidos', value: totalPedidos || 0, icon: ShoppingCart, bg: 'bg-teal-50', text: 'text-teal-600', href: '/pedidos' },
          { label: 'Clientes', value: totalClientes || 0, icon: Users, bg: 'bg-emerald-50', text: 'text-emerald-600', href: '/clientes' },
          { label: 'Productos', value: totalProductos || 0, icon: Package, bg: 'bg-violet-50', text: 'text-violet-600', href: '/productos' },
          { label: 'Clientes Nuevos (mes)', value: clientesNuevosMes || 0, icon: Star, bg: 'bg-amber-50', text: 'text-amber-600', href: '/clientes' },
        ].map(s => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href}>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${s.text}`} />
                </div>
                <p className="text-xl font-bold text-slate-800 dark:text-white"><CountUp value={s.value} /></p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── Charts + Top products row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Ventas 7 días — bar chart */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-slate-800 dark:text-white">Ventas — Últimos 7 días</h2>
            <span className="text-xs text-slate-400">Facturas emitidas</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Total período: <span className="font-semibold text-slate-700">{formatCurrency(ventasSemana)}</span>
          </p>
          <VentasChart data={chartData} />
        </div>

        {/* Top 5 productos */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-slate-800 dark:text-white">Top 5 Productos</h2>
          </div>
          {topProductos.length > 0 ? (
            <div className="space-y-3">
              {topProductos.map((p, i) => (
                <div key={p.nombre}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-slate-100 text-slate-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-50 text-slate-400'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="text-xs text-slate-700 truncate font-medium">{p.nombre}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 flex-shrink-0 ml-2">
                      {p.cantidad} uds
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-teal-500 transition-all"
                      style={{ width: `${(p.cantidad / maxCantidad) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Sin datos de ventas aún
            </div>
          )}
        </div>
      </div>

      {/* ── Pedidos activos + Stock bajo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Pedidos pendientes */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Pedidos Activos</h2>
            </div>
            <Link href="/pedidos" className="text-teal-600 text-xs hover:underline font-medium">Ver todos →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {pedidosPendientes && pedidosPendientes.length > 0 ? (
              pedidosPendientes.map((pedido: any) => (
                <Link key={pedido.id} href={`/pedidos/${pedido.id}`}>
                  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition active:bg-slate-100">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{pedido.numero}</p>
                      <p className="text-xs text-slate-500 truncate">{pedido.clientes?.nombre}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${estadoColors[pedido.estado] || 'bg-gray-100 text-gray-700'}`}>
                        {pedido.estado.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">{formatCurrency(pedido.total)}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                No hay pedidos activos
              </div>
            )}
          </div>
        </div>

        {/* Stock bajo */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Alertas de Stock</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {stockBajo && stockBajo.length > 0 ? (
              stockBajo.map((item: any) => (
                <div key={item.id} className="px-5 py-3">
                  <p className="font-medium text-slate-800 text-sm truncate">{item.productos?.nombre}</p>
                  <p className="text-xs text-slate-500">{item.nombre}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      item.stock === 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.stock === 0 ? '⚠ Sin stock' : `${item.stock} uds`}
                    </span>
                    <span className="text-xs text-slate-400">mín: {item.stock_minimo}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                Stock en niveles normales
              </div>
            )}
            {stockBajo && stockBajo.length > 0 && (
              <div className="px-5 py-3">
                <Link href="/productos" className="text-xs text-teal-600 hover:underline font-medium">
                  Ver todos los productos →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Facturas recientes ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Facturas Recientes</h2>
          </div>
          <Link href="/facturas" className="text-teal-600 text-xs hover:underline font-medium">Ver todas →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <th className="text-left px-5 py-3">Número</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Cliente</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Fecha</th>
                <th className="text-left px-5 py-3">Estado</th>
                <th className="text-right px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {facturasRecientes && facturasRecientes.length > 0 ? (
                facturasRecientes.map((factura: any) => (
                  <tr key={factura.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <Link href={`/facturas/${factura.id}`} className="font-semibold text-teal-600 hover:underline text-sm">
                        {factura.numero}
                      </Link>
                      <p className="text-xs text-slate-400 sm:hidden">{factura.clientes?.nombre}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 hidden sm:table-cell">
                      {factura.clientes?.nombre}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500 hidden md:table-cell">
                      {new Date(factura.fecha_emision).toLocaleDateString('es-VE')}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${estadoColors[factura.estado] || 'bg-gray-100 text-gray-700'}`}>
                        {factura.estado}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-700 text-sm">
                      {formatCurrency(factura.total)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">
                    No hay facturas recientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </AnimatedPage>
  )
}
