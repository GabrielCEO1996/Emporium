import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
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
  ArrowLeft,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  AlertCircle,
  FileMinus,
} from 'lucide-react'
import FacturaPrintButton from '@/components/facturas/FacturaPrintButton'
import MarcarPagadaButton from '@/components/facturas/MarcarPagadaButton'
import WhatsAppButton from '@/components/shared/WhatsAppButton'
import EliminarFacturaButton from '@/components/facturas/EliminarFacturaButton'
import EnviarEmailButton from '@/components/facturas/EnviarEmailButton'
import { Profile } from '@/lib/types'

interface PageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

function isOverdue(factura: Factura): boolean {
  if (!factura.fecha_vencimiento) return false
  if (factura.estado === 'pagada' || factura.estado === 'anulada') return false
  return new Date(factura.fecha_vencimiento) < new Date()
}

export default async function FacturaDetailPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: factura, error }, { data: profile }, { data: empresaConfig }] = await Promise.all([
    supabase
      .from('facturas')
      .select('*, cliente:clientes(*), vendedor:profiles(*), items:factura_items(*)')
      .eq('id', params.id)
      .single(),
    user ? supabase.from('profiles').select('rol').eq('id', user.id).single() : Promise.resolve({ data: null }),
    supabase.from('empresa_config').select('*').limit(1).maybeSingle(),
  ])

  if (error || !factura) {
    notFound()
  }

  const f = factura as Factura
  const isAdmin = (profile as Profile | null)?.rol === 'admin'
  const overdue = isOverdue(f)
  const saldo = (f.total ?? 0) - (f.monto_pagado ?? 0)
  const tasaImpuesto = f.tasa_impuesto ?? 16

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5 print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/facturas"
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Facturas
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="font-mono font-semibold text-slate-900">{f.numero}</span>
            </div>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                ESTADO_FACTURA_COLORS[f.estado] ?? 'bg-gray-100 text-gray-700'
              }`}
            >
              {ESTADO_FACTURA_LABELS[f.estado] ?? f.estado}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                <AlertCircle className="h-3 w-3" />
                Vencida
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <WhatsAppButton tipo="factura" factura={f} empresa={empresaConfig ?? undefined} />
            <EnviarEmailButton
              facturaId={f.id}
              clienteEmail={f.cliente?.email}
              clienteId={f.cliente_id}
            />
            <FacturaPrintButton factura={f} empresaConfig={empresaConfig ?? undefined} />

            {f.estado !== 'pagada' && f.estado !== 'anulada' && (
              <MarcarPagadaButton facturaId={f.id} />
            )}

            <Link
              href={`/notas-credito/nueva?factura_id=${f.id}`}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileMinus className="h-4 w-4" />
              Nota de Crédito
            </Link>
            <EliminarFacturaButton
              facturaId={f.id}
              facturaNumero={f.numero}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Overdue alert */}
        {overdue && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Factura vencida</p>
              <p className="text-sm text-red-700">
                Esta factura venció el {formatDate(f.fecha_vencimiento)} y tiene un saldo
                pendiente de {formatCurrency(saldo)}.
              </p>
            </div>
          </div>
        )}

        {/* Invoice Header Block */}
        <div className="rounded-lg bg-white border border-slate-200 p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Información de Factura
              </h2>
              <dl className="space-y-2">
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Número</dt>
                  <dd className="font-mono font-semibold text-slate-900">{f.numero}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Fecha de Emisión</dt>
                  <dd className="text-slate-900">{formatDate(f.fecha_emision)}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Fecha de Vencimiento</dt>
                  <dd className={`${overdue ? 'font-semibold text-red-600' : 'text-slate-900'}`}>
                    {formatDate(f.fecha_vencimiento)}
                  </dd>
                </div>
                {f.pedido_id && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-500">Pedido Asociado</dt>
                    <dd>
                      <Link
                        href={`/pedidos/${f.pedido_id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        Ver pedido
                      </Link>
                    </dd>
                  </div>
                )}
                {f.vendedor && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-500">Vendedor</dt>
                    <dd className="text-slate-900">{f.vendedor.nombre}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Client Info */}
            {f.cliente && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Cliente
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span className="font-semibold text-slate-900">{f.cliente.nombre}</span>
                  </div>
                  {f.cliente.rif && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-600">RIF: {f.cliente.rif}</span>
                    </div>
                  )}
                  {f.cliente.telefono && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-600">{f.cliente.telefono}</span>
                    </div>
                  )}
                  {f.cliente.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-600">{f.cliente.email}</span>
                    </div>
                  )}
                  {f.cliente.direccion && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-600">
                        {f.cliente.direccion}
                        {f.cliente.ciudad ? `, ${f.cliente.ciudad}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Artículos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Cant.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Precio Unit.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Desc.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!f.items || f.items.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                      Sin artículos
                    </td>
                  </tr>
                ) : (
                  f.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-900">{item.descripcion}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{item.cantidad}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCurrency(item.precio_unitario)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {item.descuento > 0 ? `${item.descuento}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-lg bg-white border border-slate-200 p-6">
          <div className="ml-auto max-w-xs space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-900">{formatCurrency(f.subtotal)}</span>
            </div>
            {f.descuento > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Descuento</span>
                <span className="text-red-600">- {formatCurrency(f.descuento)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Base Imponible</span>
              <span className="text-slate-900">{formatCurrency(f.base_imponible)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">IVA ({tasaImpuesto}%)</span>
              <span className="text-slate-900">{formatCurrency(f.impuesto)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-base">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900">{formatCurrency(f.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1 text-slate-500">
                <CreditCard className="h-4 w-4" />
                Monto Pagado
              </div>
              <span className="text-green-600 font-medium">{formatCurrency(f.monto_pagado)}</span>
            </div>
            <div
              className={`flex justify-between text-sm font-semibold pt-1 border-t border-slate-200 ${
                saldo > 0 ? 'text-orange-600' : 'text-green-600'
              }`}
            >
              <span>Saldo Pendiente</span>
              <span>{formatCurrency(saldo)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {f.notas && (
          <div className="rounded-lg bg-white border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Notas</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{f.notas}</p>
          </div>
        )}
      </div>
    </div>
  )
}
