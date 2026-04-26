'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import {
  ClipboardList, ChevronLeft, ChevronDown, ChevronUp,
  ShoppingBag, Clock, CheckCircle2, Truck, XCircle,
  FileText, Package, RotateCcw, Receipt, User,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────
interface PedidoItem {
  id: string; cantidad: number; precio_unitario: number; subtotal: number
  presentacion_id: string
  presentaciones?: {
    nombre: string; precio: number; stock: number; imagen_url?: string
    productos?: { nombre: string; imagen_url?: string }
  }
}
interface Pedido {
  id: string; numero: string; estado: string; fecha_pedido: string
  total: number; notas?: string; pedido_items?: PedidoItem[]
}
interface OrdenItem {
  id: string; cantidad: number; precio_unitario: number; subtotal: number
  presentaciones?: { nombre: string; productos?: { nombre: string } }
}
interface Orden {
  id: string; numero: string
  transaccion_id?: string | null
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'
  total: number; notas?: string | null; motivo_rechazo?: string | null
  created_at: string
  orden_items?: OrdenItem[]
  pedido?: {
    id: string; numero: string; estado: string
    estado_despacho?: 'por_despachar' | 'despachado' | 'entregado' | null
  } | null
}
interface Factura {
  id: string; numero: string
  // Acepta los estados nuevos (Fase 3) sin romper si la migration vieja
  // dejó algunos rows como 'emitida'.
  estado: string
  total: number; monto_pagado: number
  fecha_emision: string; fecha_vencimiento: string | null
  pedido_id: string | null
}
interface Props {
  pedidos: Pedido[]
  ordenes: Orden[]
  facturas: Factura[]
  clienteId: string | null
  userId: string
}

// ── Progress timeline ─────────────────────────────────────────────────────────
const STEPS = [
  { key: 'borrador',   label: 'Recibido' },
  { key: 'confirmado', label: 'Confirmado' },
  { key: 'preparando', label: 'Preparando' },
  { key: 'en_ruta',    label: 'En camino' },
  { key: 'entregado',  label: 'Entregado' },
]

function getStep(estado: string): number {
  if (estado === 'pagado' || estado === 'facturado') return 5
  if (estado === 'entregado') return 4
  if (estado === 'en_ruta')   return 3
  if (estado === 'preparando') return 2
  if (estado === 'confirmado') return 1
  return 0
}

