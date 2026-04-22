'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import {
  ClipboardList, ChevronLeft, ChevronDown, ChevronUp,
  ShoppingBag, Clock, CheckCircle2, Truck, XCircle, FileText, Package,
} from 'lucide-react'
import Link from 'next/link'

interface PedidoItem {
  id: string; cantidad: number; precio_unitario: number; subtotal: number
  presentaciones?: { nombre: string; productos?: { nombre: string } }
}
interface Pedido {
  id: string; numero: number; estado: string; fecha_pedido: string
  total: number; notas?: string; pedido_items?: PedidoItem[]
}

const ESTADOS: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  borrador:   { label: 'Borrador',   color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700',               icon: <Clock className="w-3.5 h-3.5" /> },
  confirmado: { label: 'Confirmado', color: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-900/30',               icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  en_ruta:    { label: 'En ruta',    color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30',             icon: <Truck className="w-3.5 h-3.5" /> },
  entregado:  { label: 'Entregado',  color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30',       icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  cancelado:  { label: 'Cancelado',  color: 'text-red-500',   bg: 'bg-red-50 dark:bg-red-900/30',                icon: <XCircle className="w-3.5 h-3.5" /> },
  facturado:  { label: 'Facturado',  color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/30',         icon: <FileText className="w-3.5 h-3.5" /> },
}

function PedidoCard({ pedido }: { pedido: Pedido }) {
  const [open, setOpen] = useState(false)
  const est = ESTADOS[pedido.estado] ?? ESTADOS.borrador

  return (
    <motion.div
      layout
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden"
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${est.bg} ${est.color}`}>
            {est.icon}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 dark:text-white text-sm">Pedido #{pedido.numero}</p>
            <p className="text-xs text-slate-400">{new Date(pedido.fecha_pedido).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${est.bg} ${est.color}`}>
              {est.icon} {est.label}
            </span>
            <p className="text-sm font-black text-slate-800 dark:text-white mt-1 tabular-nums">{formatCurrency(pedido.total)}</p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

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
              {pedido.notas && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Notas</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{pedido.notas}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function MisPedidosClient({ pedidos }: { pedidos: Pedido[] }) {
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
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3 pb-20">
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
              <PedidoCard pedido={p} />
            </motion.div>
          ))
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-4 py-2 lg:hidden">
        <Link href="/tienda" className="flex flex-col items-center gap-0.5 py-1 text-slate-400 hover:text-slate-600 transition">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-xs font-medium">Tienda</span>
        </Link>
        <Link href="/tienda/mis-pedidos" className="flex flex-col items-center gap-0.5 py-1 text-teal-600">
          <ClipboardList className="w-5 h-5" />
          <span className="text-xs font-medium">Pedidos</span>
        </Link>
        <Link href="/tienda/perfil" className="flex flex-col items-center gap-0.5 py-1 text-slate-400 hover:text-slate-600 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span className="text-xs font-medium">Perfil</span>
        </Link>
      </nav>
    </div>
  )
}
