import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import CashFlowChart from '@/components/finanzas/CashFlowChart'
import MargenesChart from '@/components/finanzas/MargenesChart'
import {
  TrendingUp, DollarSign, Package, Clock,
  CreditCard, Zap, ShoppingBag, BarChart3,
  Lightbulb, ArrowUpRight, AlertCircle, Star,
  ArrowDownRight, Wallet,
} from 'lucide-react'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function MetricCard({
  title, value, subtitle, icon: Icon, color, trend
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  trend?: { label: string; up: boolean }
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${trend.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            <ArrowUpRight className={`w-3 h-3 ${!trend.up && 'rotate-90'}`} />
            {trend.label}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{title}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 leading-tight">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

export default async function FinanzasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (currentProfile?.rol !== 'admin') redirect('/dashboard')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const startOf6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]

  const [
    { data: presentaciones },
    { data: facturasAll },
    { data: facturasEsteMes },
    { data: pedidosEsteMes },
    { data: itemsRecientes },
    { data: transaccionesMes },
    { data: transacciones6m },
  ] = await Promise.all([
    supabase.from('presentaciones')
      .select('id, nombre, precio, costo, stock, stock_minimo, producto_id, productos(nombre, categoria)')
      .eq('activo', true),
    supabase.from('facturas')
      .select('id, estado, total, monto_pagado, fecha_emision')
      .not('estado', 'eq', 'anulada'),
    supabase.from('facturas')
      .select('id, estado, total, monto_pagado')
      .gte('fecha_emision', startOfMonth)
      .not('estado', 'eq', 'anulada'),
    supabase.from('pedidos')
      .select('id, estado')
      .gte('fecha_pedido', startOfMonth),
    supabase.from('factura_items')
      .select('presentacion_id, cantidad, subtotal')
      .gte('created_at', startOf30Days),
    // Ledger rows for the current month — tipo now splits into
    // 'ingreso' / 'costo' (compras = inventory asset) / 'gasto' (opex)
    supabase.from('transacciones')
      .select('tipo, monto, fecha, categoria_gasto')
      .gte('fecha', startOfMonth),
    supabase.from('transacciones')
      .select('tipo, monto, fecha')
      .gte('fecha', startOf6Months),
  ])

  // ── 1. Capital en inventario ──────────────────────────────────────────────
  const capitalInventario = (presentaciones ?? []).reduce(
    (sum, p) => sum + (p.stock ?? 0) * (p.costo ?? 0), 0
  )

  // ── 2. Cuentas por cobrar ─────────────────────────────────────────────────
  const cuentasPorCobrar = (facturasAll ?? [])
    .filter(f => ['emitida', 'con_nota_credito'].includes(f.estado))
    .reduce((sum, f) => sum + ((f.total ?? 0) - (f.monto_pagado ?? 0)), 0)

  // ── 3. Flujo de caja del mes ──────────────────────────────────────────────
  const flujoCaja = (facturasEsteMes ?? [])
    .filter(f => f.estado === 'pagada')
    .reduce((sum, f) => sum + (f.monto_pagado ?? f.total ?? 0), 0)

  // ── 4. Ticket promedio ────────────────────────────────────────────────────
  const facturasValidas = (facturasEsteMes ?? []).filter(f => f.estado !== 'anulada')
  const ticketPromedio = facturasValidas.length > 0
    ? facturasValidas.reduce((sum, f) => sum + (f.total ?? 0), 0) / facturasValidas.length
    : 0

  // ── 5. Tasa de conversión ─────────────────────────────────────────────────
  const totalPedidos = (pedidosEsteMes ?? []).length
  const pedidosFacturados = (pedidosEsteMes ?? []).filter(p =>
    ['facturado', 'despachada', 'despachado', 'entregada', 'entregado'].includes(p.estado)
  ).length
  const tasaConversion = totalPedidos > 0 ? (pedidosFacturados / totalPedidos) * 100 : 0

  // ── 5b. Transacciones (ledger) — separated into three legs ────────────────
  const ingresosMes = (transaccionesMes ?? [])
    .filter(t => t.tipo === 'ingreso')
    .reduce((s, t) => s + (t.monto ?? 0), 0)
  // 'costo' tipo tracks compra spending (inventory asset), NOT COGS. It's
  // shown as an informational metric — it does not reduce utilidad directly.
  const costoInventarioMes = (transaccionesMes ?? [])
    .filter(t => t.tipo === 'costo')
    .reduce((s, t) => s + (t.monto ?? 0), 0)
  // 'gasto' = operational expenses (rent, payroll, marketing, utilities...)
  const gastosOperativosMes = (transaccionesMes ?? [])
    .filter(t => t.tipo === 'gasto')
    .reduce((s, t) => s + (t.monto ?? 0), 0)

  // ── 5c. COGS (Cost of Goods Sold) for this month ──────────────────────────
  // factura_items has no costo_unitario column, so we join presentaciones
  // and use its current `costo` as a best-effort unit cost. The backing
  // query is keyed on the month's facturas (non-anulada).
  const facturasMesIds = (facturasEsteMes ?? []).map(f => f.id)
  const { data: factItemsMes } = facturasMesIds.length
    ? await supabase
        .from('factura_items')
        .select('factura_id, cantidad, presentacion:presentaciones(costo)')
        .in('factura_id', facturasMesIds)
    : { data: [] as any[] }

  const cogsMes = (factItemsMes ?? []).reduce((s: number, it: any) => {
    const unitCost = Number(it.presentacion?.costo ?? 0)
    return s + Number(it.cantidad ?? 0) * unitCost
  }, 0)

  // Income statement:
  //   Utilidad bruta = Ingresos − COGS
  //   Utilidad neta  = Utilidad bruta − Gastos operativos
  const utilidadBruta = ingresosMes - cogsMes
  const utilidadNeta = utilidadBruta - gastosOperativosMes
  const margenBrutoPct = ingresosMes > 0 ? (utilidadBruta / ingresosMes) * 100 : 0
  const margenNetoPct = ingresosMes > 0 ? (utilidadNeta / ingresosMes) * 100 : 0

  // ── 6. Margen bruto por producto ──────────────────────────────────────────
  // Ventas recientes por presentacion_id
  const ventasPorPres: Record<string, number> = {}
  const cantidadPorPres: Record<string, number> = {}
  for (const item of (itemsRecientes ?? [])) {
    ventasPorPres[item.presentacion_id] = (ventasPorPres[item.presentacion_id] ?? 0) + (item.subtotal ?? 0)
    cantidadPorPres[item.presentacion_id] = (cantidadPorPres[item.presentacion_id] ?? 0) + (item.cantidad ?? 0)
  }

  const margenesRaw = (presentaciones ?? [])
    .filter(p => (p.precio ?? 0) > 0)
    .map(p => {
      const precio = p.precio ?? 0
      const costo = p.costo ?? 0
      const margen = precio > 0 ? ((precio - costo) / precio) * 100 : 0
      const revenue = ventasPorPres[p.id] ?? 0
      return {
        id: p.id,
        nombre: `${(p.productos as any)?.nombre ?? '?'} · ${p.nombre}`,
        margen,
        revenue,
        stock: p.stock ?? 0,
        stockMinimo: p.stock_minimo ?? 0,
        vendido30: cantidadPorPres[p.id] ?? 0,
        precio,
        costo,
        categoria: (p.productos as any)?.categoria ?? '',
      }
    })

  const margenesChart = margenesRaw
    .filter(p => p.revenue > 0 || p.stock > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12)
    .map(p => ({ nombre: p.nombre, margen: p.margen, revenue: p.revenue }))

  // ── 7. Margen bruto promedio ──────────────────────────────────────────────
  const margenBrutoPromedio = margenesRaw.length > 0
    ? margenesRaw.reduce((s, m) => s + m.margen, 0) / margenesRaw.length
    : 0

  // ── 8. Rotación e inventario ──────────────────────────────────────────────
  const totalUnidadesVendidas30 = (itemsRecientes ?? []).reduce((s, i) => s + (i.cantidad ?? 0), 0)
  const totalStockActual = (presentaciones ?? []).reduce((s, p) => s + (p.stock ?? 0), 0)
  const rotacionInventario = totalStockActual > 0 ? (totalUnidadesVendidas30 / 30) * 30 / totalStockActual : 0
  const ventasDiarias = totalUnidadesVendidas30 / 30
  const diasInventario = ventasDiarias > 0 ? totalStockActual / ventasDiarias : 999

  // ── 9. Cash flow últimos 6 meses — ingresos + gastos + utilidad ──────────
  // Sourced from transacciones (ledger) when available, fallback to facturas.pagada for ingresos.
  const cashFlowData: { mes: string; ingresos: number; gastos: number; utilidad: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const toDate = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-01`

    let ingresos = (transacciones6m ?? [])
      .filter(t => t.tipo === 'ingreso' && t.fecha >= from && t.fecha < to)
      .reduce((s, t) => s + (t.monto ?? 0), 0)
    // Cash-flow egresos = inventory spending ('costo') + operational expenses ('gasto')
    const egresos = (transacciones6m ?? [])
      .filter(t => (t.tipo === 'gasto' || t.tipo === 'costo') && t.fecha >= from && t.fecha < to)
      .reduce((s, t) => s + (t.monto ?? 0), 0)

    // Fallback to facturas if ledger empty for this month
    if (ingresos === 0) {
      ingresos = (facturasAll ?? [])
        .filter(f => f.estado === 'pagada' && f.fecha_emision >= from && f.fecha_emision < to)
        .reduce((s, f) => s + (f.monto_pagado ?? f.total ?? 0), 0)
    }

    cashFlowData.push({
      mes: MESES[d.getMonth()],
      ingresos,
      gastos: egresos,
      utilidad: ingresos - egresos,
    })
  }

  // ── 10. Qué priorizar vender ──────────────────────────────────────────────
  const priorizar = margenesRaw
    .filter(p => p.stock > p.stockMinimo && p.margen >= 20)
    .sort((a, b) => {
      // Score: margen * log(stock) — products with good margin and plenty of stock
      const score = (m: typeof a) => m.margen * Math.log1p(m.stock)
      return score(b) - score(a)
    })
    .slice(0, 5)

  // ── 11. Recomendaciones IA (reglas) ───────────────────────────────────────
  const recomendaciones: { tipo: 'warning' | 'info' | 'success'; texto: string }[] = []

  if (cuentasPorCobrar > flujoCaja * 1.5 && cuentasPorCobrar > 500)
    recomendaciones.push({ tipo: 'warning', texto: `Tienes ${formatCurrency(cuentasPorCobrar)} en cuentas por cobrar. Prioriza el cobro antes de fin de mes.` })

  if (diasInventario > 60)
    recomendaciones.push({ tipo: 'warning', texto: `El inventario actual dura ~${Math.round(diasInventario)} días al ritmo actual. Considera promociones para rotar stock.` })

  if (ticketPromedio > 0 && ticketPromedio < 50)
    recomendaciones.push({ tipo: 'info', texto: `Ticket promedio de ${formatCurrency(ticketPromedio)} es bajo. Considera combos o mínimos de pedido para aumentarlo.` })

  if (tasaConversion < 60 && totalPedidos >= 5)
    recomendaciones.push({ tipo: 'info', texto: `Solo el ${tasaConversion.toFixed(0)}% de pedidos se convierte en factura. Revisa pedidos confirmados pendientes de facturar.` })

  if (margenBrutoPromedio >= 30)
    recomendaciones.push({ tipo: 'success', texto: `Margen bruto promedio de ${margenBrutoPromedio.toFixed(1)}% — excelente. Mantén los precios actuales.` })

  if (capitalInventario > flujoCaja * 6 && flujoCaja > 0)
    recomendaciones.push({ tipo: 'info', texto: `El capital en inventario equivale a ${(capitalInventario / flujoCaja).toFixed(1)} meses de flujo. Evalúa reducir stock inactivo.` })

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finanzas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Dashboard financiero · {MESES[now.getMonth()]} {now.getFullYear()}
        </p>
      </div>

      {/* ── Estado de resultados del mes (income statement) ── */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Estado de resultados — {MESES[now.getMonth()]} {now.getFullYear()}</h2>
          <p className="text-xs text-slate-400">Ingresos − Costo de lo vendido (COGS) − Gastos operativos</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Ingresos"
            value={formatCurrency(ingresosMes)}
            subtitle="Cobros registrados en el mes"
            icon={ArrowUpRight}
            color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          />
          <MetricCard
            title="Costo de lo vendido (COGS)"
            value={formatCurrency(cogsMes)}
            subtitle="Costo de productos facturados"
            icon={Package}
            color="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
          />
          <MetricCard
            title="Gastos operativos"
            value={formatCurrency(gastosOperativosMes)}
            subtitle="Sueldos, servicios, marketing…"
            icon={ArrowDownRight}
            color="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
          />
          <MetricCard
            title="Utilidad bruta"
            value={formatCurrency(utilidadBruta)}
            subtitle={ingresosMes > 0 ? `Margen ${margenBrutoPct.toFixed(1)}%` : 'Sin ventas este mes'}
            icon={TrendingUp}
            color={utilidadBruta >= 0
              ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-500'}
          />
          <MetricCard
            title="Utilidad neta"
            value={formatCurrency(utilidadNeta)}
            subtitle={ingresosMes > 0
              ? `Margen ${margenNetoPct.toFixed(1)}%`
              : utilidadNeta >= 0 ? 'Mes en positivo' : 'Mes en negativo'}
            icon={Wallet}
            color={utilidadNeta >= 0
              ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-500'}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Costo de inventario adquirido este mes (compras): <span className="font-semibold text-slate-500 dark:text-slate-300">{formatCurrency(costoInventarioMes)}</span> — capital movido a stock, no afecta utilidad hasta que se venda.
        </p>
      </div>

      {/* ── 8 KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Capital en Inventario"
          value={formatCurrency(capitalInventario)}
          subtitle={`${(presentaciones ?? []).length} presentaciones activas`}
          icon={Package}
          color="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
        />
        <MetricCard
          title="Margen Bruto Promedio"
          value={`${margenBrutoPromedio.toFixed(1)}%`}
          subtitle="Sobre precio de venta"
          icon={TrendingUp}
          color={margenBrutoPromedio >= 30
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
            : margenBrutoPromedio >= 20
            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
            : "bg-red-100 dark:bg-red-900/30 text-red-500"}
        />
        <MetricCard
          title="Rotación de Inventario"
          value={`${rotacionInventario.toFixed(2)}x`}
          subtitle="Últimos 30 días"
          icon={Zap}
          color="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
        />
        <MetricCard
          title="Días de Inventario"
          value={diasInventario > 900 ? 'N/A' : `${Math.round(diasInventario)}d`}
          subtitle="Al ritmo de ventas actual"
          icon={Clock}
          color={diasInventario <= 30
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
            : diasInventario <= 60
            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
            : "bg-red-100 dark:bg-red-900/30 text-red-500"}
        />
        <MetricCard
          title="Cuentas por Cobrar"
          value={formatCurrency(cuentasPorCobrar)}
          subtitle="Facturas emitidas no pagadas"
          icon={CreditCard}
          color={cuentasPorCobrar === 0
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
            : "bg-red-100 dark:bg-red-900/30 text-red-500"}
        />
        <MetricCard
          title="Flujo de Caja (Mes)"
          value={formatCurrency(flujoCaja)}
          subtitle={`${facturasValidas.filter(f => f.estado === 'pagada').length} facturas cobradas`}
          icon={DollarSign}
          color="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
        />
        <MetricCard
          title="Ticket Promedio"
          value={ticketPromedio > 0 ? formatCurrency(ticketPromedio) : 'N/A'}
          subtitle={`${facturasValidas.length} facturas este mes`}
          icon={ShoppingBag}
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <MetricCard
          title="Tasa de Conversión"
          value={totalPedidos > 0 ? `${tasaConversion.toFixed(0)}%` : 'N/A'}
          subtitle={`${pedidosFacturados}/${totalPedidos} pedidos facturados`}
          icon={BarChart3}
          color={tasaConversion >= 70
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
            : "bg-amber-100 dark:bg-amber-900/30 text-amber-600"}
        />
      </div>

      {/* ── Qué priorizar vender + Recomendaciones ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priorizar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-sm text-slate-800 dark:text-white">Qué priorizar vender</h2>
            <span className="ml-auto text-xs text-slate-400">Alto margen · buen stock</span>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {priorizar.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Sin datos suficientes</p>
            ) : priorizar.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{p.nombre}</p>
                  <p className="text-xs text-slate-400">Stock: {p.stock} · {formatCurrency(p.precio)}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  p.margen >= 30 ? 'bg-emerald-100 text-emerald-700' :
                  p.margen >= 20 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-600'}`}>
                  {p.margen.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recomendaciones */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-teal-500" />
            <h2 className="font-semibold text-sm text-slate-800 dark:text-white">Recomendaciones</h2>
          </div>
          <div className="p-5 space-y-3">
            {recomendaciones.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Todo en orden 🎉</p>
            ) : recomendaciones.map((r, i) => (
              <div key={i} className={`flex gap-3 p-3 rounded-xl text-sm ${
                r.tipo === 'warning' ? 'bg-red-50 dark:bg-red-900/20' :
                r.tipo === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20' :
                'bg-blue-50 dark:bg-blue-900/20'}`}>
                <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                  r.tipo === 'warning' ? 'text-red-500' :
                  r.tipo === 'success' ? 'text-emerald-500' :
                  'text-blue-500'}`} />
                <p className={`leading-relaxed ${
                  r.tipo === 'warning' ? 'text-red-700 dark:text-red-300' :
                  r.tipo === 'success' ? 'text-emerald-700 dark:text-emerald-300' :
                  'text-blue-700 dark:text-blue-300'}`}>
                  {r.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-semibold text-sm text-slate-800 dark:text-white">Flujo de Caja — Últimos 6 meses</h2>
            <p className="text-xs text-slate-400 mt-0.5">Ingresos vs egresos (compras + gastos operativos)</p>
          </div>
          <div className="p-4">
            <CashFlowChart data={cashFlowData} />
          </div>
        </div>

        {/* Márgenes */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-semibold text-sm text-slate-800 dark:text-white">Márgenes por Producto</h2>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥30%</span>
              <span className="flex items-center gap-1 text-xs text-slate-400"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> ≥20%</span>
              <span className="flex items-center gap-1 text-xs text-slate-400"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;20%</span>
            </div>
          </div>
          <div className="p-4">
            <MargenesChart data={margenesChart} />
          </div>
        </div>
      </div>
    </div>
  )
}