function Timeline({ estado }: { estado: string }) {
  const cancelled = estado === 'cancelado'
  const fullDone  = estado === 'pagado' || estado === 'facturado'
  const stepIdx   = getStep(estado)

  if (cancelled) {
    return (
      <div className="flex items-center gap-2 py-2">
        <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
        <span className="text-[11px] uppercase tracking-luxe text-rose-500">Pedido cancelado</span>
      </div>
    )
  }

  if (fullDone) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1 h-[2px] bg-emerald-500/70 rounded-full" />
        <span className="text-[10px] uppercase tracking-luxe text-emerald-700 whitespace-nowrap">
          {estado === 'pagado' ? '✓ Pagado' : '✓ Facturado'}
        </span>
      </div>
    )
  }

  return (
    <div className="pt-2 pb-4">
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done   = stepIdx >= i
          const active = stepIdx === i
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <motion.div
                  animate={active ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
                    done ? 'bg-brand-navy' : 'bg-stone-300'
                  } ${active ? 'ring-2 ring-offset-2 ring-brand-gold/60 ring-offset-white' : ''}`}
                />
                <span className={`text-[9px] mt-2 uppercase tracking-wide whitespace-nowrap ${
                  done ? 'text-brand-navy' : 'text-brand-charcoal/40'
                }`}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-[1px] mx-1.5 bg-stone-300 overflow-hidden mb-5 relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: stepIdx > i ? '100%' : '0%' }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className="h-full bg-brand-navy"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Pedido Card ───────────────────────────────────────────────────────────────
function PedidoCard({ pedido, onReorder }: { pedido: Pedido; onReorder: (items: PedidoItem[]) => void }) {
  const [open, setOpen] = useState(false)

  const statusTone: Record<string, string> = {
    borrador:   'text-brand-charcoal bg-stone-100',
    confirmado: 'text-sky-700 bg-sky-50',
    preparando: 'text-amber-700 bg-amber-50',
    en_ruta:    'text-orange-700 bg-orange-50',
    entregado:  'text-emerald-700 bg-emerald-50',
    facturado:  'text-violet-700 bg-violet-50',
    pagado:     'text-emerald-800 bg-emerald-100',
    cancelado:  'text-rose-600 bg-rose-50',
  }
  const statusLabel: Record<string, string> = {
    borrador: 'Recibido', confirmado: 'Confirmado', preparando: 'Preparando',
    en_ruta: 'En camino', entregado: 'Entregado', facturado: 'Facturado',
    pagado: 'Pagado', cancelado: 'Cancelado',
  }
  const statusIcon: Record<string, React.ReactNode> = {
    borrador:   <Clock className="w-3.5 h-3.5" />,
    confirmado: <CheckCircle2 className="w-3.5 h-3.5" />,
    preparando: <Package className="w-3.5 h-3.5" />,
    en_ruta:    <Truck className="w-3.5 h-3.5" />,
    entregado:  <CheckCircle2 className="w-3.5 h-3.5" />,
    facturado:  <FileText className="w-3.5 h-3.5" />,
    pagado:     <CheckCircle2 className="w-3.5 h-3.5" />,
    cancelado:  <XCircle className="w-3.5 h-3.5" />,
  }
  const tone = statusTone[pedido.estado] ?? statusTone.borrador
  const icon = statusIcon[pedido.estado] ?? <Clock className="w-3.5 h-3.5" />

  return (
    <motion.div layout className="bg-white rounded-[22px] border border-stone-200/70 overflow-hidden hover:shadow-[0_20px_45px_-20px_rgba(15,23,42,0.15)] transition-shadow">
      <button onClick={() => setOpen(v => !v)} className="w-full px-7 pt-6 pb-3 text-left">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-luxe text-brand-gold mb-1">
              {new Date(pedido.fecha_pedido).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            <h3 className="font-serif text-2xl text-brand-navy leading-tight">{pedido.numero}</h3>
          </div>
          <div className="text-right flex flex-col items-end gap-1.5">
            <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-luxe px-3 py-1.5 rounded-full ${tone}`}>
              {icon} {statusLabel[pedido.estado] ?? pedido.estado}
            </span>
            <p className="font-serif text-xl text-brand-navy tabular-nums">
              {formatCurrency(pedido.total)}
            </p>
          </div>
        </div>
      </button>

      <div className="px-7">
        <Timeline estado={pedido.estado} />
      </div>

      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-center gap-1.5 py-3 text-[10px] uppercase tracking-luxe text-brand-charcoal hover:text-brand-navy transition border-t border-stone-100"
      >
        {open ? <>Ocultar detalle <ChevronUp className="w-3 h-3" /></> : <>Ver detalle <ChevronDown className="w-3 h-3" /></>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-brand-stone/40"
          >
            <div className="px-7 py-5 space-y-4">
              {pedido.pedido_items && pedido.pedido_items.length > 0 ? (
                <ul className="space-y-3">
                  {pedido.pedido_items.map(item => (
                    <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-[15px] text-brand-navy leading-tight">
                          {item.presentaciones?.productos?.nombre ?? 'Producto'}
                        </p>
                        <p className="text-[11px] uppercase tracking-wide text-brand-charcoal/60 mt-0.5">
                          {item.presentaciones?.nombre} · ×{item.cantidad}
                        </p>
                      </div>
                      <span className="font-serif text-brand-navy tabular-nums shrink-0">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-brand-charcoal/50 text-center py-2 italic">Sin detalle de items</p>
              )}

              {pedido.notas && (
                <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-luxe text-amber-700 mb-1">Notas</p>
                  <p className="text-sm text-amber-900">{pedido.notas}</p>
                </div>
              )}

              {(pedido.estado === 'entregado' || pedido.estado === 'facturado') &&
               pedido.pedido_items && pedido.pedido_items.length > 0 && (
                <button
                  onClick={() => onReorder(pedido.pedido_items!)}
                  className="w-full flex items-center justify-center gap-2 text-[11px] uppercase tracking-luxe text-brand-navy border border-brand-navy/30 hover:border-brand-navy hover:bg-brand-navy hover:text-brand-cream py-3 rounded-full transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Volver a pedir
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Orden Timeline ────────────────────────────────────────────────────────────
// Timeline 5 pasos extremo a extremo (Fase 5 — modelo nuevo):
//
//   Solicitud → Aprobada → En preparación → En camino → Entregado
//
// Avance derivado de:
//   • orden.estado          — pendiente / aprobada / rechazada / cancelada
//   • pedido.estado_despacho — por_despachar / despachado / entregado
//   • factura.estado        — pendiente_pago / pendiente_verificacion /
//                              pagada (Fase 3)
//
// Si la transacción se cancela o rechaza, la timeline muestra el corte
// en rojo en el paso al que llegó (no en step 0 si ya había avanzado).
const ORDEN_STEPS = [
  { key: 'solicitud',     label: 'Solicitud' },
  { key: 'aprobada',      label: 'Aprobada' },
  { key: 'en_preparacion', label: 'En preparación' },
  { key: 'en_camino',     label: 'En camino' },
  { key: 'entregado',     label: 'Entregado' },
]

/**
 * Devuelve el step alcanzado (0..4). Funciona aunque la orden esté
 * rechazada / cancelada — se usa para saber DÓNDE pintar el corte rojo.
 *
 * `factura` viene del lookup en `facturas` por `pedido_id` que hace el
 * componente padre — se pasa como argumento para no obligar al embed
 * nested en el query (que rompía el page).
 */
function getOrdenStep(orden: Orden, factura: Factura | null | undefined): number {
  // Sin avance: orden recién creada (puede estar pendiente, rechazada, etc).
  if (orden.estado !== 'aprobada' && orden.estado !== 'cancelada') return 0

  const pedido = (orden.pedido && (Array.isArray(orden.pedido) ? orden.pedido[0] : orden.pedido)) ?? null
  if (!pedido) return orden.estado === 'aprobada' ? 1 : 0

  const ed = pedido.estado_despacho
  if (ed === 'entregado') return 4
  if (ed === 'despachado') return 3

  // ed === 'por_despachar' (o null/undefined en datos legacy):
  // Diferencia entre step 1 (Aprobada) y step 2 (En preparación) es si
  // la factura ya está pagada.
  if (factura?.estado === 'pagada') return 2
  return 1
}

function OrdenTimeline({ orden, factura }: { orden: Orden; factura: Factura | null | undefined }) {
  const cancelada = orden.estado === 'rechazada' || orden.estado === 'cancelada'
  const stepIdx = getOrdenStep(orden, factura)

  return (
    <div className="pt-2 pb-4">
      <div className="flex items-center gap-0">
        {ORDEN_STEPS.map((step, i) => {
          const done = stepIdx >= i
          const active = !cancelada && stepIdx === i
          // El corte rojo cae en el último paso alcanzado cuando la
          // transacción se cortó.
          const isCutPoint = cancelada && stepIdx === i
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                {isCutPoint ? (
                  <XCircle className="w-3.5 h-3.5 text-rose-500" strokeWidth={2.5} />
                ) : (
                  <motion.div
                    animate={active ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                    className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
                      done ? 'bg-brand-navy' : 'bg-stone-300'
                    } ${active ? 'ring-2 ring-offset-2 ring-brand-gold/60 ring-offset-white' : ''}`}
                  />
                )}
                <span className={`text-[9px] mt-2 uppercase tracking-wide whitespace-nowrap ${
                  isCutPoint ? 'text-rose-500 font-semibold'
                    : done ? 'text-brand-navy'
                    : 'text-brand-charcoal/40'
                }`}>
                  {step.label}
                </span>
              </div>
              {i < ORDEN_STEPS.length - 1 && (
                <div className="flex-1 h-[1px] mx-1.5 bg-stone-300 overflow-hidden mb-5 relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: stepIdx > i ? '100%' : '0%' }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className={`h-full ${cancelada && stepIdx > i ? 'bg-rose-300' : 'bg-brand-navy'}`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {cancelada && (
        <p className="text-[10px] uppercase tracking-luxe text-rose-500 text-center mt-2">
          {orden.estado === 'rechazada' ? 'Solicitud rechazada' : 'Solicitud cancelada'}
        </p>
      )}
    </div>
  )
}

// ── Orden Card ────────────────────────────────────────────────────────────────
function OrdenCard({ orden, factura }: { orden: Orden; factura: Factura | null | undefined }) {
  const mapByEstado: Record<string, { label: string; cls: string }> = {
    pendiente: { label: 'Pendiente de aprobación', cls: 'bg-amber-50 text-amber-800 border-amber-200/60' },
    aprobada:  { label: 'Aprobada',                cls: 'bg-emerald-50 text-emerald-800 border-emerald-200/60' },
    rechazada: { label: 'Rechazada',               cls: 'bg-rose-50 text-rose-700 border-rose-200/60' },
    cancelada: { label: 'Cancelada',               cls: 'bg-stone-100 text-brand-charcoal border-stone-200/60' },
  }
  // Fallback defensivo si en el futuro se agrega un estado al CHECK sin
  // actualizar este componente.
  const map = mapByEstado[orden.estado] ?? {
    label: orden.estado,
    cls: 'bg-stone-100 text-brand-charcoal border-stone-200/60',
  }

  return (
    <motion.div
      layout
      className={`rounded-[22px] border ${map.cls}`}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-luxe opacity-70 mb-1">
              {new Date(orden.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })} · {map.label}
            </p>
            <h3 className="font-serif text-xl leading-tight">
              {orden.transaccion_id ?? orden.numero}
            </h3>
            {orden.orden_items && (
              <p className="text-[11px] uppercase tracking-wide opacity-60 mt-1">
                {orden.orden_items.length} producto{orden.orden_items.length === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <p className="font-serif text-xl tabular-nums">{formatCurrency(Number(orden.total))}</p>
        </div>

        {orden.estado === 'rechazada' && orden.motivo_rechazo && (
          <div className="mt-4 text-sm bg-white/60 rounded-xl px-4 py-3 border border-white/80">
            <p className="text-[10px] uppercase tracking-luxe opacity-70 mb-1">Motivo</p>
            <p className="opacity-90">{orden.motivo_rechazo}</p>
          </div>
        )}

      </div>

      <div className="px-6 pb-2">
        <OrdenTimeline orden={orden} factura={factura} />
      </div>
    </motion.div>
  )
}

// ── Factura Card ──────────────────────────────────────────────────────────────
function FacturaCard({ factura }: { factura: Factura }) {
  // Mapa con los 6 estados que admite el CHECK de facturas (Fase 3) +
  // fallback genérico para cualquier valor futuro que se agregue al CHECK
  // sin actualizar este componente — evita el crash 'cannot read .cls of
  // undefined' que tuvimos en el dashboard.
  const map: Record<string, { cls: string; label: string }> = {
    pagada:                 { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200/60', label: 'Pagada' },
    pendiente_pago:         { cls: 'bg-amber-50 text-amber-800 border-amber-200/60',       label: 'Pendiente de pago' },
    pendiente_verificacion: { cls: 'bg-amber-50 text-amber-800 border-amber-200/60',       label: 'Pendiente de verificación' },
    emitida:                { cls: 'bg-sky-50 text-sky-800 border-sky-200/60',             label: 'Emitida' },
    anulada:                { cls: 'bg-rose-50 text-rose-700 border-rose-200/60',           label: 'Anulada' },
    con_nota_credito:       { cls: 'bg-amber-50 text-amber-800 border-amber-200/60',        label: 'Con nota crédito' },
  }
  const m = map[factura.estado] ?? {
    cls: 'bg-stone-100 text-brand-charcoal border-stone-200/60',
    label: factura.estado,
  }
  const saldo = Number(factura.total) - Number(factura.monto_pagado ?? 0)
  return (
    <motion.div layout className={`rounded-[22px] border p-6 ${m.cls}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-luxe opacity-70 mb-1">
            {new Date(factura.fecha_emision).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })} · {m.label}
          </p>
          <h3 className="font-serif text-xl leading-tight">{factura.numero}</h3>
          {factura.estado !== 'pagada' && saldo > 0 && (
            <p className="text-[11px] uppercase tracking-wide opacity-70 mt-1">
              Saldo pendiente · <span className="font-semibold">{formatCurrency(saldo)}</span>
            </p>
          )}
        </div>
        <p className="font-serif text-xl tabular-nums">{formatCurrency(Number(factura.total))}</p>
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MisPedidosClient({
  pedidos: initialPedidos, ordenes: initialOrdenes, facturas: initialFacturas, clienteId, userId,
}: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>(initialPedidos)
  const [ordenes, setOrdenes] = useState<Orden[]>(initialOrdenes)
  const [facturas, setFacturas] = useState<Factura[]>(initialFacturas)
  const router = useRouter()
  const supabase = createClient()

  // Realtime: pedidos
  useEffect(() => {
    if (!clienteId) return
    const channel = supabase
      .channel(`pedidos-cliente-${clienteId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `cliente_id=eq.${clienteId}` },
        (payload) => {
          setPedidos(prev =>
            prev.map(p =>
              p.id === payload.new.id ? { ...p, estado: payload.new.estado as string } : p
            )
          )
          toast.info(`Pedido ${payload.new.numero} actualizado: ${payload.new.estado}`)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [clienteId])

  // Realtime: ordenes
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`ordenes-user-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ordenes', filter: `user_id=eq.${userId}` },
        (payload) => {
          const nueva = payload.new as any
          setOrdenes(prev =>
            prev.map(o =>
              o.id === nueva.id
                ? { ...o, estado: nueva.estado, motivo_rechazo: nueva.motivo_rechazo }
                : o
            )
          )
          if (nueva.estado === 'aprobada') {
            toast.success(`Orden ${nueva.numero} aprobada`)
            router.refresh()
          } else if (nueva.estado === 'rechazada') {
            toast.error(`Orden ${nueva.numero} rechazada`)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, router, supabase])

  // Realtime: facturas
  useEffect(() => {
    if (!clienteId) return
    const channel = supabase
      .channel(`facturas-cliente-${clienteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'facturas', filter: `cliente_id=eq.${clienteId}` },
        (payload) => {
          const nueva = payload.new as any
          if (payload.eventType === 'INSERT') {
            setFacturas(prev => [nueva as Factura, ...prev])
            toast.success(`Factura ${nueva.numero} emitida`)
          } else if (payload.eventType === 'UPDATE') {
            setFacturas(prev =>
              prev.map(f => (f.id === nueva.id ? { ...f, ...nueva } : f))
            )
            if (nueva.estado === 'pagada') {
              toast.success(`Factura ${nueva.numero} pagada`)
            }
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as any
            setFacturas(prev => prev.filter(f => f.id !== old.id))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [clienteId, supabase])

  // Pedidos que ya están cubiertos por una OrdenCard (vienen como derivado
  // de una orden). No los duplicamos en la sección "Pedidos activos" — ya
  // aparecen dentro de la timeline integrada de su orden.
  // Defensive: orden.pedido puede venir como object O array según cómo
  // PostgREST resuelva el embed. Aceptamos los dos.
  const pedidoOf = (o: Orden) => (Array.isArray(o.pedido) ? o.pedido[0] : o.pedido) ?? null
  const ordenPedidoIds = new Set(
    ordenes.map(o => pedidoOf(o)?.id).filter(Boolean) as string[]
  )
  const pedidosSinOrden = pedidos.filter(p => !ordenPedidoIds.has(p.id))

  // Lookup de factura por pedido_id — la timeline lo usa para distinguir
  // "Aprobada" (factura pendiente_pago) vs "En preparación" (factura pagada).
  const facturaByPedidoId = new Map<string, Factura>()
  for (const f of facturas) {
    if (f.pedido_id) facturaByPedidoId.set(f.pedido_id, f)
  }
  const facturaForOrden = (o: Orden): Factura | null => {
    const pid = pedidoOf(o)?.id
    return pid ? (facturaByPedidoId.get(pid) ?? null) : null
  }

  const handleReorder = (items: PedidoItem[]) => {
    const reorderItems = items.map(item => ({
      presentacionId: item.presentacion_id,
      productoNombre: item.presentaciones?.productos?.nombre ?? 'Producto',
      presentacionNombre: item.presentaciones?.nombre ?? '',
      precio: item.precio_unitario,
      cantidad: item.cantidad,
      stock: item.presentaciones?.stock ?? 99,
    }))
    localStorage.setItem('emporium_reorder', JSON.stringify(reorderItems))
    router.push('/tienda')
    toast.success('Productos añadidos al carrito')
  }

  return (
    <div className="min-h-screen bg-brand-cream text-brand-navy">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-brand-cream/85 backdrop-blur-md border-b border-stone-200/70">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-5 flex items-center gap-4">
          <Link href="/tienda" className="p-2 rounded-full hover:bg-stone-100 transition" aria-label="Volver">
            <ChevronLeft className="w-5 h-5 text-brand-navy" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-luxe text-brand-gold">Tu historial</p>
            <h1 className="font-serif text-2xl text-brand-navy leading-tight">Mis pedidos</h1>
          </div>
          {clienteId && (
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-luxe text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              En vivo
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 lg:px-10 py-10 space-y-12 pb-28">
        {/* Empty state */}
        {pedidosSinOrden.length === 0 && ordenes.length === 0 && facturas.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-brand-stone flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-7 h-7 text-brand-charcoal/40" />
            </div>
            <p className="font-serif text-2xl text-brand-navy mb-2">Aún no tienes pedidos</p>
            <p className="text-sm text-brand-charcoal/70 mb-6">
              Explora el catálogo y haz tu primera compra para verla aparecer aquí.
            </p>
            <Link
              href="/tienda"
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-luxe text-brand-navy border-b border-brand-navy/30 hover:border-brand-navy pb-0.5 transition"
            >
              Ir al catálogo →
            </Link>
          </motion.div>
        )}

        {/* Solicitudes (ordenes) */}
        {ordenes.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-luxe text-brand-gold mb-1">En revisión</p>
                <h2 className="font-serif text-3xl text-brand-navy">Mis solicitudes</h2>
              </div>
              <p className="text-[11px] uppercase tracking-luxe text-brand-charcoal/60">
                {ordenes.filter(o => o.estado === 'pendiente').length} pendiente{ordenes.filter(o => o.estado === 'pendiente').length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="space-y-4">
              {ordenes.map((o, i) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <OrdenCard orden={o} factura={facturaForOrden(o)} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Pedidos sin orden parent — venta directa de mostrador. Pedidos
            que vienen de una orden ya se muestran dentro de la timeline
            integrada de su OrdenCard arriba. */}
        {pedidosSinOrden.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-luxe text-brand-gold mb-1">En curso</p>
                <h2 className="font-serif text-3xl text-brand-navy">Pedidos activos</h2>
              </div>
              <p className="text-[11px] uppercase tracking-luxe text-brand-charcoal/60">
                {pedidosSinOrden.length} total
              </p>
            </div>
            <div className="space-y-4">
              {pedidosSinOrden.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <PedidoCard pedido={p} onReorder={handleReorder} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Facturas */}
        {facturas.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-luxe text-brand-gold mb-1">Documentos</p>
                <h2 className="font-serif text-3xl text-brand-navy">Mis facturas</h2>
              </div>
              <p className="text-[11px] uppercase tracking-luxe text-brand-charcoal/60">
                {facturas.filter(f => f.estado === 'pagada').length} pagada{facturas.filter(f => f.estado === 'pagada').length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="space-y-4">
              {facturas.map((f, i) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <FacturaCard factura={f} />
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-brand-cream/95 backdrop-blur-md border-t border-stone-200/80 flex items-center justify-around px-4 py-3 md:hidden">
        <Link href="/tienda" className="flex flex-col items-center gap-1 py-1 text-brand-charcoal hover:text-brand-navy transition">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-luxe">Tienda</span>
        </Link>
        <Link href="/tienda/mis-pedidos" className="flex flex-col items-center gap-1 py-1 text-brand-navy">
          <ClipboardList className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-luxe">Pedidos</span>
        </Link>
        <Link href="/tienda/perfil" className="flex flex-col items-center gap-1 py-1 text-brand-charcoal hover:text-brand-navy transition">
          <User className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-luxe">Cuenta</span>
        </Link>
      </nav>
    </div>
  )
}
