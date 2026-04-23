'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ShoppingBag, CalendarDays, Truck, Package,
  PackageCheck, Clock, CheckCircle2, Loader2, AlertCircle, Trash2,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

// ── constants ─────────────────────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, string> = {
  borrador:  'bg-amber-100 text-amber-700',
  confirmada: 'bg-blue-100 text-blue-700',
  recibida:  'bg-green-100 text-green-700',
}

const ESTADO_LABELS: Record<string, string> = {
  borrador:  'Borrador',
  confirmada: 'Confirmada',
  recibida:  'Recibida',
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function CompraDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const id       = params.id as string

  const [compra,       setCompra]       = useState<any>(null)
  const [loading,      setLoading]      = useState(true)
  const [fetchError,   setFetchError]   = useState('')
  const [actionBusy,   setActionBusy]   = useState<string | null>(null)
  const [actionError,  setActionError]  = useState('')

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchCompra = useCallback(async () => {
    setFetchError('')
    try {
      const res  = await fetch(`/api/compras/${id}`)
      const data = await res.json()
      if (!res.ok) { setFetchError(data.error ?? 'Error al cargar la compra'); return }
      setCompra(data)
    } catch {
      setFetchError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchCompra() }, [fetchCompra])

  // ── estado change (calls PATCH /api/compras/[id]) ─────────────────────────

  const handleEstado = async (nuevoEstado: 'confirmada' | 'recibida') => {
    const confirmMsg =
      nuevoEstado === 'confirmada'
        ? '¿Confirmar esta orden de compra? Pasará al estado "Confirmada" y quedará lista para recibir.'
        : '¿Marcar como Recibida? El inventario se actualizará con las cantidades registradas.'

    if (!confirm(confirmMsg)) return

    setActionBusy(nuevoEstado)
    setActionError('')

    try {
      const res = await fetch(`/api/compras/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ estado: nuevoEstado }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cambiar estado')

      // Re-fetch full compra (PATCH returns minimal object, we need items too)
      await fetchCompra()
    } catch (e: any) {
      setActionError(e.message)
    } finally {
      setActionBusy(null)
    }
  }

  // ── delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta compra? Esta acción no se puede deshacer.')) return
    setActionBusy('delete')
    setActionError('')
    try {
      const res  = await fetch(`/api/compras/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar')
      router.push('/compras')
    } catch (e: any) {
      setActionError(e.message)
      setActionBusy(null)
    }
  }

  // ── loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (fetchError || !compra) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 max-w-md text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="font-semibold text-red-800 mb-1">{fetchError || 'Compra no encontrada'}</p>
          <Link href="/compras" className="text-sm text-teal-600 hover:underline">
            Volver a Compras
          </Link>
        </div>
      </div>
    )
  }

  // ── derived flags ──────────────────────────────────────────────────────────

  const isBorrador   = compra.estado === 'borrador'
  const isConfirmada = compra.estado === 'confirmada'
  const isRecibida   = compra.estado === 'recibida'
  const items: any[] = compra.items ?? []

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-slate-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          {/* Breadcrumb + estado badge */}
          <div className="flex items-center gap-3 flex-wrap">
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
              <span className="font-semibold text-slate-900">{formatDate(compra.fecha_compra ?? compra.fecha)}</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                ESTADO_COLORS[compra.estado] ?? 'bg-gray-100 text-gray-700'
              }`}
            >
              {isRecibida
                ? <PackageCheck className="h-3 w-3" />
                : <Clock className="h-3 w-3" />}
              {ESTADO_LABELS[compra.estado] ?? compra.estado}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">

              {/* borrador → confirmar */}
              {isBorrador && (
                <button
                  onClick={() => handleEstado('confirmada')}
                  disabled={!!actionBusy}
                  className="flex items-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {actionBusy === 'confirmada'
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <CheckCircle2 className="h-4 w-4" />}
                  Confirmar Compra
                </button>
              )}

              {/* borrador | confirmada → recibida (updates inventario) */}
              {(isBorrador || isConfirmada) && (
                <button
                  onClick={() => handleEstado('recibida')}
                  disabled={!!actionBusy}
                  className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {actionBusy === 'recibida'
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <PackageCheck className="h-4 w-4" />}
                  Marcar como Recibida
                </button>
              )}

              {/* recibida → badge only, no further actions */}
              {isRecibida && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  ✅ Recibida
                </div>
              )}

              {/* delete (only while not yet recibida) */}
              {!isRecibida && (
                <button
                  onClick={handleDelete}
                  disabled={!!actionBusy}
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  {actionBusy === 'delete'
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                  Eliminar
                </button>
              )}
            </div>

            {actionError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {actionError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* State banners */}
        {isBorrador && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">Compra en borrador</p>
              <p className="text-sm text-amber-700">
                Confirma la orden con el proveedor antes de recibirla.
                El inventario solo se actualiza al marcarla como <strong>Recibida</strong>.
              </p>
            </div>
          </div>
        )}

        {isConfirmada && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
            <PackageCheck className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-800">Orden confirmada</p>
              <p className="text-sm text-blue-700">
                Cuando llegue la mercancía, haz clic en <strong>Marcar como Recibida</strong> para actualizar el inventario.
              </p>
            </div>
          </div>
        )}

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

        {/* ── Info block ──────────────────────────────────────────────────────── */}
        <div className="rounded-lg bg-white border border-slate-200 p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

            {/* Compra info */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Información de la compra
              </h2>
              <dl className="space-y-2">
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Fecha de compra</dt>
                  <dd className="flex items-center gap-1 text-slate-900">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                    {formatDate(compra.fecha_compra ?? compra.fecha)}
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Registrado</dt>
                  <dd className="flex items-center gap-1 text-slate-500">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {compra.created_at ? formatDate(compra.created_at) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Estado</dt>
                  <dd>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        ESTADO_COLORS[compra.estado] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {ESTADO_LABELS[compra.estado] ?? compra.estado}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Total</dt>
                  <dd className="font-bold text-slate-900">{formatCurrency(compra.total)}</dd>
                </div>
                {compra.notas && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-500">Notas</dt>
                    <dd className="text-slate-900 text-right max-w-xs">{compra.notas}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Proveedor */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Proveedor
              </h2>
              {compra.proveedor ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span className="font-semibold text-slate-900">{compra.proveedor.nombre}</span>
                  </div>
                  {compra.proveedor.empresa && (
                    <p className="text-sm text-slate-500 ml-6">{compra.proveedor.empresa}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sin proveedor registrado</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Items table ─────────────────────────────────────────────────────── */}
        <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <Package className="h-4 w-4 text-teal-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Productos comprados ({items.length})
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
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      Sin artículos registrados
                    </td>
                  </tr>
                ) : (
                  items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <p className="font-medium text-slate-900">
                          {/* GET route: presentacion:presentaciones(... producto:productos(nombre)) */}
                          {item.presentacion?.producto?.nombre ?? item.producto?.nombre ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.presentacion?.nombre ?? ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {item.cantidad}
                      </td>
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
              <span className="text-lg font-bold text-slate-900">{formatCurrency(compra.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
