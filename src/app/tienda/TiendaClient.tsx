'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ShoppingBag, Search, X, Plus, Minus, Trash2, MessageCircle,
  Send, CheckCircle2, ClipboardList, User, LogOut,
  ChevronRight, Loader2, Sparkles, CreditCard,
  Wallet, Landmark, FileText, Copy, Menu, ArrowUpRight,
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
    id?: string
    nombre?: string
    direccion?: string; telefono?: string; whatsapp?: string
    ciudad?: string; tipo_cliente?: string
    credito_autorizado?: boolean; limite_credito?: number; credito_usado?: number
  } | null
  empresaPayment?: {
    zelle_numero?: string | null
    zelle_titular?: string | null
    banco_nombre?: string | null
    banco_cuenta?: string | null
    banco_routing?: string | null
    banco_titular?: string | null
  } | null
}

type TipoPago = 'zelle' | 'transferencia' | 'stripe' | 'credito'
type TipoClienteForm = 'tienda' | 'supermercado' | 'restaurante' | 'persona_natural' | 'otro'
interface ShippingFormValues {
  nombre: string; telefono: string; direccion: string
  ciudad: string; whatsapp: string; tipo_cliente: TipoClienteForm
}

// ── Luxury gradient palette for product placeholders ──────────────────────────
// Muted, pharmaceutical-inspired tones — no saturated kid-bright rainbows.
const LUX_GRADIENTS = [
  'from-stone-200 via-stone-100 to-amber-50',
  'from-teal-50 via-emerald-50 to-stone-100',
  'from-amber-50 via-stone-100 to-neutral-100',
  'from-neutral-100 via-stone-100 to-teal-50',
  'from-rose-50 via-stone-100 to-amber-50',
]
function gradientFor(name: string) {
  return LUX_GRADIENTS[name.charCodeAt(0) % LUX_GRADIENTS.length]
}

// ── Stock indicator — understated dot + label ─────────────────────────────────
function stockLabel(stock: number) {
  if (stock <= 0) return { text: 'Agotado', dot: 'bg-rose-400', tone: 'text-rose-500' }
  if (stock <= 5) return { text: `Quedan ${stock}`, dot: 'bg-amber-500', tone: 'text-amber-700' }
  return { text: 'Disponible', dot: 'bg-emerald-500', tone: 'text-emerald-700' }
}

// ── Gradient placeholder (reused across grid + quick view + cart thumbs) ──────
function GradientPlaceholder({ nombre, className = '' }: { nombre: string; className?: string }) {
  const initial = nombre.charAt(0).toUpperCase()
  return (
    <div
      className={`relative w-full h-full bg-gradient-to-br ${gradientFor(nombre)} flex items-center justify-center ${className}`}
    >
      <span className="font-serif text-5xl md:text-6xl text-brand-navy/30 tracking-wide select-none">
        {initial}
      </span>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,white_0%,transparent_55%)] pointer-events-none" />
    </div>
  )
}

