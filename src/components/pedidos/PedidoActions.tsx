'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { EstadoPedido } from '@/lib/types'
import { showConfirm } from '@/components/ui/ConfirmDialog'
import { isTestingMode } from '@/lib/testing-mode'
import {
  Loader2, CheckCircle2, Truck, XCircle, FileText, Trash2, X, AlertTriangle,
} from 'lucide-react'

// ─── PedidoActions — Fase 4 ────────────────────────────────────────────────
// Modelo simplificado del pedido: solo 2 estados (aprobada / cancelada).
// El lifecycle de despacho vive en una columna separada estado_despacho:
//   por_despachar → despachado → entregado
//
// Botones removidos respecto a la versión anterior:
//   • "Confirmar Pedido"  — el estado 'borrador' se eliminó
//   • "Aprobar Pedido"    — el pedido nace ya aprobado
//   • Conductor selector  — se reincorpora cuando se rediseñe en el panel
//                           de despachos. No estaba siendo usado en el flow
//                           normal de Mache (siempre era 'Sin conductor').
//
// Botones que quedan:
//   • Despachar           — estado_despacho: por_despachar → despachado
//   • Marcar Entregada    — estado_despacho: despachado    → entregado
//   • Cancelar            — orden de oportunidad (cualquier por_despachar
//                           o despachado puede cancelarse antes de entregar)
//   • Ver Factura         — link al PDF/detalle (siempre que exista factura)
//   • Eliminar            — solo visible en NEXT_PUBLIC_IS_PRODUCTION=false
// ────────────────────────────────────────────────────────────────────────────

type EstadoDespacho = 'por_despachar' | 'despachado' | 'entregado'

interface PedidoActionsProps {
  pedidoId: string
  currentEstado: EstadoPedido
  /** Modelo nuevo (Fase 4). Si no viene (DB sin migrar todavía o page
   *  sin actualizar), derivamos del estado legacy. */
  currentEstadoDespacho?: EstadoDespacho | null
  isAdmin: boolean
  facturaId?: string | null
}

/**
 * Deriva estado_despacho desde el estado legacy cuando el page no lo pasa.
 * Mismas reglas que el backfill de la migration pedidos_despacho_v2.sql.
 */
function deriveEstadoDespacho(estado: EstadoPedido): EstadoDespacho {
  if (['entregada', 'entregado', 'pagado'].includes(estado as string)) return 'entregado'
  if (['despachada', 'despachado', 'en_ruta'].includes(estado as string)) return 'despachado'
  return 'por_despachar'
}

type LoadingKey = 'despachar' | 'entregar' | 'cancelar' | 'eliminar'

export default function PedidoActions({
  pedidoId,
  currentEstado,
  currentEstadoDespacho,
  isAdmin,
  facturaId,
}: PedidoActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<LoadingKey | null>(null)

  // Cancelar modal state
  const [showCancelarModal, setShowCancelarModal] = useState(false)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')

  // Eliminar-entregada modal state
  const [showEliminarEntregadaModal, setShowEliminarEntregadaModal] = useState(false)

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

  const handleDespachar = async () => {
    setLoad('despachar')
    try {
      await doPost('despachar')
      toast.success('Pedido despachado')
      router.refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { clearLoad() }
  }

  const handleEntregar = async () => {
    const ok = await showConfirm({
      title: '¿Confirmar entrega del pedido?',
      message: 'El inventario se descontará definitivamente. Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, marcar como entregado',
    })
    if (!ok) return
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
    const ok = await showConfirm({
      title: '¿Eliminar este pedido?',
      message: 'Esta acción no se puede deshacer. Solo disponible en modo prueba.',
      confirmLabel: 'Sí, eliminar',
      danger: true,
    })
    if (!ok) return
    setLoad('eliminar')
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}`, { method: 'DELETE', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      toast.success('Pedido eliminado')
      router.push('/pedidos')
    } catch (e: any) { toast.error(e.message); clearLoad() }
  }

  const handleEliminarEntregada = async () => {
    setLoad('eliminar')
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}`, { method: 'DELETE', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      toast.success('Pedido eliminado — inventario y facturas revertidos')
      setShowEliminarEntregadaModal(false)
      router.push('/pedidos')
    } catch (e: any) { toast.error(e.message); clearLoad() }
  }

  // ── Decision logic (modelo Fase 4) ─────────────────────────────────────
  const isCancelada = currentEstado === 'cancelada' || currentEstado === 'cancelado'
  const ed: EstadoDespacho = currentEstadoDespacho ?? deriveEstadoDespacho(currentEstado)

  // Eliminar solo en testing — en producción se usan motivos de cancelación
  // o notas de crédito para preservar audit trail.
  const canDelete = isAdmin && isTestingMode()

  return (
    <>
      <div className="flex flex-col items-end gap-3">
        {/* ── CANCELADA ────────────────────────────────────────────────────── */}
        {isCancelada && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              Cancelada
            </div>
            {canDelete && (
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

        {/* ── POR DESPACHAR ────────────────────────────────────────────────── */}
        {!isCancelada && ed === 'por_despachar' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              <Truck className="h-3.5 w-3.5" />
              Por despachar
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
                {canDelete && (
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

        {/* ── DESPACHADO ───────────────────────────────────────────────────── */}
        {!isCancelada && ed === 'despachado' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
              <Truck className="h-3.5 w-3.5" />
              En camino
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
                {canDelete && (
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

        {/* ── ENTREGADO ────────────────────────────────────────────────────── */}
        {!isCancelada && ed === 'entregado' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Entregado
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
            {canDelete && (
              <button
                onClick={() => setShowEliminarEntregadaModal(true)}
                disabled={loading === 'eliminar'}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                {loading === 'eliminar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eliminar Pedido
              </button>
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

      {/* ── Eliminar pedido entregado modal ─────────────────────────────────── */}
      {showEliminarEntregadaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-red-100 bg-red-50/60 px-6 py-4 rounded-t-2xl">
              <h2 className="flex items-center gap-2 text-base font-bold text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Eliminar pedido entregado
              </h2>
              <button
                onClick={() => setShowEliminarEntregadaModal(false)}
                disabled={loading === 'eliminar'}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white transition-colors disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                Este pedido ya fue entregado.
              </p>
              <p className="text-sm text-slate-600">Eliminar revertirá:</p>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                <li>Inventario — se restaura el stock descontado</li>
                <li>Factura asociada y sus líneas</li>
                <li>Pagos registrados y sus transacciones contables</li>
                <li>Deuda del cliente (saldo pendiente)</li>
              </ul>
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                Esta acción no se puede deshacer. Queda registrada en el historial de actividad.
              </div>
              <p className="pt-1 text-sm font-semibold text-slate-800">¿Continuar?</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setShowEliminarEntregadaModal(false)}
                disabled={loading === 'eliminar'}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                Volver
              </button>
              <button
                onClick={handleEliminarEntregada}
                disabled={loading === 'eliminar'}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading === 'eliminar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
