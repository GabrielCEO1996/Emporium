import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Factura } from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  ESTADO_FACTURA_LABELS,
  ESTADO_FACTURA_COLORS,
} from '@/lib/utils'
import {
  FileText,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  MessageCircle,
} from 'lucide-react'
import FacturasExportButton from './FacturasExportButton'

interface PageProps {
  searchParams: {
    estado?: string
    desde?: string
    hasta?: string
    cliente?: string
  }
}

export const dynamic = 'force-dynamic'

function isOverdue(factura: Factura): boolean {
  if (factura.estado === 'pagada' || factura.estado === 'anulada' || factura.estado === 'con_nota_credito') {
    return false
  }
  // Primary rule: fecha_vencimiento is in the past
  if (factura.fecha_vencimiento && new Date(factura.fecha_vencimiento) < new Date()) {
    return true
  }
  // Fallback rule (spec): estado 'enviada' AND created_at older than 30 days
  if (factura.estado === 'enviada' || factura.estado === 'emitida') {
    const base = (factura as any).created_at ?? factura.fecha_emision
    if (!base) return false
    const thirty = new Date()
    thirty.setDate(thirty.getDate() - 30)
    return new Date(base) < thirty
  }
  return false
}

function daysOverdue(factura: Factura): number {
  if (!isOverdue(factura)) return 0
  const now = new Date()
  if (factura.fecha_vencimiento) {
    const venc = new Date(factura.fecha_vencimiento)
    return Math.floor((now.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
  }
  const base = (factura as any).created_at ?? factura.fecha_emision
  if (!base) return 0
  const d = new Date(base)
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) - 30)
}

function overdueRowClass(days: number): string {
  if (days >= 30) return 'bg-red-50/60 dark:bg-red-900/10'
  if (days >= 15) return 'bg-orange-50/60 dark:bg-orange-900/10'
  if (days >= 7)  return 'bg-amber-50/60 dark:bg-amber-900/10'
  return ''
}

function buildWhatsAppReminderUrl(factura: Factura & { cliente?: any }, empresaNombre?: string): string {
  const wa = factura.cliente?.whatsapp ?? factura.cliente?.telefono ?? ''
  if (!wa) return ''
  const numero = wa.replace(/\D/g, '')
  const saldo = ((factura.total ?? 0) - (factura.monto_pagado ?? 0)).toFixed(2)
  const msg = encodeURIComponent(
    `Estimado/a ${factura.cliente?.nombre ?? 'cliente'}, le contactamos de parte de ${empresaNombre ?? 'nuestra empresa'} para recordarle amablemente que tiene la factura *${factura.numero}* con saldo pendiente de *$${saldo}*${factura.fecha_vencimiento ? `, vencida el ${new Date(factura.fecha_vencimiento).toLocaleDateString('es-VE')}` : ''}. Por favor gestione el pago a la brevedad posible. Muchas gracias.`
  )
  return `https://wa.me/${numero}?text=${msg}`
}

