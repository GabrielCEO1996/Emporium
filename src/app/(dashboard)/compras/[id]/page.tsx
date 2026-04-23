import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag, CalendarDays, Truck, PackageCheck, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import EliminarCompraButton from '../EliminarCompraButton'
import MarcarRecibidaButton from '@/components/compras/MarcarRecibidaButton'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

const ESTADO_COLORS: Record<string, string> = {
  borrador: 'bg-amber-100 text-amber-700',
  recibida: 'bg-green-100 text-green-700',
}

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  recibida: 'Recibida',
}

export default async function CompraDetailPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/dashboard')

  const { data: compra, error } = await supabase
    .from('compras')
    .select(`
      id, fecha, total, estado, notas, created_at, updated_at,
      proveedor:proveedores(id, nombre, empresa, telefono, email),
      items:compra_items(
        id, cantidad, precio_costo, subtotal,
        presentacion:presentaciones(
          id, nombre, unidad,
          producto:productos(id, nombre, imagen_url, categoria)
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !compra) notFound()

  const c = compra as any
  const isBorrador = c.estado === 'borrador'
  const isRecibida = c.estado === 'recibida'

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/compras"
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Compras
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
                <ShoppingBag className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900">{formatDate(c.fecha)}</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                ESTADO_COLORS[c.estado] ?? 'bg-gray-100 text-gray-700'
              }`}
            >
              {isBorrador ? <Clock className="h-3 w-3" /> : <PackageCheck className="h-3 w-3" />}
              {ESTADO_LABELS[c.estado] ?? c.estado}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {isBorrador && <MarcarRecibidaButton compraId={c.id} />}
            <EliminarCompraButton compraId={c.id} />
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Borrador notice */}
        {isBorrador && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">Compra en borrador</p>
              <p className="text-sm text-amber-700">
                El inventario <strong>no ha sido actualizado</strong> todavía. Haz clic en
                "Marcar como Recibida" para confirmar la recepción y actualizar el stock.
              </p>
            </div>
          </div>
        )}

        {/* Recibida confirmation */}
        {isRecibida && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
            <PackageCheck className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Compra recibida</p>
              <p className="text-sm text-green-700">
                El inventario fue actualizado con las cantidades de esta compra.
              </p>
            </div>
          </div>
        )}

        {/* Info block */}
        <div className="rounded-lg bg-white border border-slate-200 p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Compra info */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Información de la compra
              </h2>
              <dl className="space-y-2">
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Fecha</dt>
                  <dd className="flex items-center gap-1 text-slate-900">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                    {formatDate(c.fecha)}
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Estado</dt>
                  <dd>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        ESTADO_COLORS[c.estado] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {ESTADO_LABELS[c.estado] ?? c.estado}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Registrada</dt>
                  <dd className="text-slate-900">{formatDate(c.created_at)}</dd>
                </div>
                {c.notas && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-500">Notas</dt>
                    <dd className="text-slate-900 text-right max-w-xs">{c.notas}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Proveedor info */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Proveedor
              </h2>
              {c.proveedor ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span className="font-semibold text-slate-900">{c.proveedor.nombre}</span>
                  </div>
                  {c.proveedor.empresa && (
                    <p className="text-sm text-slate-500 ml-6">{c.proveedor.empresa}</p>
                  )}
                  {c.proveedor.telefono && (
                    <p className="text-sm text-slate-500 ml-6">{c.proveedor.telefono}</p>
                  )}
                  {c.proveedor.email && (
                    <p className="text-sm text-slate-500 ml-6">{c.proveedor.email}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sin proveedor registrado</p>
              )}
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Productos comprados ({(c.items ?? []).length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Costo Unit.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(c.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      Sin artículos
                    </td>
                  </tr>
                ) : (
                  (c.items as any[]).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {item.presentacion?.producto?.imagen_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.presentacion.producto.imagen_url}
                              alt={item.presentacion.producto.nombre}
                              className="h-8 w-8 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : null}
                          <div>
                            <p className="font-medium text-slate-900">
                              {item.presentacion?.producto?.nombre ?? '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.presentacion?.nombre ?? '—'}
                              {item.presentacion?.unidad ? ` · ${item.presentacion.unidad}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{item.cantidad}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCurrency(item.precio_costo)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(item.subtotal ?? item.cantidad * item.precio_costo)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Total footer */}
          <div className="border-t border-slate-200 px-6 py-4 flex justify-end">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">Total de la compra</span>
              <span className="text-lg font-bold text-slate-900">{formatCurrency(c.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
