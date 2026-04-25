'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight, Package2, Tag, BarChart3 } from 'lucide-react'
import { Producto, Presentacion, Inventario } from '@/lib/types'
import { cn } from '@/lib/utils'

type ProductoWithPresentaciones = Producto & { presentaciones: Presentacion[] }

interface Props {
  /** Already filtered + sorted by the parent. */
  productos: ProductoWithPresentaciones[]
  /** The full (pre-filter) count, used by the empty state message. */
  totalCount: number
}

function getInv(pr: Presentacion): Inventario | null {
  if (!pr.inventario) return null
  return Array.isArray(pr.inventario) ? pr.inventario[0] ?? null : pr.inventario
}

function totalDisponible(pres: Presentacion[]): number {
  return pres.reduce((sum, pr) => {
    const inv = getInv(pr)
    return sum + (inv?.stock_disponible ?? inv?.stock_total ?? 0)
  }, 0)
}

function getStockStatus(pres: Presentacion[]): 'ok' | 'low' | 'empty' {
  if (!pres || pres.length === 0) return 'empty'
  const total = totalDisponible(pres)
  if (total === 0) return 'empty'
  const hasLow = pres.some((p) => {
    const inv = getInv(p)
    const disp = inv?.stock_disponible ?? inv?.stock_total ?? 0
    return disp > 0 && disp <= (p.stock_minimo ?? 0)
  })
  return hasLow ? 'low' : 'ok'
}

function StockBadge({ status }: { status: 'ok' | 'low' | 'empty' }) {
  const config = {
    ok:    { label: 'En stock',   classes: 'bg-green-100 text-green-700' },
    low:   { label: 'Stock bajo', classes: 'bg-yellow-100 text-yellow-700' },
    empty: { label: 'Sin stock',  classes: 'bg-red-100 text-red-700' },
  }
  const { label, classes } = config[status]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', classes)}>
      {label}
    </span>
  )
}

export default function ProductosTable({ productos, totalCount }: Props) {
  if (productos.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package2 className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">
            {totalCount === 0 ? 'No hay productos registrados' : 'Sin resultados con los filtros actuales'}
          </p>
          {totalCount === 0 && (
            <p className="text-slate-400 text-sm mt-1">
              Crea tu primer producto con el botón "Nuevo Producto"
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-900">
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">SKU</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Producto</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Categoría</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-center">Presentaciones</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Estado</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {productos.map((producto) => {
              const pres = producto.presentaciones ?? []
              const status = getStockStatus(pres)

              return (
                <tr key={producto.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {producto.codigo ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700">
                        {producto.imagen_url ? (
                          <Image
                            src={producto.imagen_url}
                            alt={producto.nombre}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-teal-50 dark:bg-teal-900/20">
                            <Package2 className="h-5 w-5 text-teal-400" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{producto.nombre}</p>
                        {producto.descripcion && (
                          <p className="text-xs text-slate-500 line-clamp-1 max-w-48">{producto.descripcion}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {producto.categoria ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        <Tag className="h-3 w-3" />
                        {producto.categoria}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                      {pres.length}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <StockBadge status={status} />
                      {!producto.activo && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                          Inactivo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/inventario?producto=${producto.id}`}
                        title="Ver en inventario"
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-teal-900/20"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Inventario
                      </Link>
                      <Link
                        href={`/productos/${producto.id}`}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-50 transition-colors dark:hover:bg-teal-900/20"
                      >
                        Ver
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