export default async function FacturasPage({ searchParams }: PageProps) {
  const supabase = createClient()

  const estadoFilter = searchParams.estado || ''
  const desdeFilter = searchParams.desde || ''
  const hastaFilter = searchParams.hasta || ''
  const clienteFilter = searchParams.cliente || ''

  let query = supabase
    .from('facturas')
    .select('*, cliente:clientes(id, nombre, rif, whatsapp, telefono)')
    .order('fecha_emision', { ascending: false })

  if (estadoFilter) {
    query = query.eq('estado', estadoFilter)
  }
  if (desdeFilter) {
    query = query.gte('fecha_emision', desdeFilter)
  }
  if (hastaFilter) {
    query = query.lte('fecha_emision', hastaFilter)
  }

  const [{ data: facturas, error }, { data: empresaConfig }] = await Promise.all([
    query,
    supabase.from('empresa_config').select('nombre').limit(1).maybeSingle(),
  ])
  const allFacturas: Factura[] = (facturas as Factura[]) ?? []

  // Filter by cliente name if provided
  const filtered = clienteFilter
    ? allFacturas.filter((f) =>
        f.cliente?.nombre?.toLowerCase().includes(clienteFilter.toLowerCase())
      )
    : allFacturas

  // Summary stats
  const totalEmitidas = allFacturas.filter((f) => f.estado === 'emitida' || f.estado === 'enviada').length
  const totalPagadas = allFacturas.filter((f) => f.estado === 'pagada').length
  const totalAnuladas = allFacturas.filter((f) => f.estado === 'anulada').length
  const totalVencidas = allFacturas.filter(isOverdue).length
  const montoTotal = allFacturas.reduce((sum, f) => sum + (f.total ?? 0), 0)
  const montoPagado = allFacturas.reduce((sum, f) => sum + (f.monto_pagado ?? 0), 0)

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Facturas</h1>
              <p className="text-sm text-slate-500">
                {filtered.length} factura{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FacturasExportButton data={filtered} />
            <Link
              href="/facturas/nueva"
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva Factura
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-teal-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Emitidas</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalEmitidas}</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pagadas</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalPagadas}</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Vencidas</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{totalVencidas}</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Anuladas</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalAnuladas}</p>
          </div>
        </div>

        {/* Totals Bar */}
        <div className="rounded-lg bg-white border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1">Monto Total Facturado</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(montoTotal)}</p>
          </div>
          <div className="hidden sm:block h-10 w-px bg-slate-200" />
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1">Monto Cobrado</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(montoPagado)}</p>
          </div>
          <div className="hidden sm:block h-10 w-px bg-slate-200" />
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1">Saldo Pendiente</p>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(montoTotal - montoPagado)}</p>
          </div>
        </div>

        {/* Filters */}
        <form className="rounded-lg bg-white border border-slate-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Estado
              </label>
              <select
                name="estado"
                defaultValue={estadoFilter}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Todos los estados</option>
                <option value="emitida">Emitida</option>
                <option value="enviada">Enviada</option>
                <option value="pagada">Pagada</option>
                <option value="anulada">Anulada</option>
                <option value="con_nota_credito">Con Nota de Crédito</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Cliente
              </label>
              <input
                name="cliente"
                type="text"
                defaultValue={clienteFilter}
                placeholder="Buscar cliente..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Desde
              </label>
              <input
                name="desde"
                type="date"
                defaultValue={desdeFilter}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Hasta
              </label>
              <input
                name="hasta"
                type="date"
                defaultValue={hastaFilter}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
            >
              Filtrar
            </button>
            <Link
              href="/facturas"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Limpiar
            </Link>
          </div>
        </form>

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Error al cargar facturas: {error.message}
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden lg:block rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  N° Factura
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Emisión
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Vencimiento
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Pagado
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Cobro
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No se encontraron facturas
                  </td>
                </tr>
              ) : (
                filtered.map((factura) => {
                  const overdue = isOverdue(factura)
                  const days = daysOverdue(factura)
                  const saldo = (factura.total ?? 0) - (factura.monto_pagado ?? 0)
                  const waUrl = saldo > 0 ? buildWhatsAppReminderUrl(factura as any, empresaConfig?.nombre) : ''
                  return (
                    <tr
                      key={factura.id}
                      className={`hover:brightness-95 transition-colors ${overdueRowClass(days)}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/facturas/${factura.id}`}
                          className="font-mono font-semibold text-teal-600 hover:text-teal-800 hover:underline"
                        >
                          {factura.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {factura.cliente?.nombre ?? '—'}
                        </div>
                        {factura.cliente?.rif && (
                          <div className="text-xs text-slate-500">{factura.cliente.rif}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(factura.fecha_emision)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={overdue ? 'font-semibold text-red-600' : 'text-slate-600'}>
                          {formatDate(factura.fecha_vencimiento)}
                        </span>
                        {overdue && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-red-600">
                            <AlertCircle className="h-3 w-3" /> Vencida
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            ESTADO_FACTURA_COLORS[factura.estado] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {ESTADO_FACTURA_LABELS[factura.estado] ?? factura.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(factura.total ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`font-medium ${saldo > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {formatCurrency(factura.monto_pagado ?? 0)}
                        </div>
                        {saldo > 0 && (
                          <div className="text-xs text-slate-400">Saldo: {formatCurrency(saldo)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {waUrl && days >= 7 && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Recordar pago (${days}d de retraso)`}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                              days >= 30 ? 'bg-red-500 hover:bg-red-600 text-white' :
                              days >= 15 ? 'bg-orange-500 hover:bg-orange-600 text-white' :
                              'bg-amber-400 hover:bg-amber-500 text-white'
                            }`}
                          >
                            <MessageCircle className="h-3 w-3" />
                            {days >= 30 ? `¡${days}d!` : `${days}d`}
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-lg bg-white border border-slate-200 p-8 text-center text-slate-500">
              No se encontraron facturas
            </div>
          ) : (
            filtered.map((factura) => {
              const overdue = isOverdue(factura)
              const saldo = (factura.total ?? 0) - (factura.monto_pagado ?? 0)
              return (
                <Link
                  key={factura.id}
                  href={`/facturas/${factura.id}`}
                  className={`block rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow ${
                    overdue ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-mono font-semibold text-teal-600">{factura.numero}</p>
                      <p className="text-sm font-medium text-slate-900">
                        {factura.cliente?.nombre ?? '—'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        ESTADO_FACTURA_COLORS[factura.estado] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {ESTADO_FACTURA_LABELS[factura.estado] ?? factura.estado}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div>
                      <span className="block text-slate-400">Emisión</span>
                      {formatDate(factura.fecha_emision)}
                    </div>
                    <div>
                      <span className="block text-slate-400">Vencimiento</span>
                      <span className={overdue ? 'font-semibold text-red-600' : ''}>
                        {formatDate(factura.fecha_vencimiento)}
                        {overdue && ' ⚠'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Total</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(factura.total ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Saldo</span>
                      <span className={saldo > 0 ? 'font-semibold text-orange-600' : 'text-green-600'}>
                        {formatCurrency(saldo)}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
