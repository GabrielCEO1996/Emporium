import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Cliente, Pedido } from '@/lib/types'
import { formatCurrency, formatDate, ESTADO_PEDIDO_LABELS, ESTADO_PEDIDO_COLORS } from '@/lib/utils'
import {
  Users,
  ChevronRight,
  Pencil,
  Phone,
  Mail,
  MapPin,
  FileText,
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
} from 'lucide-react'

interface PageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export default async function ClienteDetailPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !cliente) {
    notFound()
  }

  // Fetch last 5 pedidos with totals
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(`
      id,
      numero,
      estado,
      fecha_pedido,
      subtotal,
      descuento,
      impuesto,
      total,
      notas
    `)
    .eq('cliente_id', params.id)
    .order('fecha_pedido', { ascending: false })
    .limit(5)

  // Aggregate stats
  const { data: allPedidos } = await supabase
    .from('pedidos')
    .select('total, estado')
    .eq('cliente_id', params.id)

  const totalPedidos = allPedidos?.length ?? 0
  const totalFacturado = allPedidos?.reduce((sum, p) => sum + (p.total ?? 0), 0) ?? 0
  const pedidosActivos = allPedidos?.filter((p) =>
    ['confirmado', 'en_ruta'].includes(p.estado)
  ).length ?? 0

  const c = cliente as Cliente

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href="/clientes" className="flex items-center gap-1.5 hover:text-teal-600 transition-colors">
            <Users className="h-3.5 w-3.5" />
            Clientes
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900 font-medium truncate max-w-xs">{c.nombre}</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white text-lg font-bold shrink-0">
              {c.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-slate-900">{c.nombre}</h1>
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
              </div>
              {c.rif && (
                <p className="mt-0.5 text-sm text-slate-500">RIF: {c.rif}</p>
              )}
              <p className="text-xs text-slate-400 mt-0.5">
                Registrado el {formatDate(c.created_at)}
              </p>
            </div>
          </div>

          <Link
            href={`/clientes/${c.id}/editar`}
            className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-6xl">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Pedidos</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{totalPedidos}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50">
                <ShoppingCart className="h-5 w-5 text-teal-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Facturado</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalFacturado)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pedidos Activos</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{pedidosActivos}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50">
                <Package className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left: Client Info */}
          <div className="lg:col-span-1 space-y-5">
            {/* Contacto */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-900">Contacto</h2>
              </div>
              <div className="divide-y divide-slate-50 px-5">
                <InfoRow icon={<Phone className="h-4 w-4 text-slate-400" />} label="Teléfono" value={c.telefono} />
                <InfoRow icon={<Mail className="h-4 w-4 text-slate-400" />} label="Correo" value={c.email} />
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
                <h2 className="text-sm font-semibold text-slate-900">Condiciones de Crédito</h2>
              </div>
              <div className="divide-y divide-slate-50 px-5">
                <InfoRow
                  icon={<CreditCard className="h-4 w-4 text-slate-400" />}
                  label="Límite de Crédito"
                  value={formatCurrency(c.limite_credito ?? 0)}
                />
                <InfoRow
                  icon={<Clock className="h-4 w-4 text-slate-400" />}
                  label="Días de Crédito"
                  value={c.dias_credito != null ? `${c.dias_credito} días` : null}
                />
              </div>
            </div>

            {/* Notas */}
            {c.notas && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <StickyNote className="h-4 w-4 text-slate-400" />
                    Notas
                  </h2>
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm text-slate-600 whitespace-pre-line">{c.notas}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Purchase History */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShoppingCart className="h-4 w-4 text-teal-600" />
                  Historial de Pedidos
                  <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    Últimos 5
                  </span>
                </h2>
                {totalPedidos > 5 && (
                  <Link
                    href={`/pedidos?cliente=${c.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
                  >
                    Ver todos
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>

              {!pedidos || pedidos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <ShoppingCart className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-900">Sin pedidos</p>
                  <p className="mt-1 text-xs text-slate-500">Este cliente no tiene pedidos registrados.</p>
                  <Link
                    href={`/pedidos/nuevo?cliente=${c.id}`}
                    className="mt-4 flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
                  >
                    Crear primer pedido
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
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
              )}

              {pedidos && pedidos.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Mostrando {pedidos.length} de {totalPedidos} pedidos</span>
                    <span className="font-medium text-slate-700">
                      Total histórico: {formatCurrency(totalFacturado)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
