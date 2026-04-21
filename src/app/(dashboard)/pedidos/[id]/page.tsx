import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Pedido, PedidoItem, EstadoPedido } from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  ESTADO_PEDIDO_LABELS,
  ESTADO_PEDIDO_COLORS,
} from '@/lib/utils'
import {
  ShoppingCart,
  ChevronRight,
  User,
  CalendarDays,
  MapPin,
  StickyNote,
  Truck,
  Package,
  FileText,
  Receipt,
} from 'lucide-react'
import PedidoActions from '@/components/pedidos/PedidoActions'
import WhatsAppButton from '@/components/shared/WhatsAppButton'

interface PageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export default async function PedidoDetailPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select(
      `
      *,
      cliente:clientes(*),
      vendedor:profiles(*),
      conductor:conductores(*),
      items:pedido_items(
        *,
        presentacion:presentaciones(
          *,
          producto:productos(id, nombre, categoria)
        )
      )
    `
    )
    .eq('id', params.id)
    .single()

  if (error || !pedido) {
    notFound()
  }

  // Fetch conductores + empresa config
  const [{ data: conductores }, { data: empresaConfig }] = await Promise.all([
    supabase.from('conductores').select('id, nombre, telefono').eq('activo', true).order('nombre'),
    supabase.from('empresa_config').select('nombre,telefono,email,direccion').limit(1).maybeSingle(),
  ])

  const p = pedido as Pedido
  const items = (p.items ?? []) as PedidoItem[]

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link
            href="/pedidos"
            className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Pedidos
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900 font-medium">#{p.numero}</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shrink-0">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-slate-900 font-mono">
                  Pedido #{p.numero}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    ESTADO_PEDIDO_COLORS[p.estado] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {ESTADO_PEDIDO_LABELS[p.estado] ?? p.estado}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                Creado el {formatDateTime(p.created_at)}
              </p>
            </div>
          </div>

          {/* Actions: change estado, generar factura */}
          <div className="flex flex-wrap items-center gap-2">
            <WhatsAppButton tipo="pedido" pedido={p} empresa={empresaConfig ?? undefined} />
            <PedidoActions
              pedidoId={p.id}
              currentEstado={p.estado}
              currentConductorId={p.conductor_id ?? null}
              conductores={conductores ?? []}
            />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-6xl">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Subtotal
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatCurrency(p.subtotal)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Descuento
            </p>
            <p className="mt-1 text-lg font-bold text-red-600">
              {formatCurrency(p.descuento)}
            </p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">
              Total
            </p>
            <p className="mt-1 text-lg font-bold text-blue-700">
              {formatCurrency(p.total)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left column: info cards */}
          <div className="lg:col-span-1 space-y-4">
            {/* Cliente */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <User className="h-4 w-4 text-slate-400" />
                  Cliente
                </h2>
              </div>
              <div className="px-5 py-4 space-y-2">
                {p.cliente ? (
                  <>
                    <Link
                      href={`/clientes/${p.cliente.id}`}
                      className="font-medium text-blue-600 hover:text-blue-700 text-sm"
                    >
                      {p.cliente.nombre}
                    </Link>
                    {p.cliente.rif && (
                      <p className="text-xs text-slate-500">RIF: {p.cliente.rif}</p>
                    )}
                    {p.cliente.telefono && (
                      <p className="text-xs text-slate-500">{p.cliente.telefono}</p>
                    )}
                    {p.cliente.direccion && (
                      <p className="text-xs text-slate-500">{p.cliente.direccion}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
              </div>
            </div>

            {/* Fechas */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  Fechas
                </h2>
              </div>
              <div className="divide-y divide-slate-50 px-5">
                <InfoRow label="Fecha del pedido" value={formatDate(p.fecha_pedido)} />
                <InfoRow
                  label="Entrega estimada"
                  value={p.fecha_entrega_estimada ? formatDate(p.fecha_entrega_estimada) : null}
                />
                <InfoRow
                  label="Entrega real"
                  value={
                    (p as any).fecha_entrega_real
                      ? formatDate((p as any).fecha_entrega_real)
                      : null
                  }
                />
              </div>
            </div>

            {/* Conductor */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Truck className="h-4 w-4 text-slate-400" />
                  Conductor
                </h2>
              </div>
              <div className="px-5 py-4">
                {p.conductor ? (
                  <>
                    <p className="text-sm font-medium text-slate-900">
                      {p.conductor.nombre}
                    </p>
                    {p.conductor.telefono && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {p.conductor.telefono}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Sin conductor asignado</p>
                )}
              </div>
            </div>

            {/* Dirección de entrega */}
            {p.direccion_entrega && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    Dirección de entrega
                  </h2>
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm text-slate-700">{p.direccion_entrega}</p>
                </div>
              </div>
            )}

            {/* Notas */}
            {p.notas && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <StickyNote className="h-4 w-4 text-slate-400" />
                    Notas
                  </h2>
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm text-slate-600 whitespace-pre-line">{p.notas}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right column: items table */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Ítems del pedido
                </h2>
                <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-400">Sin ítems</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Producto
                          </th>
                          <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Cant.
                          </th>
                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            P. Unit.
                          </th>
                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Desc.
                          </th>
                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-5 py-3">
                              <p className="font-medium text-slate-900">
                                {(item.presentacion as any)?.producto?.nombre ?? '—'}{' '}
                                —{' '}
                                {item.presentacion?.nombre ?? ''}
                              </p>
                              <p className="text-xs text-slate-500">
                                {item.presentacion?.unidad ?? ''}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-center text-slate-700">
                              {item.cantidad}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-700">
                              {formatCurrency(item.precio_unitario)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-500">
                              {item.descuento > 0
                                ? formatCurrency(item.descuento)
                                : '—'}
                            </td>
                            <td className="px-5 py-3 text-right font-semibold text-slate-900">
                              {formatCurrency(item.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals footer */}
                  <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex flex-col items-end gap-1.5 text-sm">
                      <div className="flex justify-between w-48">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-medium text-slate-900">
                          {formatCurrency(p.subtotal)}
                        </span>
                      </div>
                      {p.descuento > 0 && (
                        <div className="flex justify-between w-48">
                          <span className="text-slate-500">Descuento</span>
                          <span className="font-medium text-red-600">
                            − {formatCurrency(p.descuento)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between w-48 border-t border-slate-200 pt-1.5 mt-0.5">
                        <span className="font-semibold text-slate-900">Total</span>
                        <span className="font-bold text-blue-700">
                          {formatCurrency(p.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between py-3 gap-4">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-slate-900 text-right">
        {value || <span className="text-slate-400">—</span>}
      </span>
    </div>
  )
}
