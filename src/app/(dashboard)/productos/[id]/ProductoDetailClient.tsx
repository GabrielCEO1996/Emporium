'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, AlertTriangle, Package2 } from 'lucide-react'
import { Producto, Presentacion } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'
import ProductoForm from '@/components/productos/ProductoForm'

interface Props {
  producto: Producto & { presentaciones: Presentacion[] }
}

function getStockStatus(stock: number, stockMinimo: number): 'ok' | 'low' | 'empty' {
  if (stock === 0) return 'empty'
  if (stock <= stockMinimo) return 'low'
  return 'ok'
}

function StockBadge({ status }: { status: 'ok' | 'low' | 'empty' }) {
  const config = {
    ok: { label: 'En stock', classes: 'bg-green-100 text-green-700 border-green-200' },
    low: { label: 'Stock bajo', classes: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    empty: { label: 'Sin stock', classes: 'bg-red-100 text-red-700 border-red-200' },
  }
  const { label, classes } = config[status]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', classes)}>
      {label}
    </span>
  )
}

export default function ProductoDetailClient({ producto }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/productos/${producto.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al eliminar')
      }
      router.push('/productos')
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error inesperado')
      setDeleting(false)
    }
  }

  if (mode === 'edit') {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Editar producto</h2>
          <button
            onClick={() => setMode('view')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancelar edición
          </button>
        </div>
        <ProductoForm initialData={producto} mode="editar" />
      </div>
    )
  }

  const pres = producto.presentaciones ?? []

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setMode('edit')}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 shadow-sm transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </button>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="font-semibold text-red-800">¿Eliminar este producto?</p>
              <p className="mt-1 text-sm text-red-700">
                Se eliminarán también todas sus presentaciones. Esta acción no se puede deshacer.
              </p>
              {deleteError && (
                <p className="mt-2 text-sm font-medium text-red-800">{deleteError}</p>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Información general</h2>
        </div>
        <div className="p-6 flex gap-6">
          {/* Thumbnail */}
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
            {producto.imagen_url ? (
              <img src={producto.imagen_url} alt={producto.nombre} className="h-full w-full object-cover" />
            ) : (
              <Package2 className="h-12 w-12 text-slate-300" />
            )}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nombre</p>
            <p className="mt-1 font-medium text-slate-900">{producto.nombre}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Categoría</p>
            <p className="mt-1 font-medium text-slate-900">{producto.categoria ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estado</p>
            <p className="mt-1">
              <span className={cn(
                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                producto.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
              )}>
                {producto.activo ? 'Activo' : 'Inactivo'}
              </span>
            </p>
          </div>
          {producto.descripcion && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Descripción</p>
              <p className="mt-1 text-sm text-slate-700">{producto.descripcion}</p>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Presentations */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Presentaciones{' '}
            <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {pres.length}
            </span>
          </h2>
        </div>

        {pres.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package2 className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-slate-500">No hay presentaciones registradas</p>
            <button
              onClick={() => setMode('edit')}
              className="mt-3 text-sm font-medium text-blue-600 hover:underline"
            >
              Agregar presentaciones
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-700">Nombre</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Unidad</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Precio</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Costo</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Margen</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 text-center">Stock</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 text-center">Stock Mín.</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Cód. Barras</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pres.map(p => {
                  const status = getStockStatus(p.stock, p.stock_minimo)
                  const margen = p.precio > 0
                    ? (((p.precio - p.costo) / p.precio) * 100).toFixed(1)
                    : '0.0'
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.nombre}</td>
                      <td className="px-4 py-3 text-slate-600">{p.unidad}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(p.precio)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(p.costo)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-xs font-semibold',
                          Number(margen) >= 20 ? 'text-green-700' :
                          Number(margen) >= 10 ? 'text-yellow-700' : 'text-red-700'
                        )}>
                          {margen}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'font-semibold',
                          status === 'empty' ? 'text-red-600' :
                          status === 'low' ? 'text-yellow-600' : 'text-slate-900'
                        )}>
                          {p.stock.toLocaleString('es-VE')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">
                        {p.stock_minimo.toLocaleString('es-VE')}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {p.codigo_barras ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StockBadge status={status} />
                          {!p.activo && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 border border-slate-200">
                              Inactiva
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary stats */}
      {pres.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard
            label="Stock total"
            value={pres.reduce((s, p) => s + p.stock, 0).toLocaleString('es-VE')}
          />
          <SummaryCard
            label="Precio más bajo"
            value={formatCurrency(Math.min(...pres.map(p => p.precio)))}
          />
          <SummaryCard
            label="Precio más alto"
            value={formatCurrency(Math.max(...pres.map(p => p.precio)))}
          />
          <SummaryCard
            label="Presentaciones activas"
            value={pres.filter(p => p.activo).length.toString()}
          />
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}
