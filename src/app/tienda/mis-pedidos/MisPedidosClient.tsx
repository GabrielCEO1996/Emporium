'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import {
  ClipboardList, ChevronLeft, ChevronDown, ChevronUp,
  ShoppingBag, Clock, CheckCircle2, Truck, XCircle,
  FileText, Package, RotateCcw,
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
interface Props {
  pedidos: Pedido[]
  clienteId: string | null
}

// ── Progress steps (5-step) ───────────────────────────────────────────────────
const STEPS = [
  { key: 'borrador',   label: 'Recibido',   color: 'bg-slate-400',   ring: 'ring-slate-300' },
  { key: 'confirmado', label: 'Confirmado', color: 'bg-blue-500',    ring: 'ring-blue-300' },
  { key: 'preparando', label: 'Preparando', color: 'bg-amber-500',   ring: 'ring-amber-300' },
  { key: 'en_ruta',   label: 'En camino',  color: 'bg-orange-500',  ring: 'ring-orange-300' },
  { key: 'entregado',  label: 'Entregado',  color: 'bg-emerald-500', ring: 'ring-emerald-300' },
]

function getStep(estado: string): number {
  // Terminal states
  if (estado === 'pagado' || estado === 'facturado') return 5    // beyond step 4 = green complete
  if (estado === 'entregado') return 4
  if (estado === 'en_ruta')   return 3
  if (estado === 'preparando') return 2
  if (estado === 'confirmado') return 1
  return 0  // borrador
}

