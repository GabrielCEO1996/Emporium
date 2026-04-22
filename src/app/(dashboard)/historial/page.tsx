import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatCurrency, formatDate, ESTADO_PEDIDO_COLORS, ESTADO_PEDIDO_LABELS, ESTADO_FACTURA_COLORS, ESTADO_FACTURA_LABELS } from '@/lib/utils'
import { History, TrendingUp, ReceiptText, ShoppingCart } from 'lucide-react'
import { Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: {
    cliente_id?: string
    fecha_inicio?: string
    fecha_fin?: string
    tipo?: string
  }
}

export default async function HistorialPage({ searchParams }: PageProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if ((profile as Profile | null)?.rol !== 'admin') redirect('/dashboard')

  const { cliente_id, fecha_inicio, fecha_fin, tipo = 'facturas' } = searchParams

  // Load clientes for filter dropdown
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  // Build queries
  let pedidosQuery = supabase
    .from('pedidos')
    .select(`id, numero, estado, total, fecha_pedido, clientes(nombre), conductores(nombre)`)
    .order('fecha_pedido', { ascending: false })
    .limit(100)

  let facturasQuery = supabase
    .from('facturas')
    .select(`id, numero, estado, total, monto_pagado, fecha_emision, clientes(nombre)`)
    .order('fecha_emision', { ascending: false })
    .limit(100)

  if (cliente_id) {
    pedidosQuery = pedidosQuery.eq('cliente_id', cliente_id)
    facturasQuery = facturasQuery.eq('cliente_id', cliente_id)
  }
  if (fecha_inicio) {
    pedidosQuery = pedidosQuery.gte('fecha_pedido', fecha_inicio)
    facturasQuery = facturasQuery.gte('fecha_emision', fecha_inicio)
  }
  if (fecha_fin) {
    pedidosQuery = pedidosQuery.lte('fecha_pedido', fecha_fin + 'T23:59:59')
    facturasQuery = facturasQuery.lte('fecha_emision', fecha_fin + 'T23:59:59')
  }

  const [{ data: pedidos }, { data: facturas }] = await Promise.all([pedidosQuery, facturasQuery])

  // Stats
  const totalFacturado = facturas?.reduce((a, f) => a + f.total, 0) || 0
  const totalCobrado = facturas?.reduce((a, f) => a + f.monto_pagado, 0) || 0
  const totalPedidos = pedidos?.length || 0

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Historial de Ventas</h1>
        <p className="text-slate-500 text-sm mt-1">Consulta de pedidos y facturas con filtros</p>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Cliente</label>
            <select
              name="cliente_id"
              defaultValue={cliente_id || ''}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todos los clientes</option>
              {clientes?.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Desde</label>
            <input
              type="date"
              name="fecha_inicio"
              defaultValue={fecha_inicio || ''}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Hasta</label>
            <input
              type="date"
              name="fecha_fin"
              defaultValue={fecha_fin || ''}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Ver</label>
            <select
              name="tipo"
              defaultValue={tipo}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="facturas">Facturas</option>
              <option value="pedidos">Pedidos</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Filtrar
          </button>
          <Link href="/historial" className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            Limpiar
          </Link>
        </div>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="w-5 h-5 text-teal-500" />
            <p className="text-sm text-slate-500">Pedidos encontrados</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{totalPedidos}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <ReceiptText className="w-5 h-5 text-emerald-500" />
            <p className="text-sm text-slate-500">Total Facturado</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalFacturado)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-violet-500" />
            <p className="text-sm text-slate-500">Total Cobrado</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalCobrado)}</p>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">
            {tipo === 'facturas' ? `Facturas (${facturas?.length || 0})` : `Pedidos (${pedidos?.length || 0})`}
          </h2>
        </div>

        {tipo === 'facturas' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Número</th>
                  <th className="text-left px-5 py-3">Cliente</th>
                  <th className="text-left px-5 py-3">Fecha</th>
                  <th className="text-left px-5 py-3">Estado</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-right px-5 py-3">Cobrado</th>
                  <th className="text-right px-5 py-3">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facturas && facturas.length > 0 ? facturas.map((f: any) => (
                  <tr key={f.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <Link href={`/facturas/${f.id}`} className="font-medium text-teal-600 hover:underline text-sm">{f.numero}</Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">{f.clientes?.nombre}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(f.fecha_emision)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_FACTURA_COLORS[f.estado] || 'bg-gray-100 text-gray-600'}`}>
                        {ESTADO_FACTURA_LABELS[f.estado] || f.estado}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">{formatCurrency(f.total)}</td>
                    <td className="px-5 py-3 text-right text-sm text-emerald-600">{formatCurrency(f.monto_pagado)}</td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-red-500">{formatCurrency(f.total - f.monto_pagado)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">No se encontraron facturas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Número</th>
                  <th className="text-left px-5 py-3">Cliente</th>
                  <th className="text-left px-5 py-3">Fecha</th>
                  <th className="text-left px-5 py-3">Estado</th>
                  <th className="text-left px-5 py-3">Conductor</th>
                  <th className="text-right px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidos && pedidos.length > 0 ? pedidos.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <Link href={`/pedidos/${p.id}`} className="font-medium text-teal-600 hover:underline text-sm">{p.numero}</Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">{p.clientes?.nombre}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(p.fecha_pedido)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_PEDIDO_COLORS[p.estado] || 'bg-gray-100 text-gray-600'}`}>
                        {ESTADO_PEDIDO_LABELS[p.estado] || p.estado}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{p.conductores?.nombre || '-'}</td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">{formatCurrency(p.total)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">No se encontraron pedidos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
