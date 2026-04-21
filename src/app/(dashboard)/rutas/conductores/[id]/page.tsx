import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate, ESTADO_PEDIDO_COLORS, ESTADO_PEDIDO_LABELS } from '@/lib/utils'
import { ArrowLeft, Truck, Phone, MapPin } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ConductorDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: conductor }, { data: pedidos }] = await Promise.all([
    supabase.from('conductores').select('*').eq('id', params.id).single(),
    supabase
      .from('pedidos')
      .select(`id, numero, estado, total, fecha_pedido, clientes(nombre)`)
      .eq('conductor_id', params.id)
      .order('fecha_pedido', { ascending: false })
      .limit(20),
  ])

  if (!conductor) notFound()

  const totalEntregas = pedidos?.filter(p => p.estado === 'entregado').length || 0
  const totalMonto = pedidos?.reduce((a, p) => a + p.total, 0) || 0

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/rutas" className="text-slate-500 hover:text-slate-700"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{conductor.nombre}</h1>
          <p className="text-slate-500 text-sm">Conductor de entregas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Información</h2>
          <div className="space-y-2">
            {conductor.telefono && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" /> {conductor.telefono}
              </div>
            )}
            {conductor.placa_vehiculo && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Truck className="w-4 h-4 text-slate-400" /> {conductor.placa_vehiculo}
              </div>
            )}
            {conductor.zona && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" /> {conductor.zona}
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Estadísticas</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-2xl font-bold text-slate-800">{pedidos?.length || 0}</p><p className="text-xs text-slate-500">Total pedidos</p></div>
            <div><p className="text-2xl font-bold text-slate-800">{totalEntregas}</p><p className="text-xs text-slate-500">Entregados</p></div>
            <div className="col-span-2"><p className="text-xl font-bold text-blue-600">{formatCurrency(totalMonto)}</p><p className="text-xs text-slate-500">Monto total</p></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Historial de Pedidos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Pedido</th>
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-5 py-3">Fecha</th>
                <th className="text-left px-5 py-3">Estado</th>
                <th className="text-right px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pedidos && pedidos.length > 0 ? pedidos.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/pedidos/${p.id}`} className="text-blue-600 hover:underline text-sm font-medium">{p.numero}</Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-700">{p.clientes?.nombre}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{formatDate(p.fecha_pedido)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_PEDIDO_COLORS[p.estado] || ''}`}>
                      {ESTADO_PEDIDO_LABELS[p.estado]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">{formatCurrency(p.total)}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">Sin pedidos asignados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
