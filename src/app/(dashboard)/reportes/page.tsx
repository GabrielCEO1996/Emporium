import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { BarChart2, TrendingUp, Users, Package } from 'lucide-react'
import AnimatedPage from '@/components/ui/AnimatedPage'
import VentasMensualesChart from '@/components/dashboard/VentasMensualesChart'
import TopProductosChart from '@/components/dashboard/TopProductosChart'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default async function ReportesPage() {
  const supabase = createClient()

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString()

  const [
    { data: facturasAnio },
    { data: facturaItems },
    { data: topClientesRaw },
  ] = await Promise.all([
    supabase.from('facturas')
      .select('total, fecha_emision')
      .gte('fecha_emision', yearStart)
      .neq('estado', 'anulada'),
    supabase.from('factura_items')
      .select('descripcion, cantidad, subtotal'),
    supabase.from('facturas')
      .select('total, clientes(id, nombre)')
      .neq('estado', 'anulada'),
  ])

  // ── Monthly sales for chart ───────────────────────────────────────────────
  const monthlyMap: Record<number, number> = {}
  for (const f of facturasAnio ?? []) {
    const m = new Date(f.fecha_emision).getMonth()
    monthlyMap[m] = (monthlyMap[m] ?? 0) + f.total
  }
  const ventasMensuales = Array.from({ length: 12 }, (_, i) => ({
    mes: MONTH_NAMES[i],
    total: monthlyMap[i] ?? 0,
  }))

  // ── Top products ──────────────────────────────────────────────────────────
  const productoMap: Record<string, { nombre: string; cantidad: number; revenue: number }> = {}
  for (const item of facturaItems ?? []) {
    if (!productoMap[item.descripcion]) {
      productoMap[item.descripcion] = { nombre: item.descripcion, cantidad: 0, revenue: 0 }
    }
    productoMap[item.descripcion].cantidad += item.cantidad
    productoMap[item.descripcion].revenue += item.subtotal
  }
  const topProductos = Object.values(productoMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)

  // ── Top clients ───────────────────────────────────────────────────────────
  const clienteMap: Record<string, { nombre: string; total: number; facturas: number }> = {}
  for (const f of topClientesRaw ?? []) {
    const cliente = (f.clientes as any)
    if (!cliente) continue
    const key = cliente.id
    if (!clienteMap[key]) clienteMap[key] = { nombre: cliente.nombre, total: 0, facturas: 0 }
    clienteMap[key].total += f.total
    clienteMap[key].facturas += 1
  }
  const topClientes = Object.values(clienteMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const totalAnio = ventasMensuales.reduce((a, m) => a + m.total, 0)
  const mesActual = ventasMensuales[now.getMonth()].total
  const mesAnterior = ventasMensuales[Math.max(0, now.getMonth() - 1)].total
  const variacion = mesAnterior > 0 ? ((mesActual - mesAnterior) / mesAnterior) * 100 : 0

  return (
    <AnimatedPage className="p-4 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between pt-2 lg:pt-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-teal-600" />
            Reportes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Análisis de ventas — {now.getFullYear()}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: `Total ${now.getFullYear()}`,
            value: formatCurrency(totalAnio),
            icon: TrendingUp,
            color: 'text-teal-600',
            bg: 'bg-teal-50 dark:bg-teal-900/20',
          },
          {
            label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
            value: formatCurrency(mesActual),
            icon: BarChart2,
            color: 'text-violet-600',
            bg: 'bg-violet-50 dark:bg-violet-900/20',
            sub: variacion !== 0 ? `${variacion > 0 ? '+' : ''}${variacion.toFixed(1)}% vs mes anterior` : undefined,
          },
          {
            label: 'Clientes activos',
            value: topClientes.length.toString(),
            icon: Users,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
          },
        ].map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{card.label}</p>
                <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{card.value}</p>
              {card.sub && (
                <p className={`text-xs mt-1 font-medium ${variacion >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {card.sub}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Area chart */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-1">Ventas Mensuales</h2>
          <p className="text-xs text-slate-400 mb-4">Facturas emitidas por mes — {now.getFullYear()}</p>
          <VentasMensualesChart data={ventasMensuales} />
        </div>

        {/* Donut chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-violet-500" />
            <h2 className="font-semibold text-slate-800 dark:text-white">Top Productos</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">Por ingresos generados</p>
          <TopProductosChart data={topProductos} />
        </div>
      </div>

      {/* Top clients table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <Users className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Top Clientes por Facturación</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <th className="text-left px-5 py-3">#</th>
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-right px-5 py-3">Facturas</th>
                <th className="text-right px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {topClientes.length > 0 ? topClientes.map((c, i) => (
                <tr key={c.nombre} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <td className="px-5 py-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-50 text-slate-400 dark:bg-slate-800'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{c.nombre}</td>
                  <td className="px-5 py-3 text-sm text-slate-500 text-right">{c.facturas}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 text-right">
                    {formatCurrency(c.total)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">
                    Sin datos de ventas
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
