import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, ESTADO_PEDIDO_COLORS, ESTADO_PEDIDO_LABELS } from '@/lib/utils'
import { Truck, Plus, MapPin, Phone, Package } from 'lucide-react'
import AsignarConductorButton from './AsignarConductorButton'

export const dynamic = 'force-dynamic'

export default async function RutasPage() {
  const supabase = createClient()

  const [{ data: conductores }, { data: pedidosSinAsignar }, { data: pedidosEnRuta }] = await Promise.all([
    supabase.from('conductores').select('*').eq('activo', true).order('nombre'),
    supabase
      .from('pedidos')
      .select(`id, numero, total, direccion_entrega, fecha_entrega_estimada, clientes(nombre, telefono, direccion)`)
      .eq('estado', 'confirmado')
      .is('conductor_id', null)
      .order('fecha_entrega_estimada', { ascending: true }),
    supabase
      .from('pedidos')
      .select(`id, numero, total, estado, direccion_entrega, clientes(nombre, telefono), conductores(nombre)`)
      .in('estado', ['en_ruta', 'confirmado'])
      .not('conductor_id', 'is', null)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rutas de Entrega</h1>
          <p className="text-slate-500 text-sm mt-1">Asignación de pedidos a conductores</p>
        </div>
        <Link
          href="/rutas/conductores/nuevo"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Conductor
        </Link>
      </div>

      {/* Conductores */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4" /> Conductores Activos ({conductores?.length || 0})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {conductores?.map(c => {
            const pedidosAsignados = pedidosEnRuta?.filter((p: any) => p.conductores?.nombre === c.nombre).length || 0
            return (
              <Link key={c.id} href={`/rutas/conductores/${c.id}`}>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition cursor-pointer">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {c.nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{c.nombre}</p>
                      {c.zona && <p className="text-xs text-slate-500">{c.zona}</p>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {c.telefono && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone className="w-3 h-3" /> {c.telefono}
                      </div>
                    )}
                    {c.placa_vehiculo && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Truck className="w-3 h-3" /> {c.placa_vehiculo}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${pedidosAsignados > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {pedidosAsignados} pedido{pedidosAsignados !== 1 ? 's' : ''} asignado{pedidosAsignados !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
          {(!conductores || conductores.length === 0) && (
            <div className="col-span-full bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
              <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No hay conductores registrados</p>
            </div>
          )}
        </div>
      </div>

      {/* Pedidos sin asignar */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-500" />
          Pedidos Confirmados Sin Conductor ({pedidosSinAsignar?.length || 0})
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {pedidosSinAsignar && pedidosSinAsignar.length > 0 ? (
              pedidosSinAsignar.map((pedido: any) => (
                <div key={pedido.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/pedidos/${pedido.id}`} className="font-semibold text-blue-600 hover:underline text-sm">
                        {pedido.numero}
                      </Link>
                      {pedido.fecha_entrega_estimada && (
                        <span className="text-xs text-slate-400">
                          • Entrega: {formatDate(pedido.fecha_entrega_estimada)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700">{pedido.clientes?.nombre}</p>
                    {(pedido.direccion_entrega || pedido.clientes?.direccion) && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                        <MapPin className="w-3 h-3" />
                        {pedido.direccion_entrega || pedido.clientes?.direccion}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-700 text-sm">{formatCurrency(pedido.total)}</span>
                    <AsignarConductorButton
                      pedidoId={pedido.id}
                      conductores={conductores || []}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">
                No hay pedidos pendientes de asignar
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pedidos en ruta */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4 text-blue-500" />
          Pedidos Asignados / En Ruta ({pedidosEnRuta?.length || 0})
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Pedido</th>
                  <th className="text-left px-5 py-3">Cliente</th>
                  <th className="text-left px-5 py-3">Conductor</th>
                  <th className="text-left px-5 py-3">Estado</th>
                  <th className="text-right px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidosEnRuta && pedidosEnRuta.length > 0 ? pedidosEnRuta.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <Link href={`/pedidos/${p.id}`} className="font-medium text-blue-600 hover:underline text-sm">{p.numero}</Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      <p>{p.clientes?.nombre}</p>
                      {p.clientes?.telefono && <p className="text-xs text-slate-400">{p.clientes.telefono}</p>}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{p.conductores?.nombre}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_PEDIDO_COLORS[p.estado] || 'bg-gray-100 text-gray-600'}`}>
                        {ESTADO_PEDIDO_LABELS[p.estado]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">{formatCurrency(p.total)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">No hay pedidos en ruta</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
