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
} from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()

  // Fetch stats in parallel
  const [
    { count: totalPedidos },
    { count: totalClientes },
    { count: totalProductos },
    { data: pedidosPendientes },
    { data: facturasRecientes },
    { data: stockBajo },
  ] = await Promise.all([
    supabase.from('pedidos').select('*', { count: 'exact', head: true }),
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('productos').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('pedidos')
      .select('id, numero, total, estado, fecha_pedido, clientes(nombre)')
      .in('estado', ['confirmado', 'en_ruta'])
      .order('fecha_pedido', { ascending: false })
      .limit(5),
    supabase.from('facturas')
      .select('id, numero, total, estado, fecha_emision, clientes(nombre)')
      .order('fecha_emision', { ascending: false })
      .limit(5),
    supabase.from('presentaciones')
      .select('id, nombre, stock, stock_minimo, productos(nombre)')
      .lt('stock', 10)
      .eq('activo', true)
      .limit(5),
  ])

  // Total ventas del mes
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: ventasMes } = await supabase
    .from('facturas')
    .select('total')
    .gte('fecha_emision', startOfMonth.toISOString())
    .eq('estado', 'pagada')

  const totalVentasMes = ventasMes?.reduce((acc, f) => acc + (f.total || 0), 0) || 0

  const stats = [
    {
      label: 'Pedidos Totales',
      value: totalPedidos || 0,
      icon: ShoppingCart,
      color: 'bg-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      href: '/pedidos',
    },
    {
      label: 'Clientes Activos',
      value: totalClientes || 0,
      icon: Users,
      color: 'bg-emerald-500',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      href: '/clientes',
    },
    {
      label: 'Productos',
      value: totalProductos || 0,
      icon: Package,
      color: 'bg-violet-500',
      bg: 'bg-violet-50',
      text: 'text-violet-600',
      href: '/productos',
    },
    {
      label: 'Ventas del Mes',
      value: formatCurrency(totalVentasMes),
      icon: TrendingUp,
      color: 'bg-amber-500',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      href: '/historial',
    },
  ]

  const estadoColors: Record<string, string> = {
    confirmado: 'bg-blue-100 text-blue-700',
    en_ruta: 'bg-yellow-100 text-yellow-700',
    entregado: 'bg-green-100 text-green-700',
    facturado: 'bg-purple-100 text-purple-700',
    emitida: 'bg-blue-100 text-blue-700',
    pagada: 'bg-green-100 text-green-700',
    anulada: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Resumen del negocio</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={stat.href}>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${stat.text}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Pedidos pendientes */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-500" />
              <h2 className="font-semibold text-slate-800">Pedidos Activos</h2>
            </div>
            <Link href="/pedidos" className="text-blue-600 text-sm hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {pedidosPendientes && pedidosPendientes.length > 0 ? (
              pedidosPendientes.map((pedido: any) => (
                <Link key={pedido.id} href={`/pedidos/${pedido.id}`}>
                  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{pedido.numero}</p>
                      <p className="text-xs text-slate-500">{(pedido.clientes as any)?.nombre}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${estadoColors[pedido.estado] || 'bg-gray-100 text-gray-700'}`}>
                        {pedido.estado.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">{formatCurrency(pedido.total)}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">
                No hay pedidos activos
              </div>
            )}
          </div>
        </div>

        {/* Stock bajo */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 p-5 border-b border-slate-100">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Stock Bajo</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {stockBajo && stockBajo.length > 0 ? (
              stockBajo.map((item: any) => (
                <div key={item.id} className="px-5 py-3.5">
                  <p className="font-medium text-slate-800 text-sm">{(item.productos as any)?.nombre}</p>
                  <p className="text-xs text-slate-500">{item.nombre}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.stock} en stock
                    </div>
                    <span className="text-xs text-slate-400">mín: {item.stock_minimo}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                Stock en niveles normales
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Facturas recientes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-slate-500" />
            <h2 className="font-semibold text-slate-800">Facturas Recientes</h2>
          </div>
          <Link href="/facturas" className="text-blue-600 text-sm hover:underline">Ver todas</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="text-left px-5 py-3">Número</th>
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-5 py-3">Fecha</th>
                <th className="text-left px-5 py-3">Estado</th>
                <th className="text-right px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {facturasRecientes && facturasRecientes.length > 0 ? (
                facturasRecientes.map((factura: any) => (
                  <tr key={factura.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <Link href={`/facturas/${factura.id}`} className="font-medium text-blue-600 hover:underline text-sm">
                        {factura.numero}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">{(factura.clientes as any)?.nombre}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">
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
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">
                    No hay facturas recientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
