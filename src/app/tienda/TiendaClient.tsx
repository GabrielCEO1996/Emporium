'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ShoppingCart, Search, X, Plus, Minus, Trash2, MessageCircle,
  Send, Package2, CheckCircle2, ClipboardList, User, LogOut,
  ChevronRight, Loader2, ShoppingBag, Sparkles, CreditCard, Star,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Presentacion {
  id: string; nombre: string; precio: number
  stock: number; stock_minimo: number; unidad: string
}
interface Producto {
  id: string; nombre: string; descripcion?: string
  categoria?: string; imagen_url?: string
  presentaciones: Presentacion[]
}
interface CartItem {
  presentacionId: string; productoNombre: string
  presentacionNombre: string; precio: number; cantidad: number
  imagenUrl?: string; stock: number
}
interface ChatMessage { role: 'user' | 'assistant'; content: string }
interface Props {
  profile: { id: string; nombre: string; email: string; rol: string }
  productos: Producto[]
  clienteInfo?: {
    id?: string; direccion?: string; telefono?: string; whatsapp?: string
    credito_autorizado?: boolean; limite_credito?: number; credito_usado?: number
  } | null
}

// ── Stock helpers ─────────────────────────────────────────────────────────────
function stockBadge(stock: number) {
  if (stock === 0) return { text: 'Agotado', cls: 'text-red-500 bg-red-50 dark:bg-red-900/20' }
  if (stock <= 3) return { text: `Últimas ${stock}`, cls: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' }
  return { text: `${stock} disponibles`, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' }
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({
  producto, onAdd,
}: {
  producto: Producto
  onAdd: (item: CartItem) => void
}) {
  const [selPres, setSelPres] = useState<Presentacion>(producto.presentaciones[0])
  const [qty, setQty] = useState(1)
  const [bounce, setBounce] = useState(false)

  const badge = stockBadge(selPres.stock)
  const agotado = selPres.stock === 0
  const initial = producto.nombre.charAt(0).toUpperCase()
  const gradients = [
    'from-teal-400 to-emerald-500',
    'from-violet-400 to-purple-500',
    'from-orange-400 to-amber-500',
    'from-sky-400 to-blue-500',
    'from-rose-400 to-pink-500',
  ]
  const grad = gradients[producto.nombre.charCodeAt(0) % gradients.length]

  const handleAdd = () => {
    if (agotado) return
    onAdd({
      presentacionId: selPres.id,
      productoNombre: producto.nombre,
      presentacionNombre: selPres.nombre,
      precio: selPres.precio,
      cantidad: qty,
      imagenUrl: producto.imagen_url,
      stock: selPres.stock,
    })
    setBounce(true)
    setTimeout(() => setBounce(false), 600)
    setQty(1)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col transition-all duration-200 ${agotado ? 'opacity-60 grayscale' : 'hover:shadow-md hover:-translate-y-0.5'}`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] flex-shrink-0">
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
            <span className="text-5xl font-black text-white/80">{initial}</span>
          </div>
        )}
        {agotado && (
          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
            <span className="bg-white text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full shadow">
              No disponible
            </span>
          </div>
        )}
        {producto.categoria && (
          <span className="absolute top-2 left-2 bg-white/90 dark:bg-slate-900/90 text-xs font-medium px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">
            {producto.categoria}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2.5 flex-1">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-white text-sm leading-tight line-clamp-2">
            {producto.nombre}
          </h3>
          <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
            {badge.text}
          </span>
        </div>

        {/* Presentations */}
        {producto.presentaciones.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {producto.presentaciones.map(pr => (
              <button
                key={pr.id}
                onClick={() => { setSelPres(pr); setQty(1) }}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${
                  selPres.id === pr.id
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-teal-400'
                }`}
              >
                {pr.nombre}
              </button>
            ))}
          </div>
        )}

        {/* Price */}
        <p className="text-xl font-black text-teal-600 dark:text-teal-400 leading-none">
          {formatCurrency(selPres.precio)}
        </p>

        {/* Qty + Add */}
        <div className="flex items-center gap-2 mt-auto">
          <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
            <button
              disabled={agotado || qty <= 1}
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-7 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
              {qty}
            </span>
            <button
              disabled={agotado || qty >= selPres.stock}
              onClick={() => setQty(q => Math.min(selPres.stock, q + 1))}
              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <motion.button
            animate={bounce ? { scale: [1, 1.2, 0.9, 1.05, 1] } : {}}
            transition={{ duration: 0.5 }}
            disabled={agotado}
            onClick={handleAdd}
            className="flex-1 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 text-white disabled:text-slate-400 text-xs font-bold py-2 rounded-xl transition-all active:scale-95"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Agregar
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Cart Panel ────────────────────────────────────────────────────────────────
function CartPanel({
  items, open, onClose, onUpdate, onRemove, onCheckout,
  creditoAutorizado, limiteCredito, creditoUsado,
}: {
  items: CartItem[]
  open: boolean
  onClose: () => void
  onUpdate: (id: string, delta: number) => void
  onRemove: (id: string) => void
  onCheckout: () => void
  creditoAutorizado?: boolean
  limiteCredito?: number
  creditoUsado?: number
}) {
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const creditoDisponible = (limiteCredito ?? 0) - (creditoUsado ?? 0)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-slate-900 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-teal-600" />
                <h2 className="font-bold text-slate-800 dark:text-white">Mi Carrito</h2>
                <span className="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {items.reduce((s, i) => s + i.cantidad, 0)}
                </span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto py-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                  <ShoppingCart className="w-12 h-12 text-slate-200 dark:text-slate-700" />
                  <p className="text-sm">El carrito está vacío</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                  {items.map(item => (
                    <li key={item.presentacionId} className="flex items-center gap-3 px-5 py-3.5">
                      {/* Thumb */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        {item.imagenUrl ? (
                          <img src={item.imagenUrl} alt={item.productoNombre} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl font-black text-slate-400">{item.productoNombre.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{item.productoNombre}</p>
                        <p className="text-xs text-slate-400">{item.presentacionNombre}</p>
                        <p className="text-sm font-bold text-teal-600 dark:text-teal-400 mt-0.5">{formatCurrency(item.precio * item.cantidad)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => onUpdate(item.presentacionId, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          <Minus className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-slate-700 dark:text-slate-200">{item.cantidad}</span>
                        <button
                          onClick={() => onUpdate(item.presentacionId, 1)}
                          disabled={item.cantidad >= item.stock}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition"
                        >
                          <Plus className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                        </button>
                        <button
                          onClick={() => onRemove(item.presentacionId)}
                          className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-800 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Total</span>
                  <span className="text-xl font-black text-slate-800 dark:text-white">{formatCurrency(total)}</span>
                </div>

                {/* Credit balance display (informational) */}
                {creditoAutorizado && (
                  <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                    <span className="font-medium">Crédito disponible</span>
                    <span className="font-bold">{formatCurrency(creditoDisponible)}</span>
                  </div>
                )}

                {/* Flow explainer */}
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-snug">
                  {creditoAutorizado
                    ? 'Tu orden será enviada al administrador para aprobación. Te notificaremos cuando esté lista.'
                    : 'Al continuar serás redirigido al pago seguro con tarjeta. Tu pedido se activa automáticamente tras el pago.'}
                </p>

                {/* Single CTA — branch on credit */}
                {creditoAutorizado ? (
                  <button
                    onClick={onCheckout}
                    className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar Orden
                  </button>
                ) : (
                  <button
                    onClick={onCheckout}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pagar con tarjeta 💳
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmModal({
  items, open, onClose, onConfirm, loading, notas, setNotas, direccion, setDireccion,
  creditoAutorizado,
}: {
  items: CartItem[]; open: boolean; onClose: () => void; onConfirm: () => void
  loading: boolean; notas: string; setNotas: (v: string) => void
  direccion: string; setDireccion: (v: string) => void
  creditoAutorizado: boolean
}) {
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  // isCredito drives the "credit / admin approval" styling;
  // when false the modal drives the Stripe payment flow.
  const isCredito = creditoAutorizado

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — bottom sheet en móvil, card centrado en desktop */}
      <div
        className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md flex flex-col shadow-2xl"
        style={{ maxHeight: '85vh' }}
      >
        {/* Drag handle visible solo en móvil */}
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />

        {/* ── HEADER FIJO ─────────────────────────────────────────────────── */}
        <div className={`shrink-0 flex items-center justify-between px-5 pt-6 pb-4 sm:pt-4 border-b border-slate-200 dark:border-slate-700 ${isCredito ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-violet-50 dark:bg-violet-900/10'}`}>
          <h2 className="font-bold text-slate-800 dark:text-white text-lg">
            {isCredito ? '📋 Confirmar Orden' : '💳 Pagar con Tarjeta'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── BREADCRUMB FIJO ──────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {isCredito
            ? <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Tu orden será revisada por el administrador antes de procesarse.</p>
            : <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">Al confirmar, serás redirigido al pago seguro con Stripe.</p>
          }
        </div>

        {/* ── CONTENIDO SCROLLEABLE ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Lista de productos */}
          <ul className="space-y-3">
            {items.map(item => (
              <li key={item.presentacionId} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">{item.productoNombre}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.presentacionNombre} × {item.cantidad}</p>
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums shrink-0">
                  {formatCurrency(item.precio * item.cantidad)}
                </span>
              </li>
            ))}
          </ul>

          {/* Total */}
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${isCredito ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-violet-50 dark:bg-violet-900/20'}`}>
            <div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {isCredito ? 'Total estimado' : 'Total a pagar'}
              </p>
              <p className={`text-xs mt-0.5 ${isCredito ? 'text-emerald-600' : 'text-violet-600'}`}>
                {isCredito ? 'Pendiente de aprobación' : 'Se cobra al confirmar pago'}
              </p>
            </div>
            <span className={`text-2xl font-black tabular-nums ${isCredito ? 'text-emerald-600' : 'text-violet-600'}`}>
              {formatCurrency(total)}
            </span>
          </div>

          {/* Campo dirección */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Dirección de entrega
            </label>
            <input
              value={direccion}
              onChange={e => setDireccion(e.target.value)}
              placeholder="Ej: Av. Principal, Casa 5…"
              className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
          </div>

          {/* Campo notas */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Notas (opcional)
            </label>
            <textarea
              rows={2}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Instrucciones especiales…"
              className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none transition"
            />
          </div>
        </div>

        {/* ── BOTONES FIJOS ABAJO — SIEMPRE VISIBLES ──────────────────────── */}
        <div className="shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg text-white flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
              isCredito
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500'
            }`}
          >
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Procesando…</>
              : isCredito
                ? <><CheckCircle2 className="w-5 h-5" /> Enviar Orden</>
                : <><CreditCard className="w-5 h-5" /> Pagar con Tarjeta</>
            }
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ numeroPedido, onContinue }: { numeroPedido: string; onContinue: () => void }) {
  const router = useRouter()
  useEffect(() => {
    const t = setTimeout(() => router.push('/tienda/mis-pedidos'), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col items-center justify-center gap-6 p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center"
      >
        <CheckCircle2 className="w-14 h-14 text-emerald-500" />
      </motion.div>
      <div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">¡Orden recibida!</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Tu orden <span className="font-bold text-teal-600">{numeroPedido}</span> fue recibida.<br />
          Te notificaremos cuando sea aprobada.
        </p>
        <p className="text-xs text-slate-400 mt-1">Redirigiendo a tus solicitudes en 4s…</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/tienda/mis-pedidos"
          className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 rounded-2xl transition"
        >
          <ClipboardList className="w-4 h-4" />
          Ver mis solicitudes
        </Link>
        <button
          onClick={onContinue}
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition py-2"
        >
          Seguir comprando →
        </button>
      </div>
    </motion.div>
  )
}

// ── Chat Panel ────────────────────────────────────────────────────────────────
function ChatPanel({
  open, onClose, productos,
}: {
  open: boolean; onClose: () => void; productos: Producto[]
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '¡Hola! 👋 Soy EmporiumBot, tu asistente de compras.\n\n' +
        'Cuéntame qué necesitas y yo te armo el carrito. Puedes decirme por ejemplo:\n' +
        '"Necesito 5 unidades de agua mineral" o "¿Qué productos tienen disponibles?"',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const res = await fetch('/api/tienda/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...messages, userMsg], productos }),
    })
    const data = await res.json()
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: data.reply ?? 'Lo siento, ocurrió un error. Intenta de nuevo.',
    }])
    setLoading(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 right-0 left-0 lg:left-auto lg:right-4 lg:bottom-20 lg:w-96 bg-white dark:bg-slate-900 rounded-t-3xl lg:rounded-2xl shadow-2xl z-50 flex flex-col"
            style={{ maxHeight: '70vh' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-white text-sm">EmporiumBot</p>
                <p className="text-xs text-emerald-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" /> En línea
                </p>
              </div>
              <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-teal-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm'
                    }`}
                  >
                    {m.content}
                  </motion.div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                          className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Escribe un mensaje..."
                  disabled={loading}
                  className="flex-1 bg-transparent text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 text-white disabled:text-slate-400 rounded-xl flex items-center justify-center transition"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Main TiendaClient ─────────────────────────────────────────────────────────
export default function TiendaClient({ profile, productos, clienteInfo }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Credit info
  const creditoAutorizado = clienteInfo?.credito_autorizado ?? false
  const limiteCredito = clienteInfo?.limite_credito ?? 0
  const [creditoUsado, setCreditoUsado] = useState(clienteInfo?.credito_usado ?? 0)

  // State
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [successOrder, setSuccessOrder] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [notas, setNotas] = useState('')
  const [direccion, setDireccion] = useState(clienteInfo?.direccion ?? '')
  const [ordering, setOrdering] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Categories
  const categorias = useMemo(() => {
    const cats = new Set<string>()
    productos.forEach(p => { if (p.categoria) cats.add(p.categoria) })
    return Array.from(cats).sort()
  }, [productos])

  // Filtered products
  const filtered = useMemo(() => {
    let list = productos
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        p.descripcion?.toLowerCase().includes(q) ||
        p.categoria?.toLowerCase().includes(q)
      )
    }
    if (categoria) list = list.filter(p => p.categoria === categoria)
    return list
  }, [productos, search, categoria])

  // Cart helpers
  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.presentacionId === item.presentacionId)
      if (existing) {
        return prev.map(i =>
          i.presentacionId === item.presentacionId
            ? { ...i, cantidad: Math.min(i.stock, i.cantidad + item.cantidad) }
            : i
        )
      }
      return [...prev, item]
    })
    toast.success(`${item.productoNombre} agregado`)
  }

  const updateCart = (id: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.presentacionId === id
        ? { ...i, cantidad: Math.max(1, Math.min(i.stock, i.cantidad + delta)) }
        : i
      )
    )
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.presentacionId !== id))
  }

  const cartCount = cart.reduce((s, i) => s + i.cantidad, 0)

  // ── Load reorder from localStorage (set by mis-pedidos "Volver a pedir") ──
  useEffect(() => {
    const raw = localStorage.getItem('emporium_reorder')
    if (raw) {
      try {
        const items: CartItem[] = JSON.parse(raw)
        if (items.length) {
          setCart(items)
          setCartOpen(true)
          toast.success('Productos del pedido anterior cargados')
        }
      } catch {}
      localStorage.removeItem('emporium_reorder')
    }
  }, [])

  // ── Stripe checkout ───────────────────────────────────────────────────────
  const handleStripeCheckout = async () => {
    if (cart.length === 0) return
    const stripeItems = cart.map(i => ({
      presentacion_id: i.presentacionId,
      productoNombre: i.productoNombre,
      presentacionNombre: i.presentacionNombre,
      precio: i.precio,
      cantidad: i.cantidad,
    }))
    // Save cart to localStorage so success page can create the order
    localStorage.setItem('emporium_stripe_cart', JSON.stringify(stripeItems))
    localStorage.setItem('emporium_stripe_direccion', direccion)

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: stripeItems,
        notas,
        direccion_entrega: direccion,
      }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      toast.error(data.error ?? 'Error al iniciar pago')
    }
  }

  // Sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Confirm order — single entrypoint. Server decides orden vs Stripe.
  const handleConfirmOrder = async () => {
    setOrdering(true)
    try {
      const items = cart.map(i => ({
        presentacion_id: i.presentacionId,
        productoNombre: i.productoNombre,
        presentacionNombre: i.presentacionNombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio,
      }))
      const res = await fetch('/api/tienda/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, notas, direccion_entrega: direccion }),
      })

      let data: any = {}
      try { data = await res.json() } catch { /* ignore */ }

      if (!res.ok) {
        toast.error(data.error ?? 'Error al crear la orden')
        return
      }

      // TYPE B (direct client) — redirect to Stripe
      if (data.tipo === 'pago' && data.url) {
        toast.success('Redirigiendo al pago seguro…')
        // Don't clear cart yet — leave for retry if user cancels at Stripe
        window.location.href = data.url
        return
      }

      // TYPE A (credit client) — orden created, awaiting admin approval
      if (data.tipo === 'orden' && data.numero) {
        setCart([])
        setConfirmOpen(false)
        setCartOpen(false)
        setSuccessOrder(data.numero)
        setNotas('')
        return
      }

      // Unexpected response
      toast.error('Respuesta inesperada del servidor')
      console.error('[tienda] unexpected response:', data)
    } catch (err) {
      console.error('[tienda] handleConfirmOrder threw:', err)
      toast.error('Error de conexión. Intenta de nuevo.')
    } finally {
      setOrdering(false)
    }
  }

  if (successOrder !== null) {
    return <SuccessScreen numeroPedido={successOrder} onContinue={() => setSuccessOrder(null)} />
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
            <Package2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="font-black text-slate-800 dark:text-white text-base leading-tight">Emporium</p>
            <p className="text-xs text-slate-400 leading-none">Tienda Digital</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold">
                {profile.nombre?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden sm:inline truncate max-w-24">
                {profile.nombre}
              </span>
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 py-1 z-50"
                >
                  <Link href="/tienda/mis-pedidos" onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                    <ClipboardList className="w-4 h-4 text-slate-400" /> Mis Pedidos
                  </Link>
                  <Link href="/tienda/perfil" onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                    <User className="w-4 h-4 text-slate-400" /> Mi Perfil
                  </Link>
                  <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                    <LogOut className="w-4 h-4" /> Salir
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Cart */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition active:scale-95"
          >
            <ShoppingCart className="w-5 h-5" />
            <AnimatePresence>
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center"
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </header>

      {/* ── Search + Filters ── */}
      <div className="sticky top-[61px] z-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Category pills */}
        {categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              onClick={() => setCategoria(null)}
              className={`flex-shrink-0 text-xs font-semibold px-4 py-1.5 rounded-full transition-all ${
                categoria === null
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Todos
            </button>
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoria(cat === categoria ? null : cat)}
                className={`flex-shrink-0 text-xs font-semibold px-4 py-1.5 rounded-full transition-all ${
                  categoria === cat
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Featured / Destacados Banner ── */}
      {!search && !categoria && (() => {
        const destacados = [...productos]
          .sort((a, b) => {
            const stockA = a.presentaciones.reduce((s, p) => s + p.stock, 0)
            const stockB = b.presentaciones.reduce((s, p) => s + p.stock, 0)
            return stockB - stockA
          })
          .slice(0, 4)
        if (destacados.length === 0) return null
        return (
          <div className="px-4 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Más disponibles</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {destacados.map(p => {
                const pres = p.presentaciones[0]
                const gradients = ['from-teal-400 to-emerald-500','from-violet-400 to-purple-500','from-orange-400 to-amber-500','from-sky-400 to-blue-500']
                const grad = gradients[p.nombre.charCodeAt(0) % gradients.length]
                return (
                  <div key={p.id} className="flex-shrink-0 w-32 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className={`h-20 bg-gradient-to-br ${grad} flex items-center justify-center`}>
                      {p.imagen_url
                        ? <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                        : <span className="text-3xl font-black text-white/80">{p.nombre.charAt(0)}</span>
                      }
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight line-clamp-2">{p.nombre}</p>
                      <p className="text-xs font-black text-teal-600 mt-1">{formatCurrency(pres?.precio ?? 0)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Product Grid ── */}
      <main className="px-4 py-5 pb-28">
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Package2 className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">Sin productos encontrados</p>
            <button onClick={() => { setSearch(''); setCategoria(null) }} className="text-sm text-teal-600 mt-2 hover:underline">
              Limpiar filtros
            </button>
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
          >
            <AnimatePresence>
              {filtered.map(p => (
                <ProductCard key={p.id} producto={p} onAdd={addToCart} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-4 py-2 z-20 safe-bottom lg:hidden">
        <Link href="/tienda" className="flex flex-col items-center gap-0.5 py-1 text-teal-600">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-xs font-medium">Tienda</span>
        </Link>
        <Link href="/tienda/mis-pedidos" className="flex flex-col items-center gap-0.5 py-1 text-slate-400 hover:text-slate-600 transition">
          <ClipboardList className="w-5 h-5" />
          <span className="text-xs font-medium">Pedidos</span>
        </Link>
        <Link href="/tienda/perfil" className="flex flex-col items-center gap-0.5 py-1 text-slate-400 hover:text-slate-600 transition">
          <User className="w-5 h-5" />
          <span className="text-xs font-medium">Perfil</span>
        </Link>
      </nav>

      {/* ── Chat FAB ── */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setChatOpen(v => !v)}
        className="fixed bottom-20 right-4 lg:bottom-6 w-14 h-14 bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-full shadow-xl shadow-teal-500/40 flex items-center justify-center z-30 transition-all"
      >
        <AnimatePresence mode="wait">
          {chatOpen
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                <X className="w-6 h-6" />
              </motion.div>
            : <motion.div key="msg" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                <MessageCircle className="w-6 h-6" />
              </motion.div>
          }
        </AnimatePresence>
      </motion.button>

      {/* ── Panels / Modals ── */}
      <CartPanel
        items={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdate={updateCart}
        onRemove={removeFromCart}
        onCheckout={() => { setCartOpen(false); setConfirmOpen(true) }}
        creditoAutorizado={creditoAutorizado}
        limiteCredito={limiteCredito}
        creditoUsado={creditoUsado}
      />

      <ConfirmModal
        items={cart}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmOrder}
        loading={ordering}
        notas={notas}
        setNotas={setNotas}
        direccion={direccion}
        setDireccion={setDireccion}
        creditoAutorizado={creditoAutorizado}
      />

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        productos={productos}
      />
    </div>
  )
}
