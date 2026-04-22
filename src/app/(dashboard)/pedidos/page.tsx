import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Pedido, EstadoPedido } from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  ESTADO_PEDIDO_LABELS,
  ESTADO_PEDIDO_COLORS,
} from '@/lib/utils'
import {
  ShoppingCart,
  Plus,
  ChevronRight,
  CalendarDays,
  TrendingUp,
  Clock,
  CheckCircle2,
  Truck,
  FileText,
} from 'lucide-react'
import GenerarFacturaButton from '@/components/pedidos/GenerarFacturaButton'

interface PageProps {
  searchParams: {
    estado?: string
    fecha_inicio?: string
    fecha_fin?: string
    cliente?: string
  }
}

export const dynamic = 'force-dynamic'

export default async function PedidosPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const estadoFilter = searchParams.estado || ''
  const fechaInicio = searchParams.fecha_inicio || ''
  const fechaFin = searchParams.fecha_fin || ''
  const clienteFilter = searchParams.cliente || ''

  let query = supabase
    .from('pedidos')
    .select(
      `
      id,
      numero,
      estado,
      fecha_pedido,
      fecha_entrega_estimada,
      subtotal,
      descuento,
      impuesto,
      total,
      notas,
      cliente:clientes(id, nombre, rif),
      conductor:conductores(id, nombre),
      facturas(id, numero)
    `
    )
    .order('fecha_pedido', { ascending: false })

  if (estadoFilter) {
    query = query.eq('estado', estadoFilter)
  }
  if (fechaInicio) {
    query = query.gte('fecha_pedido', fechaInicio)
  }
  if (fechaFin) {
    query = query.lte('fecha_pedido', fechaFin + 'T23:59:59')
  }
  if (clienteFilter) {
    query = query.eq('cliente_id', clienteFilter)
  }

  const { data: pedidos, error } = await query

  // Stats from all pedidos (no filter)
  const { data: allPedidos } = await supabase
    .from('pedidos')
    .select('total, estado')

  const totalVentas =
    allPedidos?.reduce((sum, p) => sum + (p.total ?? 0), 0) ?? 0
  const pendientes =
    allPedidos?.filter((p) => p.estado === 'borrador').length ?? 0
  const confirmados =
    allPedidos?.filter((p) => p.estado === 'confirmado').length ?? 0
  const enRuta =
    allPedidos?.filter((p) => p.estado === 'en_ruta').length ?? 0

  const hasFilters = estadoFilter || fechaInicio || fechaFin || clienteFilter

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Pedidos</h1>
              <p className="text-sm text-slate-500">
                Gestión de pedidos y ventas
              </p>
            </div>
          </div>
          <Link
            href="/pedidos/nuevo"
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Nuevo Pedido
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Total Ventas
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {formatCurrency(totalVentas)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50">
                <TrendingUp className="h-4 w-4 text-teal-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Borradores
                </p>
                <p className="mt-1 text-xl font-bold text-slate-700">
                  {pendientes}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                <Clock className="h-4 w-4 text-slate-500" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Confirmados
                </p>
                <p className="mt-1 text-xl font-bold text-teal-700">
                  {confirmados}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  En Ruta
                </p>
                <p className="mt-1 text-xl font-bold text-yellow-700">
                  {enRuta}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-50">
                <Truck className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <form method="GET" className="flex flex-wrap gap-3">
          <select
            name="estado"
            defaultValue={estadoFilter}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_PEDIDO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Desde</label>
            <input
              type="date"
              name="fecha_inicio"
              defaultValue={fechaInicio}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Hasta</label>
            <input
              type="date"
              name="fecha_fin"
              defaultValue={fechaFin}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <button
            type="submit"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Filtrar
          </button>

          {hasFilters && (
            <Link
              href="/pedidos"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
            >
              Limpiar
            </Link>
          )}
        </form>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Error al cargar los pedidos: {error.message}
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {!pedidos || pedidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <ShoppingCart className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="mt-4 text-base font-medium text-slate-900">
                {hasFilters ? 'Sin resultados' : 'No hay pedidos'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {hasFilters
                  ? 'Intente ajustar los filtros de búsqueda.'
                  : 'Comience creando su primer pedido.'}
              </p>
              {!hasFilters && (
                <Link
                  href="/pedidos/nuevo"
                  className="mt-5 flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Pedido
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        N°
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Cliente
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Fecha
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Estado
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Conductor
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Total
                      </th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pedidos.map((pedido: any) => (
                      <tr
                        key={pedido.id}
                        className="group transition-colors hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <span className="font-mono text-sm font-semibold text-slate-900">
                            #{pedido.numero}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-medium text-slate-900">
                              {pedido.cliente?.nombre ?? '—'}
                            </p>
                            {pedido.cliente?.rif && (
                              <p className="text-xs text-slate-500">
                                {pedido.cliente.rif}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(pedido.fecha_pedido)}
                          </div>
                          {pedido.fecha_entrega_estimada && (
                            <p className="mt-0.5 text-xs text-slate-400">
                              Entrega: {formatDate(pedido.fecha_entrega_estimada)}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              ESTADO_PEDIDO_COLORS[pedido.estado] ?? 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {ESTADO_PEDIDO_LABELS[pedido.estado] ?? pedido.estado}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {pedido.conductor?.nombre ? (
                            <div className="flex items-center gap-1.5">
                              <Truck className="h-3.5 w-3.5 text-slate-400" />
                              {pedido.conductor.nombre}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900">
                          {formatCurrency(pedido.total ?? 0)}
                        </td>
                        <td className="px-5 py-4">
                          {pedido.estado === 'confirmado' ? (
                            <GenerarFacturaButton
                              pedidoId={pedido.id}
                              clienteId={pedido.cliente?.id ?? ''}
                            />
                          ) : pedido.estado === 'facturado' && pedido.facturas?.[0]?.id ? (
                            <Link
                              href={`/facturas/${pedido.facturas[0].id}`}
                              className="flex items-center justify-end gap-1 text-xs font-medium text-teal-600 hover:text-teal-800 transition-colors"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {pedido.facturas[0].numero ?? 'Ver Factura'}
                            </Link>
                          ) : (
                            <Link
                              href={`/pedidos/${pedido.id}`}
                              className="flex items-center justify-end gap-1 text-xs font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-teal-600"
                            >
                              Ver detalle
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="divide-y divide-slate-100 md:hidden">
                {pedidos.map((pedido: any) => (
                  <Link
                    key={pedido.id}
                    href={`/pedidos/${pedido.id}`}
                    className="flex items-start justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-slate-900">
                          #{pedido.numero}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            ESTADO_PEDIDO_COLORS[pedido.estado] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {ESTADO_PEDIDO_LABELS[pedido.estado] ?? pedido.estado}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-700 truncate">
                        {pedido.cliente?.nombre ?? '—'}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                        <span>{formatDate(pedido.fecha_pedido)}</span>
                        {pedido.conductor?.nombre && (
                          <span>{pedido.conductor.nombre}</span>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(pedido.total ?? 0)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                <p className="text-xs text-slate-500">
                  {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}{' '}
                  encontrado{pedidos.length !== 1 ? 's' : ''}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
