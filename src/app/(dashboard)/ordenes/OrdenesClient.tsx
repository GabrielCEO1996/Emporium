'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckCircle2, XCircle, Clock, Loader2, MapPin, StickyNote,
  Package2, ChevronDown, ChevronUp, User, AlertTriangle, ExternalLink, Image as ImageIcon,
  Wallet, Landmark, CreditCard, FileText, BadgeCheck, Banknote, FileCheck,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { showConfirm } from '@/components/ui/ConfirmDialog'

type TipoPago = 'pendiente' | 'zelle' | 'transferencia' | 'stripe' | 'credito' | 'cheque' | 'efectivo'
type EstadoPago = 'verificado' | 'pendiente_verificacion' | 'rechazado'

interface Orden {
  id: string
  numero: string
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'
  total: number
  notas: string | null
  direccion_entrega: string | null
  motivo_rechazo: string | null
  created_at: string
  tipo_pago: TipoPago | null
  numero_referencia: string | null
  pago_confirmado: boolean | null
  /** Public URL to the Zelle screenshot / Cheque photo the buyer uploaded.
   *  Only present when the DB migration `payment_proofs.sql` has been run. */
  payment_proof_url?: string | null
  /** checkout_v2: payment verification state machine.
   *  Only present when `checkout_v2.sql` has been run. */
  estado_pago?: EstadoPago | null
  verificado_at?: string | null
  cliente: { id: string; nombre: string; rif: string | null; email: string | null; telefono: string | null } | null
  items: Array<{
    id: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    presentacion: { nombre: string; producto: { nombre: string } | null } | null
  }>
  pedido?: { id: string; numero: string; estado: string } | null
}

// Which tipo_pago values require manual admin confirmation before we can
// release the pedido. Stripe/credito don't — they're auto-confirmed elsewhere.
const MANUAL_CONFIRM_METHODS: Array<TipoPago> = ['zelle', 'cheque', 'efectivo', 'transferencia']