function ProgressBar({ estado }: { estado: string }) {
  const cancelled  = estado === 'cancelado'
  const fullDone   = estado === 'pagado' || estado === 'facturado'
  const stepIdx    = getStep(estado)

  if (cancelled) {
    return (
      <div className="flex items-center gap-2 py-1">
        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-red-500">Pedido cancelado</span>
      </div>
    )
  }

  if (fullDone) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="flex-1 h-2 rounded-full bg-emerald-500 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.6 }}
            className="h-full bg-emerald-400 rounded-full"
          />
        </div>
        <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">
          {estado === 'pagado' ? '✅ Pagado' : '✅ Facturado'}
        </span>
      </div>
    )
  }

  return (
    <div className="pt-1 pb-3">
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done   = stepIdx >= i
          const active = stepIdx === i
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Dot */}
              <div className="flex flex-col items-center">
                <motion.div
                  animate={active ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500 ${
                    done
                      ? `${step.color} text-white shadow-sm`
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                  } ${active ? `ring-2 ring-offset-1 ${step.ring}` : ''}`}
                >
                  {done ? '✓' : i + 1}
                </motion.div>
                <span className={`text-[9px] mt-1 font-semibold whitespace-nowrap leading-tight ${
                  done ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-1 mx-0.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: stepIdx > i ? '100%' : '0%' }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="h-full bg-teal-500 rounded-full"
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

// ── Single Pedido card ────────────────────────────────────────────────────────
function PedidoCard({ pedido, onReorder }: { pedido: Pedido; onReorder: (items: PedidoItem[]) => void }) {
  const [open, setOpen] = useState(false)

  const statusColor: Record<string, string> = {
    borrador:   'text-slate-500 bg-slate-100 dark:bg-slate-700',
    confirmado: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
    preparando: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30',
    en_ruta:    'text-orange-600 bg-orange-50 dark:bg-orange-900/30',
    entregado:  'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30',
    facturado:  'text-violet-600 bg-violet-50 dark:bg-violet-900/30',
    pagado:     'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40',
    cancelado:  'text-red-500 bg-red-50 dark:bg-red-900/30',
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
  const statusLabel: Record<string, string> = {
    borrador: 'Recibido', confirmado: 'Confirmado', preparando: 'Preparando',
    en_ruta: 'En camino', entregado: 'Entregado', facturado: 'Facturado',
    pagado: 'Pagado ✅', cancelado: 'Cancelado',
  }

  const sc = statusColor[pedido.estado] ?? statusColor.borrador
  const icon = statusIcon[pedido.estado] ?? <Clock className="w-3.5 h-3.5" />

  return (
    <motion.div layout className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header row */}
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sc}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 dark:text-white text-sm">{pedido.numero}</p>
            <p className="text-xs text-slate-400">
              {new Date(pedido.fecha_pedido).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${sc}`}>
              {icon} {statusLabel[pedido.estado] ?? pedido.estado}
            </span>
            <p className="text-sm font-black text-slate-800 dark:text-white mt-1 tabular-nums">
              {formatCurrency(pedido.total)}
            </p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Progress bar always visible */}
      <div className="px-5 pb-1">
        <ProgressBar estado={pedido.estado} />
      </div>

      {/* Expandable detail */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4 space-y-3">
              {/* Items */}
              {pedido.pedido_items && pedido.pedido_items.length > 0 ? (
                <ul className="space-y-2">
                  {pedido.pedido_items.map(item => (
                    <li key={item.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center flex-shrink-0">
                          <Package className="w-3 h-3 text-teal-600" />
                        </div>
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {item.presentaciones?.productos?.nombre ?? 'Producto'}
                          </span>
                          <span className="text-slate-400 ml-1 text-xs">
                            {item.presentaciones?.nombre} ×{item.cantidad}
                          </span>
                        </div>
                      </div>
                      <span className="font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 text-center py-2">Sin detalle de items</p>
              )}

              {/* Notes */}
              {pedido.notas && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Notas</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{pedido.notas}</p>
                </div>
              )}

              {/* Reorder button (only for delivered/invoiced) */}
              {(pedido.estado === 'entregado' || pedido.estado === 'facturado') &&
               pedido.pedido_items && pedido.pedido_items.length > 0 && (
                <button
                  onClick={() => onReorder(pedido.pedido_items!)}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-teal-600 border border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-900/20 py-2.5 rounded-xl transition"
                >
                  <RotateCcw className="w-4 h-4" />
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

// ── Main component ────────────────────────────────────────────────────────────
export default function MisPedidosClient({ pedidos: initialPedidos, clienteId }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>(initialPedidos)
  const router = useRouter()
  const supabase = createClient()

  // ── Supabase Realtime subscription ────────────────────────────────────────
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
              p.id === payload.new.id
                ? { ...p, estado: payload.new.estado as string }
                : p
            )
          )
          toast.info(`Pedido ${payload.new.numero} actualizado: ${payload.new.estado}`)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clienteId])

  // ── Reorder handler ────────────────────────────────────────────────────────
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
    toast.success('Productos agregados al carrito')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3">
        <Link href="/tienda" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </Link>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-teal-600" />
          <h1 className="font-bold text-slate-800 dark:text-white">Mis Pedidos</h1>
        </div>
        {clienteId && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            En vivo
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-24">
        {pedidos.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
            <ShoppingBag className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
            <p className="font-semibold text-slate-500 dark:text-slate-400">Sin pedidos aún</p>
            <p className="text-sm text-slate-400 mt-1">Haz tu primer pedido en la tienda</p>
            <Link href="/tienda" className="inline-block mt-4 text-sm text-teal-600 font-semibold hover:underline">
              Ir a la tienda →
            </Link>
          </motion.div>
        ) : (
          pedidos.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <PedidoCard pedido={p} onReorder={handleReorder} />
            </motion.div>
          ))
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-4 py-2 lg:hidden">
        <Link href="/tienda" className="flex flex-col items-center gap-0.5 py-1 text-slate-400 hover:text-slate-600 transition">
          <ShoppingBag className="w-5 h-5" /><span className="text-xs font-medium">Tienda</span>
        </Link>
        <Link href="/tienda/mis-pedidos" className="flex flex-col items-center gap-0.5 py-1 text-teal-600">
          <ClipboardList className="w-5 h-5" /><span className="text-xs font-medium">Pedidos</span>
        </Link>
        <Link href="/tienda/perfil" className="flex flex-col items-center gap-0.5 py-1 text-slate-400 hover:text-slate-600 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span className="text-xs font-medium">Perfil</span>
        </Link>
      </nav>
    </div>
  )
}