// ── Product Card — editorial, generous whitespace ─────────────────────────────
function ProductCard({
  producto, onAdd,
}: {
  producto: Producto
  onAdd: (item: CartItem) => void
}) {
  const [selPres, setSelPres] = useState<Presentacion>(producto.presentaciones[0])
  const [qty, setQty] = useState(1)
  const [bounce, setBounce] = useState(false)

  const st = stockLabel(selPres.stock)
  const agotado = selPres.stock === 0

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={`group relative bg-white rounded-[20px] border border-stone-200/70 overflow-hidden flex flex-col ${agotado ? 'opacity-70 grayscale' : 'hover:border-brand-gold/60 hover:shadow-[0_20px_45px_-20px_rgba(15,23,42,0.18)]'} transition-all duration-300`}
    >
      {/* Image */}
      <div className="relative aspect-square flex-shrink-0 overflow-hidden bg-brand-stone">
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <GradientPlaceholder nombre={producto.nombre} />
        )}
        {producto.categoria && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-[10px] uppercase tracking-luxe font-medium px-2.5 py-1 rounded-full text-brand-charcoal">
            {producto.categoria}
          </span>
        )}
        {agotado && (
          <div className="absolute inset-0 bg-brand-cream/80 backdrop-blur-[2px] flex items-center justify-center">
            <span className="font-serif italic text-brand-navy/70 text-lg">Agotado</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="space-y-1.5">
          <h3 className="font-serif text-[17px] leading-snug text-brand-navy line-clamp-2 min-h-[2.6rem]">
            {producto.nombre}
          </h3>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            <span className={`text-[11px] font-medium ${st.tone}`}>{st.text}</span>
          </div>
        </div>

        {/* Presentations — subtle pill row */}
        {producto.presentaciones.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {producto.presentaciones.map(pr => (
              <button
                key={pr.id}
                onClick={() => { setSelPres(pr); setQty(1) }}
                className={`text-[11px] tracking-wide px-3 py-1 rounded-full border transition-all ${
                  selPres.id === pr.id
                    ? 'bg-brand-navy text-brand-cream border-brand-navy'
                    : 'bg-transparent text-brand-charcoal border-stone-300 hover:border-brand-navy'
                }`}
              >
                {pr.nombre}
              </button>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto pt-2 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">Precio</p>
            <p className="font-serif text-2xl text-brand-navy leading-none mt-1">
              {formatCurrency(selPres.precio)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center border border-stone-200 rounded-full overflow-hidden">
              <button
                disabled={agotado || qty <= 1}
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-7 h-7 flex items-center justify-center text-brand-charcoal/70 hover:bg-brand-stone disabled:opacity-30 transition"
                aria-label="Disminuir"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-6 text-center text-xs font-semibold text-brand-navy">
                {qty}
              </span>
              <button
                disabled={agotado || qty >= selPres.stock}
                onClick={() => setQty(q => Math.min(selPres.stock, q + 1))}
                className="w-7 h-7 flex items-center justify-center text-brand-charcoal/70 hover:bg-brand-stone disabled:opacity-30 transition"
                aria-label="Aumentar"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <motion.button
          animate={bounce ? { scale: [1, 1.03, 0.98, 1] } : {}}
          transition={{ duration: 0.4 }}
          disabled={agotado}
          onClick={handleAdd}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 bg-brand-navy hover:bg-brand-navy/90 disabled:bg-stone-200 disabled:text-stone-400 text-brand-cream text-[11px] uppercase tracking-luxe font-medium py-3 rounded-full transition-colors"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Añadir al carrito
        </motion.button>
      </div>
    </motion.div>
  )
}

// ── Cart Drawer ───────────────────────────────────────────────────────────────
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
            className="fixed inset-0 bg-brand-navy/50 backdrop-blur-[3px] z-40"
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-brand-cream z-50 flex flex-col shadow-[-20px_0_60px_-20px_rgba(15,23,42,0.25)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-8 pb-5 border-b border-stone-200/80">
              <div>
                <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">Tu selección</p>
                <h2 className="font-serif text-2xl text-brand-navy mt-1">
                  Carrito · <span className="text-brand-gold">{items.reduce((s, i) => s + i.cantidad, 0)}</span>
                </h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-full text-brand-charcoal hover:bg-stone-100 transition" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-brand-charcoal/50 px-6">
                  <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
                    <ShoppingBag className="w-7 h-7 text-brand-charcoal/40" />
                  </div>
                  <p className="font-serif italic text-lg text-brand-navy/70">Tu carrito está vacío</p>
                  <p className="text-xs text-center max-w-[220px]">
                    Explora el catálogo y añade tus productos favoritos.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-stone-200/70">
                  {items.map(item => (
                    <li key={item.presentacionId} className="flex items-start gap-4 px-7 py-5">
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-brand-stone">
                        {item.imagenUrl ? (
                          <img src={item.imagenUrl} alt={item.productoNombre} className="w-full h-full object-cover" />
                        ) : (
                          <GradientPlaceholder nombre={item.productoNombre} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-[15px] text-brand-navy leading-tight">{item.productoNombre}</p>
                        <p className="text-[11px] uppercase tracking-wide text-brand-charcoal/60 mt-0.5">{item.presentacionNombre}</p>
                        <p className="font-serif text-brand-navy mt-2">{formatCurrency(item.precio * item.cantidad)}</p>

                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex items-center border border-stone-200 rounded-full">
                            <button
                              onClick={() => onUpdate(item.presentacionId, -1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-stone-100 rounded-l-full transition"
                              aria-label="Disminuir"
                            >
                              <Minus className="w-3 h-3 text-brand-charcoal" />
                            </button>
                            <span className="w-7 text-center text-xs font-semibold text-brand-navy">{item.cantidad}</span>
                            <button
                              onClick={() => onUpdate(item.presentacionId, 1)}
                              disabled={item.cantidad >= item.stock}
                              className="w-7 h-7 flex items-center justify-center hover:bg-stone-100 rounded-r-full disabled:opacity-30 transition"
                              aria-label="Aumentar"
                            >
                              <Plus className="w-3 h-3 text-brand-charcoal" />
                            </button>
                          </div>
                          <button
                            onClick={() => onRemove(item.presentacionId)}
                            className="text-[11px] uppercase tracking-wide text-brand-charcoal/60 hover:text-rose-500 transition flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-stone-200/80 bg-white px-7 py-6 space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">Subtotal</span>
                  <span className="font-serif text-3xl text-brand-navy">{formatCurrency(total)}</span>
                </div>

                {creditoAutorizado && (
                  <div className="flex items-center justify-between text-[11px] px-4 py-3 rounded-xl bg-brand-mint text-emerald-800">
                    <span className="uppercase tracking-wide">Crédito disponible</span>
                    <span className="font-semibold">{formatCurrency(creditoDisponible)}</span>
                  </div>
                )}

                <button
                  onClick={onCheckout}
                  className="w-full bg-brand-navy hover:bg-brand-navy/90 text-brand-cream text-[11px] uppercase tracking-luxe font-medium py-4 rounded-full transition-all active:scale-[0.99] flex items-center justify-center gap-2 group"
                >
                  Continuar al pago
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <p className="text-[10px] text-brand-charcoal/50 text-center uppercase tracking-wide">
                  Envío calculado en el siguiente paso
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Payment method metadata ───────────────────────────────────────────────────
const PAGO_METHODS: Record<TipoPago, {
  label: string
  tagline: string
  accent: string
  ring: string
  text: string
  Icon: any
}> = {
  zelle: {
    label: 'Zelle',
    tagline: 'Envía a nuestra cuenta — confirmamos tu pago en minutos',
    accent: 'bg-emerald-50',
    ring: 'ring-emerald-600',
    text: 'text-emerald-800',
    Icon: Wallet,
  },
  transferencia: {
    label: 'Transferencia',
    tagline: 'Transferencia bancaria con número de referencia',
    accent: 'bg-sky-50',
    ring: 'ring-sky-600',
    text: 'text-sky-800',
    Icon: Landmark,
  },
  stripe: {
    label: 'Tarjeta',
    tagline: 'Pago seguro con tarjeta crédito o débito vía Stripe',
    accent: 'bg-violet-50',
    ring: 'ring-violet-600',
    text: 'text-violet-800',
    Icon: CreditCard,
  },
  credito: {
    label: 'Crédito',
    tagline: 'Usa tu línea de crédito autorizada',
    accent: 'bg-amber-50',
    ring: 'ring-amber-600',
    text: 'text-amber-800',
    Icon: FileText,
  },
}

// ── Copy-row helper ───────────────────────────────────────────────────────────
function CopyRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copiado`)
    } catch {
      toast.error('No se pudo copiar')
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-brand-charcoal/60">{label}</p>
        <p className="font-mono font-semibold text-brand-navy truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-stone-200 text-brand-charcoal hover:border-brand-navy transition"
      >
        <Copy className="w-3 h-3" /> Copiar
      </button>
    </div>
  )
}

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmModal({
  items, open, onClose, onConfirm, loading, notas, setNotas, direccion, setDireccion,
  tipoPago, setTipoPago, numeroRef, setNumeroRef,
  creditoAutorizado, creditoDisponible,
  empresaPayment,
}: {
  items: CartItem[]; open: boolean; onClose: () => void; onConfirm: () => void
  loading: boolean; notas: string; setNotas: (v: string) => void
  direccion: string; setDireccion: (v: string) => void
  tipoPago: TipoPago; setTipoPago: (t: TipoPago) => void
  numeroRef: string; setNumeroRef: (v: string) => void
  creditoAutorizado: boolean; creditoDisponible: number
  empresaPayment?: Props['empresaPayment']
}) {
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  const methods: TipoPago[] = ['zelle', 'transferencia', 'stripe']
  if (creditoAutorizado) methods.push('credito')

  const meta = PAGO_METHODS[tipoPago]
  const creditoInsuficiente = tipoPago === 'credito' && total > creditoDisponible
  const refFaltante = tipoPago === 'transferencia' && !numeroRef.trim()
  const ctaDisabled = loading || creditoInsuficiente || refFaltante

  const ctaLabel =
    tipoPago === 'stripe'  ? 'Pagar con tarjeta' :
    tipoPago === 'credito' ? 'Confirmar con crédito' :
    tipoPago === 'zelle'   ? 'Confirmar — pago por Zelle' :
                             'Confirmar — transferencia'

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-brand-navy/60 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            className="relative bg-brand-cream rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-lg flex flex-col shadow-2xl overflow-hidden"
            style={{ maxHeight: '92vh' }}
          >
            <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-stone-300" />

            {/* Header */}
            <div className="shrink-0 flex items-start justify-between px-7 pt-7 pb-5 border-b border-stone-200/80">
              <div>
                <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">Revisa y confirma</p>
                <h2 className="font-serif text-2xl text-brand-navy mt-1">Tu pedido</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-brand-charcoal hover:bg-stone-100 transition"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">

              {/* Items summary */}
              <ul className="space-y-3">
                {items.map(item => (
                  <li key={item.presentacionId} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-serif text-[15px] text-brand-navy leading-tight">{item.productoNombre}</p>
                      <p className="text-[11px] uppercase tracking-wide text-brand-charcoal/60 mt-0.5">
                        {item.presentacionNombre} · ×{item.cantidad}
                      </p>
                    </div>
                    <span className="font-serif text-brand-navy tabular-nums shrink-0">
                      {formatCurrency(item.precio * item.cantidad)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Total */}
              <div className="flex items-end justify-between pt-4 border-t border-stone-200/80">
                <span className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">Total</span>
                <span className="font-serif text-3xl text-brand-navy">{formatCurrency(total)}</span>
              </div>

              {/* Payment method selector */}
              <div>
                <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-3">
                  Método de pago
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {methods.map(m => {
                    const mm = PAGO_METHODS[m]
                    const active = tipoPago === m
                    const Icon = mm.Icon
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTipoPago(m)}
                        className={`relative text-left p-4 rounded-2xl border transition-all active:scale-[0.99] ${
                          active
                            ? `${mm.accent} border-transparent ring-1 ${mm.ring} shadow-sm`
                            : 'bg-white border-stone-200 hover:border-brand-navy/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className={`w-4 h-4 ${active ? mm.text : 'text-brand-charcoal/50'}`} />
                          <span className={`text-xs uppercase tracking-wide font-medium ${active ? mm.text : 'text-brand-navy'}`}>
                            {mm.label}
                          </span>
                          {active && <CheckCircle2 className={`w-3.5 h-3.5 ml-auto ${mm.text}`} />}
                        </div>
                        <p className="text-[11px] text-brand-charcoal/70 leading-snug">
                          {mm.tagline}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Payment-method specific cards */}
              {tipoPago === 'zelle' && (
                <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5 space-y-3">
                  <p className="text-[10px] uppercase tracking-luxe text-emerald-700 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Enviar pago por Zelle
                  </p>
                  {empresaPayment?.zelle_numero ? (
                    <div className="space-y-2.5">
                      <CopyRow label="Zelle" value={empresaPayment.zelle_numero} />
                      {empresaPayment.zelle_titular && (
                        <CopyRow label="Titular" value={empresaPayment.zelle_titular} />
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-brand-charcoal/60 italic">
                      El administrador aún no ha configurado la cuenta de Zelle.
                    </p>
                  )}
                  <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
                    Al confirmar, tu orden queda pendiente. Verificaremos el pago y la aprobaremos.
                  </p>
                </div>
              )}

              {tipoPago === 'transferencia' && (
                <div className="rounded-2xl border border-sky-200/60 bg-sky-50/50 p-5 space-y-3">
                  <p className="text-[10px] uppercase tracking-luxe text-sky-700 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5" /> Datos bancarios
                  </p>
                  {empresaPayment?.banco_nombre || empresaPayment?.banco_cuenta ? (
                    <div className="space-y-2.5">
                      {empresaPayment?.banco_nombre  && <CopyRow label="Banco"   value={empresaPayment.banco_nombre}  />}
                      {empresaPayment?.banco_cuenta  && <CopyRow label="Cuenta"  value={empresaPayment.banco_cuenta}  />}
                      {empresaPayment?.banco_routing && <CopyRow label="Routing" value={empresaPayment.banco_routing} />}
                      {empresaPayment?.banco_titular && <CopyRow label="Titular" value={empresaPayment.banco_titular} />}
                    </div>
                  ) : (
                    <p className="text-xs text-brand-charcoal/60 italic">
                      El administrador aún no ha configurado los datos bancarios.
                    </p>
                  )}
                  <div>
                    <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/70 mb-1.5">
                      Número de referencia <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={numeroRef}
                      onChange={e => setNumeroRef(e.target.value)}
                      placeholder="Últimos 6-8 dígitos"
                      className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 bg-white text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy transition"
                    />
                    {refFaltante && (
                      <p className="text-[11px] text-rose-500 mt-1.5">Requerido para verificar tu transferencia.</p>
                    )}
                  </div>
                </div>
              )}

              {tipoPago === 'stripe' && (
                <div className="rounded-2xl border border-violet-200/60 bg-violet-50/50 p-5 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-luxe text-violet-700 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Pago con tarjeta
                  </p>
                  <p className="text-[12px] text-brand-charcoal/80 leading-relaxed">
                    Al confirmar serás redirigido a la pasarela segura de Stripe.
                    Tu pedido se activa automáticamente cuando el pago se procese.
                  </p>
                </div>
              )}

              {tipoPago === 'credito' && (
                <div className={`rounded-2xl border p-5 space-y-2 ${
                  creditoInsuficiente
                    ? 'border-rose-200/60 bg-rose-50/50'
                    : 'border-amber-200/60 bg-amber-50/50'
                }`}>
                  <p className="text-[10px] uppercase tracking-luxe text-amber-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Línea de crédito
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-brand-charcoal/70">Crédito disponible</span>
                    <span className="font-semibold text-brand-navy tabular-nums">
                      {formatCurrency(creditoDisponible)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-brand-charcoal/70">Saldo tras esta compra</span>
                    <span className={`font-semibold tabular-nums ${creditoInsuficiente ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {formatCurrency(creditoDisponible - total)}
                    </span>
                  </div>
                  {creditoInsuficiente && (
                    <p className="text-[11px] text-rose-600 font-medium">
                      Crédito insuficiente para esta compra. Elige otro método de pago.
                    </p>
                  )}
                </div>
              )}

              {/* Shipping address */}
              <div>
                <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-2">
                  Dirección de entrega
                </label>
                <input
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  placeholder="Av. Principal, Casa 5…"
                  className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 bg-white text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy transition"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-2">
                  Notas <span className="normal-case text-brand-charcoal/40 tracking-normal">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Instrucciones especiales…"
                  className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 bg-white text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy resize-none transition"
                />
              </div>
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 px-7 py-5 border-t border-stone-200/80 bg-white space-y-2.5">
              <button
                onClick={onConfirm}
                disabled={ctaDisabled}
                className={`w-full py-4 rounded-full text-[11px] uppercase tracking-luxe font-medium text-brand-cream flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                  tipoPago === 'stripe'
                    ? 'bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-600 hover:to-indigo-600'
                    : tipoPago === 'credito'
                    ? 'bg-amber-700 hover:bg-amber-600'
                    : tipoPago === 'transferencia'
                    ? 'bg-sky-700 hover:bg-sky-600'
                    : 'bg-brand-navy hover:bg-brand-navy/90'
                }`}
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
                  : <><meta.Icon className="w-4 h-4" /> {ctaLabel}</>
                }
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full py-3 rounded-full text-[11px] uppercase tracking-wide text-brand-charcoal hover:text-brand-navy transition disabled:opacity-40"
              >
                Volver al carrito
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-brand-cream z-50 flex flex-col items-center justify-center gap-8 p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 180 }}
        className="relative w-28 h-28"
      >
        <div className="absolute inset-0 rounded-full bg-brand-gold/20 animate-pulse" />
        <div className="absolute inset-2 rounded-full bg-brand-mint flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-700" strokeWidth={1.5} />
        </div>
      </motion.div>

      <div className="max-w-sm space-y-3">
        <p className="text-[10px] uppercase tracking-luxe text-brand-gold">Confirmado</p>
        <h1 className="font-serif text-4xl text-brand-navy leading-tight">
          Gracias por tu pedido
        </h1>
        <p className="text-sm text-brand-charcoal/70 leading-relaxed">
          Tu orden <span className="font-semibold text-brand-navy">{numeroPedido}</span> ha sido recibida.
          Te notificaremos cuando sea aprobada.
        </p>
        <p className="text-[11px] text-brand-charcoal/50 italic">Redirigiendo en unos segundos…</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/tienda/mis-pedidos"
          className="flex items-center justify-center gap-2 bg-brand-navy text-brand-cream text-[11px] uppercase tracking-luxe py-4 rounded-full transition hover:bg-brand-navy/90"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Ver mis pedidos
        </Link>
        <button
          onClick={onContinue}
          className="text-[11px] uppercase tracking-wide text-brand-charcoal hover:text-brand-navy transition py-2"
        >
          Seguir explorando →
        </button>
      </div>
    </motion.div>
  )
}

// ── Shipping Form ─────────────────────────────────────────────────────────────
function ShippingForm({
  open, onClose, onSubmit, initial, submitting,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (values: ShippingFormValues) => void
  initial: ShippingFormValues
  submitting: boolean
}) {
  const [values, setValues] = useState<ShippingFormValues>(initial)

  useEffect(() => {
    if (open) setValues(initial)
  }, [open, initial])

  const set = <K extends keyof ShippingFormValues>(k: K, v: ShippingFormValues[K]) =>
    setValues(prev => ({ ...prev, [k]: v }))

  const valid =
    values.nombre.trim() &&
    values.telefono.trim() &&
    values.direccion.trim() &&
    values.ciudad.trim()

  const TIPO_OPTIONS: { value: TipoClienteForm; label: string }[] = [
    { value: 'tienda',          label: 'Tienda' },
    { value: 'supermercado',    label: 'Supermercado' },
    { value: 'restaurante',     label: 'Restaurante' },
    { value: 'persona_natural', label: 'Persona natural' },
  ]

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-brand-navy/60 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            className="relative bg-brand-cream rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-md flex flex-col shadow-2xl overflow-hidden"
            style={{ maxHeight: '92vh' }}
          >
            <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-stone-300" />

            <div className="shrink-0 flex items-start justify-between px-7 pt-7 pb-4 border-b border-stone-200/80">
              <div>
                <p className="text-[10px] uppercase tracking-luxe text-brand-gold">Primer pedido</p>
                <h2 className="font-serif text-2xl text-brand-navy mt-1">Datos de envío</h2>
                <p className="text-[12px] text-brand-charcoal/70 mt-1">
                  Guardaremos esta información para futuros pedidos.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-brand-charcoal hover:bg-stone-100 transition"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
              {([
                ['nombre',    'Nombre completo / Empresa *', 'Ej. Bodega Los Olivos', 'text'],
                ['telefono',  'Teléfono *',                  '0414-0000000',          'tel'],
                ['ciudad',    'Ciudad *',                    'Caracas',               'text'],
                ['whatsapp',  'WhatsApp (opcional)',         '0414-0000000',          'tel'],
              ] as const).map(([key, label, placeholder, type]) => (
                <div key={key}>
                  <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-1.5">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={values[key]}
                    onChange={e => set(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy transition"
                  />
                </div>
              ))}

              <div>
                <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-1.5">
                  Dirección de entrega *
                </label>
                <textarea
                  rows={2}
                  value={values.direccion}
                  onChange={e => set('direccion', e.target.value)}
                  placeholder="Av. Principal, Casa 5, Urb. X"
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy resize-none transition"
                />
              </div>

              <div>
                <p className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-2">
                  Tipo de cliente
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TIPO_OPTIONS.map(opt => {
                    const active = values.tipo_cliente === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set('tipo_cliente', opt.value)}
                        className={`px-3 py-2.5 rounded-full text-[11px] uppercase tracking-wide border transition ${
                          active
                            ? 'bg-brand-navy text-brand-cream border-brand-navy'
                            : 'bg-white text-brand-charcoal border-stone-200 hover:border-brand-navy/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="shrink-0 px-7 py-5 border-t border-stone-200/80 bg-white">
              <button
                onClick={() => onSubmit(values)}
                disabled={!valid || submitting}
                className="w-full bg-brand-navy hover:bg-brand-navy/90 disabled:opacity-50 disabled:cursor-not-allowed text-brand-cream text-[11px] uppercase tracking-luxe py-4 rounded-full transition flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Guardar y continuar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
        '¡Hola! Soy tu asistente de compras.\n\n' +
        'Cuéntame qué necesitas y te ayudo a encontrarlo. Por ejemplo:\n' +
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
            className="fixed inset-0 bg-brand-navy/30 z-40 lg:hidden"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed bottom-0 right-0 left-0 lg:left-auto lg:right-6 lg:bottom-24 lg:w-[400px] bg-brand-cream rounded-t-[28px] lg:rounded-[24px] shadow-[0_20px_60px_-20px_rgba(15,23,42,0.35)] z-50 flex flex-col overflow-hidden"
            style={{ maxHeight: '75vh' }}
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-200/80 flex-shrink-0 bg-white">
              <div className="w-10 h-10 rounded-full bg-brand-navy flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-brand-gold" />
              </div>
              <div>
                <p className="font-serif text-base text-brand-navy leading-tight">Concierge</p>
                <p className="text-[10px] uppercase tracking-luxe text-emerald-600 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" /> En línea
                </p>
              </div>
              <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-stone-100 transition" aria-label="Cerrar">
                <X className="w-4 h-4 text-brand-charcoal" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-brand-navy text-brand-cream rounded-br-sm'
                        : 'bg-white text-brand-navy rounded-bl-sm border border-stone-200'
                    }`}
                  >
                    {m.content}
                  </motion.div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                          className="w-1.5 h-1.5 bg-brand-gold rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-stone-200/80 flex-shrink-0 bg-white">
              <div className="flex items-center gap-2 bg-brand-cream rounded-full border border-stone-200 px-5 py-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Escribe un mensaje…"
                  disabled={loading}
                  className="flex-1 bg-transparent text-sm text-brand-navy placeholder-brand-charcoal/40 focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 bg-brand-navy hover:bg-brand-navy/90 disabled:bg-stone-200 text-brand-cream disabled:text-stone-400 rounded-full flex items-center justify-center transition"
                  aria-label="Enviar"
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

// ── Hero — editorial split layout ─────────────────────────────────────────────
function Hero({ nombre }: { nombre: string }) {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-14 lg:pt-20 lg:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Copy */}
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[10px] uppercase tracking-luxe text-brand-gold mb-5"
          >
            Emporium · Distribución premium
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-serif text-[42px] sm:text-[54px] lg:text-[72px] leading-[0.98] text-brand-navy tracking-tight"
          >
            Hola, <span className="italic text-brand-gold">{nombre?.split(' ')[0] ?? 'bienvenido'}</span>.
            <br />
            Tu catálogo,<br />
            <span className="italic">curado.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-7 max-w-md text-base text-brand-charcoal/80 leading-relaxed"
          >
            Productos seleccionados con precisión. Entrega confiable.
            Compra al por mayor o al detal con la misma atención impecable.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-9 flex items-center gap-5"
          >
            <a
              href="#catalogo"
              className="inline-flex items-center gap-2 bg-brand-navy text-brand-cream text-[11px] uppercase tracking-luxe px-7 py-4 rounded-full hover:bg-brand-navy/90 transition-all group"
            >
              Explorar catálogo
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <Link
              href="/tienda/mis-pedidos"
              className="text-[11px] uppercase tracking-luxe text-brand-navy border-b border-brand-navy/30 hover:border-brand-navy pb-0.5 transition"
            >
              Mis pedidos
            </Link>
          </motion.div>
        </div>

        {/* Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative aspect-[4/5] lg:aspect-[4/5] rounded-[32px] overflow-hidden bg-gradient-to-br from-stone-100 via-brand-stone to-amber-50"
        >
          <img
            src="https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=900&q=80"
            alt=""
            className="w-full h-full object-cover mix-blend-multiply"
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-brand-navy/5 rounded-[32px] pointer-events-none" />
          <div className="absolute bottom-6 left-6 right-6 bg-brand-cream/90 backdrop-blur-md rounded-2xl px-5 py-4 border border-white/60">
            <p className="text-[10px] uppercase tracking-luxe text-brand-gold mb-1">La casa</p>
            <p className="font-serif text-lg text-brand-navy leading-snug">
              Calidad sostenida en cada presentación.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Decorative band */}
      <div className="absolute top-0 -right-20 w-72 h-72 rounded-full bg-brand-gold/10 blur-3xl -z-0 pointer-events-none" />
    </section>
  )
}

// ── Main TiendaClient ─────────────────────────────────────────────────────────
export default function TiendaClient({ profile, productos, clienteInfo, empresaPayment }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const creditoAutorizado = clienteInfo?.credito_autorizado ?? false
  const limiteCredito = clienteInfo?.limite_credito ?? 0
  const [creditoUsado] = useState(clienteInfo?.credito_usado ?? 0)
  const creditoDisponible = (limiteCredito ?? 0) - (creditoUsado ?? 0)

  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [shippingOpen, setShippingOpen] = useState(false)
  const [successOrder, setSuccessOrder] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [notas, setNotas] = useState('')
  const [direccion, setDireccion] = useState(clienteInfo?.direccion ?? '')
  const [ordering, setOrdering] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [tipoPago, setTipoPago] = useState<TipoPago>(profile.rol === 'comprador' ? 'stripe' : 'zelle')
  const [numeroRef, setNumeroRef] = useState('')

  const [shipping, setShipping] = useState<ShippingFormValues>({
    nombre:       clienteInfo?.nombre       ?? profile.nombre ?? '',
    telefono:     clienteInfo?.telefono     ?? '',
    direccion:    clienteInfo?.direccion    ?? '',
    ciudad:       clienteInfo?.ciudad       ?? '',
    whatsapp:     clienteInfo?.whatsapp     ?? '',
    tipo_cliente: (clienteInfo?.tipo_cliente as TipoClienteForm) ?? 'persona_natural',
  })
  const isShippingComplete = !!(
    shipping.nombre.trim() && shipping.telefono.trim() &&
    shipping.direccion.trim() && shipping.ciudad.trim()
  )

  const categorias = useMemo(() => {
    const cats = new Set<string>()
    productos.forEach(p => { if (p.categoria) cats.add(p.categoria) })
    return Array.from(cats).sort()
  }, [productos])

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
    toast.success(`${item.productoNombre} añadido`)
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

  // Load reorder from localStorage (set by mis-pedidos "Volver a pedir")
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

  // Stripe checkout — unused fallback path (kept for backwards compat with confirmations)
  const handleStripeCheckout = async () => {
    if (cart.length === 0) return
    const stripeItems = cart.map(i => ({
      presentacion_id: i.presentacionId,
      productoNombre: i.productoNombre,
      presentacionNombre: i.presentacionNombre,
      precio: i.precio,
      cantidad: i.cantidad,
    }))
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

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

      const cliente_data = isShippingComplete
        ? {
            nombre:       shipping.nombre.trim(),
            telefono:     shipping.telefono.trim(),
            direccion:    shipping.direccion.trim(),
            ciudad:       shipping.ciudad.trim(),
            whatsapp:     shipping.whatsapp.trim(),
            tipo_cliente: shipping.tipo_cliente,
          }
        : undefined

      const res = await fetch('/api/tienda/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          notas,
          direccion_entrega: direccion || shipping.direccion,
          cliente_data,
          tipo_pago: tipoPago,
          numero_referencia: tipoPago === 'transferencia' ? numeroRef.trim() : undefined,
        }),
      })

      const data = await res.json().catch(() => ({} as any))

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Error al enviar la orden')
        setOrdering(false)
        return
      }

      if (data.tipo === 'pago' && data.url) {
        toast.success('Redirigiendo al pago seguro…')
        window.location.href = data.url
        return
      }

      setCart([])
      setConfirmOpen(false)
      setCartOpen(false)
      setNotas('')
      setNumeroRef('')
      router.push('/tienda/mis-pedidos')
      const msg =
        tipoPago === 'credito'       ? `Orden ${data.numero ?? ''} creada con crédito` :
        tipoPago === 'zelle'         ? `Orden ${data.numero ?? ''} enviada — confirma tu pago por Zelle` :
        tipoPago === 'transferencia' ? `Orden ${data.numero ?? ''} enviada — verificaremos tu transferencia` :
                                       `Orden ${data.numero ?? ''} enviada correctamente`
      toast.success(msg)
    } catch (err: any) {
      console.error('[tienda] handleConfirmOrder threw:', err)
      toast.error(err?.message ?? 'Error de conexión. Intenta de nuevo.')
    } finally {
      setOrdering(false)
    }
  }

  if (successOrder !== null) {
    return <SuccessScreen numeroPedido={successOrder} onContinue={() => setSuccessOrder(null)} />
  }

  return (
    <div className="min-h-screen bg-brand-cream text-brand-navy">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-brand-cream/85 backdrop-blur-md border-b border-stone-200/70">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
          <Link href="/tienda" className="group flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border border-brand-gold flex items-center justify-center">
              <span className="font-serif text-brand-gold text-lg leading-none">E</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-serif text-lg text-brand-navy leading-tight">Emporium</p>
              <p className="text-[9px] uppercase tracking-luxe text-brand-charcoal/60 leading-none mt-0.5">Distribución premium</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-luxe text-brand-charcoal">
            <a href="#catalogo" className="hover:text-brand-navy transition">Catálogo</a>
            <Link href="/tienda/mis-pedidos" className="hover:text-brand-navy transition">Pedidos</Link>
            <Link href="/tienda/perfil" className="hover:text-brand-navy transition">Cuenta</Link>
          </nav>

          <div className="flex items-center gap-3">
            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full hover:bg-stone-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-brand-navy flex items-center justify-center text-brand-cream text-xs font-semibold">
                  {profile.nombre?.charAt(0).toUpperCase()}
                </div>
                <span className="text-[11px] uppercase tracking-wide text-brand-navy hidden sm:inline max-w-24 truncate">
                  {profile.nombre?.split(' ')[0]}
                </span>
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-[0_20px_45px_-20px_rgba(15,23,42,0.25)] border border-stone-200/80 overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-stone-100">
                      <p className="font-serif text-sm text-brand-navy truncate">{profile.nombre}</p>
                      <p className="text-[11px] text-brand-charcoal/60 truncate">{profile.email}</p>
                    </div>
                    <Link href="/tienda/mis-pedidos" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-[12px] uppercase tracking-wide text-brand-charcoal hover:bg-brand-stone transition">
                      <ClipboardList className="w-3.5 h-3.5" /> Mis pedidos
                    </Link>
                    <Link href="/tienda/perfil" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-[12px] uppercase tracking-wide text-brand-charcoal hover:bg-brand-stone transition">
                      <User className="w-3.5 h-3.5" /> Mi cuenta
                    </Link>
                    <div className="border-t border-stone-100" />
                    <button onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[12px] uppercase tracking-wide text-rose-600 hover:bg-rose-50 transition">
                      <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Cart */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-2 pl-4 pr-4 py-2.5 rounded-full bg-brand-navy text-brand-cream text-[11px] uppercase tracking-luxe hover:bg-brand-navy/90 transition active:scale-95"
              aria-label="Abrir carrito"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Carrito</span>
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="bg-brand-gold text-brand-navy text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ml-0.5"
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* Mobile menu icon */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="md:hidden p-2 rounded-full hover:bg-stone-100 transition"
              aria-label="Menú"
            >
              <Menu className="w-5 h-5 text-brand-navy" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <Hero nombre={profile.nombre} />

      {/* ── Search + Categories — editorial strip ── */}
      <section id="catalogo" className="sticky top-[73px] z-20 bg-brand-cream/90 backdrop-blur-md border-y border-stone-200/70">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex flex-col md:flex-row gap-4 md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-charcoal/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, categoría…"
              className="w-full pl-11 pr-10 py-3 bg-white border border-stone-200 rounded-full text-sm text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2" aria-label="Limpiar búsqueda">
                <X className="w-4 h-4 text-brand-charcoal/50" />
              </button>
            )}
          </div>

          {categorias.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none flex-1 md:justify-end">
              <button
                onClick={() => setCategoria(null)}
                className={`flex-shrink-0 text-[11px] uppercase tracking-luxe px-4 py-2 rounded-full border transition-all ${
                  categoria === null
                    ? 'bg-brand-navy text-brand-cream border-brand-navy'
                    : 'bg-transparent text-brand-charcoal border-stone-300 hover:border-brand-navy'
                }`}
              >
                Todo
              </button>
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoria(cat === categoria ? null : cat)}
                  className={`flex-shrink-0 text-[11px] uppercase tracking-luxe px-4 py-2 rounded-full border transition-all ${
                    categoria === cat
                      ? 'bg-brand-navy text-brand-cream border-brand-navy'
                      : 'bg-transparent text-brand-charcoal border-stone-300 hover:border-brand-navy'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Product Grid ── */}
      <main className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-16 pb-28 lg:pb-24">
        {/* Section label */}
        <div className="mb-10 flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-luxe text-brand-gold mb-2">
              {categoria ?? 'Catálogo completo'}
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl text-brand-navy">
              {search ? 'Resultados' : categoria ? categoria : 'Todos los productos'}
            </h2>
          </div>
          <p className="text-[11px] uppercase tracking-luxe text-brand-charcoal/60">
            {filtered.length} producto{filtered.length === 1 ? '' : 's'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-24 max-w-md mx-auto"
          >
            <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-6">
              <Search className="w-7 h-7 text-brand-charcoal/40" />
            </div>
            <p className="font-serif text-2xl text-brand-navy mb-2">Sin resultados</p>
            <p className="text-sm text-brand-charcoal/70 mb-6">
              No encontramos productos que coincidan con tu búsqueda.
            </p>
            <button
              onClick={() => { setSearch(''); setCategoria(null) }}
              className="text-[11px] uppercase tracking-luxe text-brand-navy border-b border-brand-navy/30 hover:border-brand-navy pb-0.5 transition"
            >
              Limpiar filtros
            </button>
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-7"
          >
            <AnimatePresence>
              {filtered.map(p => (
                <ProductCard key={p.id} producto={p} onAdd={addToCart} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* ── Footer — editorial ── */}
      <footer className="border-t border-stone-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <p className="font-serif text-2xl text-brand-navy">Emporium</p>
            <p className="text-[11px] uppercase tracking-luxe text-brand-gold mt-2">Distribución premium</p>
            <p className="text-sm text-brand-charcoal/70 mt-4 leading-relaxed max-w-xs">
              Productos seleccionados con precisión. Entrega confiable para negocios y hogares.
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-3">Enlaces</p>
            <ul className="space-y-2 text-sm text-brand-navy">
              <li><a href="#catalogo" className="hover:text-brand-gold transition">Catálogo</a></li>
              <li><Link href="/tienda/mis-pedidos" className="hover:text-brand-gold transition">Mis pedidos</Link></li>
              <li><Link href="/tienda/perfil" className="hover:text-brand-gold transition">Mi cuenta</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-3">Asistencia</p>
            <p className="text-sm text-brand-charcoal/70 leading-relaxed">
              Nuestro concierge digital está disponible 24/7. Abre el chat en la esquina inferior derecha.
            </p>
          </div>
        </div>
        <div className="border-t border-stone-200/80 py-5 text-center text-[10px] uppercase tracking-luxe text-brand-charcoal/50">
          © {new Date().getFullYear()} Emporium · Todos los derechos reservados
        </div>
      </footer>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="fixed bottom-0 inset-x-0 bg-brand-cream/95 backdrop-blur-md border-t border-stone-200/80 flex items-center justify-around px-4 py-3 z-20 md:hidden">
        <Link href="/tienda" className="flex flex-col items-center gap-1 py-1 text-brand-navy">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-luxe">Tienda</span>
        </Link>
        <button
          onClick={() => setCartOpen(true)}
          className="relative flex flex-col items-center gap-1 py-1 text-brand-charcoal hover:text-brand-navy transition"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-brand-gold text-brand-navy text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </div>
          <span className="text-[9px] uppercase tracking-luxe">Carrito</span>
        </button>
        <Link href="/tienda/mis-pedidos" className="flex flex-col items-center gap-1 py-1 text-brand-charcoal hover:text-brand-navy transition">
          <ClipboardList className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-luxe">Pedidos</span>
        </Link>
        <Link href="/tienda/perfil" className="flex flex-col items-center gap-1 py-1 text-brand-charcoal hover:text-brand-navy transition">
          <User className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-luxe">Cuenta</span>
        </Link>
      </nav>

      {/* ── Chat FAB ── */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.04 }}
        onClick={() => setChatOpen(v => !v)}
        className="fixed bottom-24 right-5 md:bottom-8 md:right-8 w-14 h-14 bg-brand-navy hover:bg-brand-navy/90 text-brand-gold rounded-full shadow-[0_15px_35px_-10px_rgba(15,23,42,0.45)] flex items-center justify-center z-30 transition-colors"
        aria-label="Abrir chat"
      >
        <AnimatePresence mode="wait">
          {chatOpen
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                <X className="w-5 h-5" />
              </motion.div>
            : <motion.div key="msg" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                <MessageCircle className="w-5 h-5" />
              </motion.div>
          }
        </AnimatePresence>
      </motion.button>

      {/* ── Modals / Drawers ── */}
      <CartPanel
        items={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdate={updateCart}
        onRemove={removeFromCart}
        onCheckout={() => {
          setCartOpen(false)
          if (!isShippingComplete) {
            setShippingOpen(true)
          } else {
            setConfirmOpen(true)
          }
        }}
        creditoAutorizado={creditoAutorizado}
        limiteCredito={limiteCredito}
        creditoUsado={creditoUsado}
      />

      <ShippingForm
        open={shippingOpen}
        onClose={() => setShippingOpen(false)}
        initial={shipping}
        submitting={ordering}
        onSubmit={(values) => {
          setShipping(values)
          if (!direccion) setDireccion(values.direccion)
          setShippingOpen(false)
          setConfirmOpen(true)
        }}
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
        tipoPago={tipoPago}
        setTipoPago={setTipoPago}
        numeroRef={numeroRef}
        setNumeroRef={setNumeroRef}
        creditoAutorizado={creditoAutorizado}
        creditoDisponible={creditoDisponible}
        empresaPayment={empresaPayment}
      />

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        productos={productos}
      />
    </div>
  )
}