export default function OrdenesClient({
  ordenes, isAdmin,
}: { ordenes: Orden[]; isAdmin: boolean }) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const handleAprobar = async (orden: Orden) => {
    const ok = await showConfirm({
      title: `¿Aprobar orden ${orden.numero}?`,
      message: 'Se creará un pedido nuevo a partir de esta orden.',
      confirmLabel: 'Sí, aprobar',
    })
    if (!ok) return
    setBusyId(orden.id)
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/aprobar`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      toast.success(data.message ?? 'Orden aprobada')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al aprobar')
    } finally {
      setBusyId(null)
    }
  }

  const handleConfirmarPago = async (orden: Orden) => {
    const tipo =
      orden.tipo_pago === 'zelle' ? 'Zelle' :
      orden.tipo_pago === 'cheque' ? 'cheque' :
      orden.tipo_pago === 'efectivo' ? 'efectivo' :
      orden.tipo_pago === 'transferencia' ? 'transferencia' :
      'este método'
    const ok = await showConfirm({
      title: `¿Confirmar pago de ${orden.numero}?`,
      message: `Confirma que recibiste el pago por ${tipo}. La orden se aprobará y se creará el pedido automáticamente.`,
      confirmLabel: 'Sí, confirmar pago',
    })
    if (!ok) return
    setBusyId(orden.id)
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/confirmar-pago`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      toast.success(data.message ?? 'Pago confirmado')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al confirmar pago')
    } finally {
      setBusyId(null)
    }
  }

  const handleRechazar = async () => {
    if (!rejectId) return
    if (!motivo.trim()) {
      toast.error('Escribe un motivo')
      return
    }
    setBusyId(rejectId)
    try {
      const res = await fetch(`/api/ordenes/${rejectId}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      toast.success(data.message ?? 'Orden rechazada')
      setRejectId(null)
      setMotivo('')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al rechazar')
    } finally {
      setBusyId(null)
    }
  }

  if (ordenes.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
        <Package2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">No hay órdenes en este estado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {ordenes.map(orden => {
        const isOpen = openId === orden.id
        const busy = busyId === orden.id
        return (
          <article
            key={orden.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
          >
            {/* Row header */}
            <div className="flex flex-wrap items-center gap-4 p-4">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                  <EstadoBadge estado={orden.estado} />
                  <TipoPagoBadge tipo={orden.tipo_pago} confirmado={orden.pago_confirmado} />
                  <EstadoPagoBadge estadoPago={orden.estado_pago ?? null} />
                  {/* Legacy fallback: if checkout_v2 hasn't been migrated yet, use
                      pago_confirmado + manual-method heuristic as before. */}
                  {!orden.estado_pago
                    && orden.estado === 'pendiente'
                    && MANUAL_CONFIRM_METHODS.includes((orden.tipo_pago ?? 'pendiente') as TipoPago)
                    && !orden.pago_confirmado && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      <AlertTriangle className="w-3 h-3" />
                      Sin verificar
                    </span>
                  )}
                  <span>{formatDate(orden.created_at)}</span>
                </div>
                <p className="font-bold text-slate-800 dark:text-white mt-1">
                  {orden.numero}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {orden.cliente?.nombre ?? 'Cliente desconocido'}
                  {orden.cliente?.rif && <span className="text-slate-400">· {orden.cliente.rif}</span>}
                </p>
                {orden.numero_referencia && (orden.tipo_pago === 'zelle' || orden.tipo_pago === 'cheque' || orden.tipo_pago === 'transferencia') && (
                  <p className="text-xs text-sky-600 dark:text-sky-400 mt-0.5 font-mono">
                    {orden.tipo_pago === 'cheque' ? 'Cheque Nº: ' : 'Ref: '}
                    <span className="font-bold">{orden.numero_referencia}</span>
                  </p>
                )}
                {orden.payment_proof_url && (
                  <a
                    href={orden.payment_proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 mt-0.5 hover:underline"
                  >
                    <ImageIcon className="w-3 h-3" /> Ver comprobante
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-400">Total</p>
                <p className="font-black text-slate-800 dark:text-white text-lg">
                  {formatCurrency(Number(orden.total))}
                </p>
                <p className="text-xs text-slate-400">{orden.items?.length ?? 0} productos</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {orden.estado === 'pendiente' && isAdmin && (
                  <>
                    {/* Manual payment methods need the admin to confirm receipt */}
                    {MANUAL_CONFIRM_METHODS.includes((orden.tipo_pago ?? 'pendiente') as TipoPago) && !orden.pago_confirmado ? (
                      <button
                        disabled={busy}
                        onClick={() => handleConfirmarPago(orden)}
                        className="ripple inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                        Confirmar pago recibido
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => handleAprobar(orden)}
                        className="ripple inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Aprobar
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => { setRejectId(orden.id); setMotivo('') }}
                      className="ripple inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Rechazar
                    </button>
                  </>
                )}
                <button
                  onClick={() => setOpenId(isOpen ? null : orden.id)}
                  className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5"
                >
                  {isOpen ? <><ChevronUp className="w-4 h-4" /> Ocultar</> : <><ChevronDown className="w-4 h-4" /> Detalles</>}
                </button>
              </div>
            </div>

            {/* Rejection motive banner */}
            {orden.estado === 'rechazada' && orden.motivo_rechazo && (
              <div className="px-4 py-2 border-t border-rose-200/50 dark:border-rose-500/20 bg-rose-50/60 dark:bg-rose-500/5 text-sm">
                <span className="font-semibold text-rose-700 dark:text-rose-300">Motivo:</span>
                <span className="ml-2 text-rose-700/90 dark:text-rose-200/90">{orden.motivo_rechazo}</span>
              </div>
            )}

            {/* Approved — pedido link */}
            {orden.estado === 'aprobada' && orden.pedido && (
              <div className="px-4 py-2 border-t border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/5 text-sm">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">Pedido creado:</span>
                <a href={`/pedidos/${orden.pedido.id}`} className="ml-2 underline text-emerald-700 dark:text-emerald-200 font-bold">
                  {orden.pedido.numero}
                </a>
                <span className="ml-2 text-emerald-700/70 dark:text-emerald-200/70 text-xs">({orden.pedido.estado})</span>
              </div>
            )}

            {/* Details */}
            {isOpen && (
              <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-3 bg-slate-50/60 dark:bg-slate-800/30">
                {orden.direccion_entrega && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <span>{orden.direccion_entrega}</span>
                  </p>
                )}
                {orden.notas && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                    <StickyNote className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <span>{orden.notas}</span>
                  </p>
                )}
                {orden.payment_proof_url && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Comprobante de pago
                      {orden.numero_referencia && (
                        <span className="ml-2 font-mono text-sky-600 dark:text-sky-400">
                          {orden.tipo_pago === 'cheque' ? 'Cheque Nº ' : 'Ref '}
                          {orden.numero_referencia}
                        </span>
                      )}
                    </p>
                    <a href={orden.payment_proof_url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={orden.payment_proof_url}
                        alt="Comprobante de pago"
                        className="max-h-64 rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-slate-50 dark:bg-slate-800 hover:opacity-90 transition"
                      />
                    </a>
                    <a
                      href={orden.payment_proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 hover:underline"
                    >
                      Abrir en pestaña nueva <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {orden.items.map(it => (
                    <div key={it.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                      <div className="flex-1">
                        <p className="font-medium text-slate-800 dark:text-white">
                          {it.presentacion?.producto?.nombre ?? 'Producto'}
                        </p>
                        <p className="text-xs text-slate-400">{it.presentacion?.nombre}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500">× {it.cantidad}</p>
                        <p className="text-xs text-slate-400">{formatCurrency(Number(it.precio_unitario))} c/u</p>
                      </div>
                      <p className="font-bold text-slate-800 dark:text-white w-24 text-right">
                        {formatCurrency(Number(it.subtotal))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        )
      })}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 w-full max-w-md space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">Rechazar orden</h2>
              <p className="text-sm text-slate-500">Indica al cliente por qué no puede proceder.</p>
            </div>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ej. Producto fuera de stock, zona no cubierta, etc."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setRejectId(null); setMotivo('') }}
                className="px-4 py-2 text-sm rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleRechazar}
                disabled={busyId === rejectId}
                className="px-4 py-2 text-sm font-bold rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white inline-flex items-center gap-1.5 transition"
              >
                {busyId === rejectId
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <XCircle className="w-4 h-4" />}
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TipoPagoBadge({
  tipo, confirmado,
}: {
  tipo: TipoPago | null
  confirmado: boolean | null
}) {
  if (!tipo || tipo === 'pendiente') return null
  const map: Record<Exclude<TipoPago, 'pendiente'>, { cls: string; icon: React.ReactNode; label: string }> = {
    zelle:         { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: <Wallet   className="w-3 h-3" />, label: 'Zelle' },
    transferencia: { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',                  icon: <Landmark className="w-3 h-3" />, label: 'Transf.' },
    stripe:        { cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',      icon: <CreditCard className="w-3 h-3" />, label: 'Tarjeta' },
    credito:       { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',          icon: <FileText className="w-3 h-3" />, label: 'Crédito' },
    cheque:        { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',          icon: <FileCheck className="w-3 h-3" />, label: 'Cheque' },
    efectivo:      { cls: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',              icon: <Banknote className="w-3 h-3" />, label: 'Efectivo' },
  }
  const m = map[tipo as Exclude<TipoPago, 'pendiente'>]
  if (!m) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${m.cls}`}>
      {m.icon}
      {m.label}
      {confirmado && <BadgeCheck className="w-3 h-3" />}
    </span>
  )
}

function EstadoPagoBadge({ estadoPago }: { estadoPago: EstadoPago | null }) {
  if (!estadoPago) return null
  const map: Record<EstadoPago, { cls: string; icon: React.ReactNode; label: string }> = {
    verificado: {
      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      icon: <BadgeCheck className="w-3 h-3" />,
      label: 'Pago verificado',
    },
    pendiente_verificacion: {
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      icon: <AlertTriangle className="w-3 h-3" />,
      label: 'Pago por verificar',
    },
    rechazado: {
      cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
      icon: <XCircle className="w-3 h-3" />,
      label: 'Pago rechazado',
    },
  }
  const m = map[estadoPago]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  )
}

function EstadoBadge({ estado }: { estado: Orden['estado'] }) {
  const map = {
    pendiente: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: <Clock className="w-3 h-3" />, label: 'Pendiente' },
    aprobada:  { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Aprobada' },
    rechazada: { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', icon: <XCircle className="w-3 h-3" />, label: 'Rechazada' },
    cancelada: { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300', icon: <XCircle className="w-3 h-3" />, label: 'Cancelada' },
  }[estado]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${map.cls}`}>
      {map.icon}
      {map.label}
    </span>
  )
}
