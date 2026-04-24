'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { EstadoPedido } from '@/lib/types'
import {
  Loader2, CheckCircle2, Truck, Package, Lock,
  XCircle, FileText, Trash2, X, ShieldCheck,
} from 'lucide-react'

interface Conductor {
  id: string
  nombre: string
  telefono?: string
}

interface PedidoActionsProps {
  pedidoId: string
  currentEstado: EstadoPedido
  currentConductorId: string | null
  conductores: Conductor[]
  isAdmin: boolean
  facturaId?: string | null
}

type LoadingKey = 'confirmar' | 'aprobar' | 'despachar' | 'entregar' | 'cancelar' | 'eliminar' | 'guardar'

export default function PedidoActions({
  pedidoId,
  currentEstado,
  currentConductorId,
  conductores,
  isAdmin,
  facturaId,
}: PedidoActionsProps) {
  const router = useRouter()
  const [conductorId, setConductorId] = useState(currentConductorId ?? '')
  const [loading, setLoading] = useState<LoadingKey | null>(null)

  // Cancelar modal state
  const [showCancelarModal, setShowCancelarModal] = useState(false)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')

  const setLoad = (key: LoadingKey) => setLoading(key)
  const clearLoad = () => setLoading(null)

  const doPost = async (endpoint: string, body?: Record<string, any>) => {
    const res = await fetch(`/api/pedidos/${pedidoId}/${endpoint}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Error')
    return data
  }

  const handleConfirmar = async () => {
    setLoad('confirmar')
    try {
      await doPost('confirmar')
      toast.success('Pedido confirmado')
      router.refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { clearLoad() }
  }

  const handleAprobar = async () => {
    setLoad('aprobar')
    try {
      await doPost('aprobar')
      toast.success('Pedido aprobado — inventario reservado')
      router.refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { clearLoad() }
  }

  const handleDespachar = async () => {
    setLoad('despachar')
    try {
      const data = await doPost('despachar')
      toast.success(
        data?.factura_numero
          ? `Pedido despachado — factura ${data.factura_numero} emitida`
          : 'Pedido despachado — factura emitida'
      )
      router.refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { clearLoad() }
  }

  const handleEntregar = async () => {
    if (!confirm('¿Confirmar entrega? El inventario se descontará definitivamente.')) return
    setLoad('entregar')
    try {
      await doPost('entregar')
      toast.success('Pedido entregado — stock actualizado')
      router.refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { clearLoad() }
  }

  const handleCancelar = async () => {
    if (!motivoCancelacion.trim()) return
    setLoad('cancelar')
    try {
      await doPost('cancelar', { motivo: motivoCancelacion.trim() })
      toast.success('Pedido cancelado — reserva liberada')
      setShowCancelarModal(false)
      setMotivoCancelacion('')
      router.refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { clearLoad() }
  }

  const handleEliminar = async () => {
    if (!confirm('¿Eliminar este pedido? Esta acción no se puede deshacer.')) return
    setLoad('eliminar')
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}`, { method: 'DELETE', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      toast.success('Pedido eliminado')
      router.push('/pedidos')
    } catch (e: any) { toast.error(e.message); clearLoad() }
  }

  const handleGuardarConductor = async () => {
    setLoad('guardar')
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: conductorId || null }),
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      toast.success('Conductor actualizado')
      router.refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { clearLoad() }
  }

  const conductorChanged = conductorId !== (currentConductorId ?? '')

  // Normalize state for flow logic: map legacy → new where applicable
  const isBorrador = currentEstado === 'borrador'
  const isConfirmada = currentEstado === 'confirmada' || currentEstado === 'confirmado'
  const isAprobada = currentEstado === 'aprobada' || currentEstado === 'preparando'
  const isDespachada = currentEstado === 'despachada' || currentEstado === 'despachado' || currentEstado === 'en_ruta'
  const isEntregada = currentEstado === 'entregada' || currentEstado === 'entregado'
  const isCancelada = currentEstado === 'cancelada' || currentEstado === 'cancelado'
  const isFacturadoLegacy = currentEstado === 'facturado'

  // Delete button visibility: admin any except entregada; (vendedor own borrador handled in parent)
  const canAdminDelete = isAdmin && !isEntregada

  return (
    <>
      <div className="flex flex-col items-end gap-3">
        {/* ── BORRADOR ─────────────────────────────────────────────────────── */}
        {isBorrador && (
          <div className="flex flex-wrap items-center gap-2">
            {conductores.length > 0 && (
              <>
                <div className="relative">
                  <select
                    value={conductorId}
                    onChange={e => setConductorId(e.target.value)}
                    className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="">Sin conductor</option>
                    {conductores.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <Truck className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                {conductorChanged && (
                  <button
                    onClick={handleGuardarConductor}
                    disabled={loading === 'guardar'}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    {loading === 'guardar' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Guardar
                  </button>
                )}
              </>
            )}

            <button
              onClick={handleConfirmar}
              disabled={loading === 'confirmar'}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'confirmar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar Pedido
            </button>

            <button
              onClick={handleEliminar}
              disabled={loading === 'eliminar'}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
            >
              {loading === 'eliminar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Eliminar
            </button>
          </div>
        )}

        {/* ── CONFIRMADA ───────────────────────────────────────────────────── */}
        {isConfirmada && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700">
              <Lock className="h-3.5 w-3.5" />
              Confirmada — pendiente de aprobación
            </div>
            {isAdmin && (
              <>
                <button
                  onClick={handleAprobar}
                  disabled={loading === 'aprobar'}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading === 'aprobar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Aprobar Pedido
                </button>
                <button
                  onClick={() => setShowCancelarModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar Pedido
                </button>
                {canAdminDelete && (
                  <button
                    onClick={handleEliminar}
                    disabled={loading === 'eliminar'}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    {loading === 'eliminar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Eliminar
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── APROBADA ─────────────────────────────────────────────────────── */}
        {isAprobada && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
              <Package className="h-3.5 w-3.5" />
              Aprobada — stock reservado
            </div>
            {isAdmin && (
              <>
                <button
                  onClick={handleDespachar}
                  disabled={loading === 'despachar'}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading === 'despachar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                  Despachar
                </button>
                <button
                  onClick={() => setShowCancelarModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </button>
                {canAdminDelete && (
                  <button
                    onClick={handleEliminar}
                    disabled={loading === 'eliminar'}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    {loading === 'eliminar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Eliminar
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── DESPACHADA ───────────────────────────────────────────────────── */}
        {isDespachada && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
              <Truck className="h-3.5 w-3.5" />
              Despachada — en camino
            </div>
            {facturaId && (
              <Link
                href={`/facturas/${facturaId}`}
                className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Ver Factura
              </Link>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={handleEntregar}
                  disabled={loading === 'entregar'}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading === 'entregar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Marcar Entregada
                </button>
                <button
                  onClick={() => setShowCancelarModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </button>
                {canAdminDelete && (
                  <button
                    onClick={handleEliminar}
                    disabled={loading === 'eliminar'}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    {loading === 'eliminar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Eliminar
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ENTREGADA ────────────────────────────────────────────────────── */}
        {isEntregada && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Entregada
            </div>
            {facturaId && (
              <Link
                href={`/facturas/${facturaId}`}
                className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Ver Factura
              </Link>
            )}
          </div>
        )}

        {/* ── CANCELADA ────────────────────────────────────────────────────── */}
        {isCancelada && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              Cancelada
            </div>
            {canAdminDelete && (
              <button
                onClick={handleEliminar}
                disabled={loading === 'eliminar'}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                {loading === 'eliminar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eliminar
              </button>
            )}
          </div>
        )}

        {/* ── FACTURADO legacy ─────────────────────────────────────────────── */}
        {isFacturadoLegacy && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Facturado
            </div>
            {facturaId && (
              <Link
                href={`/facturas/${facturaId}`}
                className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Ver Factura
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Cancelar Modal ──────────────────────────────────────────────────── */}
      {showCancelarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">Cancelar pedido</h2>
              <button
                onClick={() => { setShowCancelarModal(false); setMotivoCancelacion('') }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                Esta acción cancelará el pedido y liberará el inventario reservado. Proporciona un motivo.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Motivo de cancelación *</label>
                <textarea
                  value={motivoCancelacion}
                  onChange={e => setMotivoCancelacion(e.target.value)}
                  placeholder="Ej: Cliente canceló, producto sin stock, error en pedido..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => { setShowCancelarModal(false); setMotivoCancelacion('') }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleCancelar}
                disabled={loading === 'cancelar' || !motivoCancelacion.trim()}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading === 'cancelar' && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancelar Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
