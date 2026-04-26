'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ShoppingBag, Search, X, Plus, Minus, Trash2, MessageCircle,
  Send, CheckCircle2, ClipboardList, User, LogOut,
  ChevronRight, ChevronLeft, Loader2, Sparkles, CreditCard,
  Wallet, FileText, Copy, Menu, ArrowUpRight,
  Banknote, FileCheck, MapPin, Info, Package, PackageOpen, AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import TiendaLanding from './TiendaLanding'
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
    /** Where comprador mails their cheque — shown on the cheque step. */
    direccion_envio_cheques?: string | null
  } | null
  /** Server-computed flag — true only if STRIPE_SECRET_KEY is set to a real
   *  key. When false, the Stripe tile becomes "Próximamente" and is not
   *  selectable. Zelle/Cheque still work regardless. */
  stripeEnabled?: boolean
  /** Hero personalisation stats (Fase 5). All counts default to 0 and
   *  ultimaCompra to null when the user has no cliente record yet — the
   *  hero handles those cases gracefully. */
  clientStats?: {
    pedidosPendientes: number
    pedidosTotales: number
    ultimaCompra: { fecha: string; total: number } | null
    productosNuevos: number
    creditoDisponible: number | null
    esB2B: boolean
  }
}

// Valid tienda payment methods. 'transferencia' was removed — USA
// clients use Zelle, not wire transfers. Cheque + efectivo added.
type TipoPago = 'zelle' | 'stripe' | 'credito' | 'cheque' | 'efectivo'
type TipoClienteForm = 'tienda' | 'supermercado' | 'restaurante' | 'persona_natural' | 'otro'
interface ShippingFormValues {
  nombre: string; telefono: string; direccion: string
  ciudad: string; whatsapp: string; tipo_cliente: TipoClienteForm
}

// ── Category normalization (BUG 2) ─────────────────────────────────────────
// Maps synonyms/casing/punctuation variants to a single canonical key so the
// filter bar doesn't show "Salud" + "Salud." + "Health" as three options.
//
// Flow:
//   1. Trim, lowercase, strip diacritics, drop trailing punctuation.
//   2. If the raw form matches a known English → Spanish synonym, map it.
//   3. The result is both the internal key AND the source of the pretty label
//      (title-cased on display).
const CATEGORIA_SYNONYMS: Record<string, string> = {
  // Health
  health: 'salud', salud: 'salud',
  // Beauty
  beauty: 'belleza', belleza: 'belleza',
  // Cleaning
  cleaning: 'limpieza', limpieza: 'limpieza',
  'household-cleaning': 'limpieza',
  // Food
  food: 'alimentos', alimentos: 'alimentos', comida: 'alimentos', groceries: 'alimentos',
  // Beverages
  beverages: 'bebidas', bebidas: 'bebidas', drinks: 'bebidas',
  // Personal care
  'personal-care': 'cuidado_personal',
  personal: 'cuidado_personal',
  'cuidado-personal': 'cuidado_personal',
  cuidado_personal: 'cuidado_personal',
  // Others
  others: 'otros', other: 'otros', otros: 'otros', otro: 'otros', misc: 'otros',
}

function normalizeCategoriaKey(raw: string | null | undefined): string {
  if (!raw) return ''
  let s = String(raw).trim().toLowerCase()
  // Strip diacritics (á → a, ñ → n, etc.)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // Drop trailing punctuation + whitespace
  s = s.replace(/[\s.,;:!?\-_/\\]+$/g, '')
  // Collapse inner whitespace → single dash for synonym lookup
  const compact = s.replace(/\s+/g, '-')
  if (CATEGORIA_SYNONYMS[compact]) return CATEGORIA_SYNONYMS[compact]
  if (CATEGORIA_SYNONYMS[s]) return CATEGORIA_SYNONYMS[s]
  // No synonym match — use the cleaned slug (spaces → underscores) as the key
  return s.replace(/\s+/g, '_')
}

const CATEGORIA_LABELS: Record<string, string> = {
  salud: 'Salud',
  belleza: 'Belleza',
  limpieza: 'Limpieza',
  alimentos: 'Alimentos',
  bebidas: 'Bebidas',
  cuidado_personal: 'Cuidado personal',
  otros: 'Otros',
}

function displayCategoria(key: string): string {
  if (CATEGORIA_LABELS[key]) return CATEGORIA_LABELS[key]
  // Fallback: replace underscores with spaces and title-case first letter.
  const pretty = key.replace(/_/g, ' ').replace(/-/g, ' ')
  return pretty.charAt(0).toUpperCase() + pretty.slice(1)
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
  producto, onAdd, onOpenDetail,
}: {
  producto: Producto
  onAdd: (item: CartItem) => void
  /** Click on image or name opens the detail modal (BUG 4). */
  onOpenDetail: (p: Producto) => void
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
      {/* Image — click opens detail */}
      <button
        type="button"
        onClick={() => onOpenDetail(producto)}
        className="relative aspect-square flex-shrink-0 overflow-hidden bg-brand-stone text-left"
        aria-label={`Ver detalles de ${producto.nombre}`}
      >
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
            {displayCategoria(normalizeCategoriaKey(producto.categoria))}
          </span>
        )}
        <span className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-[10px] uppercase tracking-luxe px-2 py-1 rounded-full text-brand-navy flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <PackageOpen className="w-3 h-3" /> Ver
        </span>
        {agotado && (
          <div className="absolute inset-0 bg-brand-cream/80 backdrop-blur-[2px] flex items-center justify-center">
            <span className="font-serif italic text-brand-navy/70 text-lg">Agotado</span>
          </div>
        )}
      </button>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onOpenDetail(producto)}
            className="block text-left w-full"
          >
            <h3 className="font-serif text-[17px] leading-snug text-brand-navy line-clamp-2 min-h-[2.6rem] hover:text-brand-gold transition-colors">
              {producto.nombre}
            </h3>
          </button>
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
  stripe: {
    label: 'Tarjeta',
    tagline: 'Pago seguro con tarjeta crédito o débito vía Stripe',
    accent: 'bg-violet-50',
    ring: 'ring-violet-600',
    text: 'text-violet-800',
    Icon: CreditCard,
  },
  cheque: {
    label: 'Cheque',
    tagline: 'Paga con cheque — indica el número al confirmar',
    accent: 'bg-amber-50',
    ring: 'ring-amber-600',
    text: 'text-amber-800',
    Icon: FileCheck,
  },
  efectivo: {
    label: 'Efectivo',
    tagline: 'Paga en efectivo al recibir tu pedido',
    accent: 'bg-teal-50',
    ring: 'ring-teal-600',
    text: 'text-teal-800',
    Icon: Banknote,
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

// ── Payment Proof Upload ──────────────────────────────────────────────────────
// Uploads an image (Zelle screenshot / Cheque front photo) directly to the
// Supabase Storage bucket `payment-proofs` and returns the public URL via
// setValue. Validates MIME + 10KB ≤ size ≤ 5MB to stop empty/junk uploads.
function PaymentProofUpload({
  value, onChange, label, hint, accentClass,
}: {
  value: string
  onChange: (url: string) => void
  label: string
  hint: string
  /** Tailwind color class applied to the border + icon for the empty state,
   *  e.g. 'border-emerald-300 text-emerald-600'. */
  accentClass: string
}) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    // Client-side validation — the server double-checks, but we fail fast.
    if (!file.type.startsWith('image/')) {
      toast.error('Debe ser una imagen (JPG, PNG, HEIC)')
      return
    }
    if (file.size < 10 * 1024) {
      toast.error('La imagen es demasiado pequeña — ¿subiste el archivo correcto?')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Máximo 5 MB por imagen')
      return
    }
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
      const path = `comprobante-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type })
      if (error) throw error
      const { data: pub } = supabase.storage.from('payment-proofs').getPublicUrl(data.path)
      if (!pub?.publicUrl) throw new Error('No se pudo obtener URL pública')
      onChange(pub.publicUrl)
      toast.success('Comprobante adjuntado')
    } catch (err: any) {
      console.error('[PaymentProofUpload]', err)
      toast.error(err?.message ?? 'No se pudo subir el comprobante')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (value) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-3 flex items-start gap-3">
        <img src={value} alt="Comprobante" className="w-16 h-16 rounded-lg object-cover border border-stone-200" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-luxe text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Comprobante adjunto
          </p>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-brand-charcoal/60 hover:text-brand-navy underline break-all"
          >
            Ver imagen completa
          </a>
        </div>
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-[11px] uppercase tracking-wide text-rose-500 hover:text-rose-600"
        >
          Quitar
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`w-full rounded-xl border-2 border-dashed ${accentClass} px-4 py-5 text-center hover:bg-white/40 transition disabled:opacity-60`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 mx-auto mb-1 animate-spin" />
            <p className="text-[11px] uppercase tracking-luxe">Subiendo…</p>
          </>
        ) : (
          <>
            <Plus className="w-5 h-5 mx-auto mb-1" />
            <p className="text-[11px] uppercase tracking-luxe font-medium">{label}</p>
            <p className="text-[10px] mt-0.5 normal-case opacity-70">{hint}</p>
          </>
        )}
      </button>
    </div>
  )
}

// ── Confirmation Modal ────────────────────────────────────────────────────────
// Two-phase wizard:
//   Step A — pick payment method (cards + recap + Continue)
//   Step B — method-specific details + shipping/notes + Confirm
// Combined with the Cart drawer and Shipping modal outside this component, the
// full checkout feels like a 4-step flow (Carrito → Envío → Método → Pagar).
function ConfirmModal({
  items, open, onClose, onConfirm, loading, notas, setNotas, direccion, setDireccion,
  tipoPago, setTipoPago, numeroRef, setNumeroRef,
  proofUrl, setProofUrl,
  bancoNombre, setBancoNombre,
  rol, stripeEnabled,
  creditoAutorizado, creditoDisponible,
  empresaPayment,
  onBack, onClearCart,
  savedShippingInfo,
}: {
  items: CartItem[]; open: boolean; onClose: () => void; onConfirm: () => void
  loading: boolean; notas: string; setNotas: (v: string) => void
  direccion: string; setDireccion: (v: string) => void
  tipoPago: TipoPago; setTipoPago: (t: TipoPago) => void
  numeroRef: string; setNumeroRef: (v: string) => void
  proofUrl: string; setProofUrl: (v: string) => void
  /** Cheque only — issuing bank name (optional but encouraged). */
  bancoNombre: string; setBancoNombre: (v: string) => void
  rol: string
  stripeEnabled: boolean
  creditoAutorizado: boolean; creditoDisponible: number
  empresaPayment?: Props['empresaPayment']
  /** Called when the user clicks "← Editar datos de envío" to go back. */
  onBack: () => void
  /** Called when the user confirms clearing the cart. */
  onClearCart: () => void
  /** If provided, we show a "usar datos guardados" banner with these. */
  savedShippingInfo?: { nombre?: string; direccion?: string; ciudad?: string; telefono?: string } | null
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  // 'method' = step 3 (pick method), 'details' = step 4 (execute payment).
  const [step, setStep] = useState<'method' | 'details'>('method')
  // Reset step every time the modal re-opens, so back-to-cart-then-reopen
  // doesn't land on the wrong screen.
  useEffect(() => {
    if (open) setStep('method')
  }, [open])
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  // ── ROL-BASED METHOD FILTERING (SECURITY — MIRRORS BACKEND) ─────────────
  // comprador (online buyer):
  //   stripe + zelle + cheque. NO efectivo (no in-person delivery flow).
  // cliente (authorized B2B with credit):
  //   stripe + zelle + cheque + efectivo + credito (if authorized).
  //   Efectivo means "pago contra entrega" — Mache delivers and collects
  //   cash; the orden stays pendiente_verificacion until she confirms.
  // admin / vendedor: everything.
  const methods: TipoPago[] = (() => {
    if (rol === 'comprador') return ['stripe', 'zelle', 'cheque']
    if (rol === 'cliente') {
      const base: TipoPago[] = ['stripe', 'zelle', 'cheque', 'efectivo']
      if (creditoAutorizado) base.push('credito')
      return base
    }
    // admin / vendedor / conductor — full set
    const base: TipoPago[] = ['stripe', 'zelle', 'cheque', 'efectivo']
    if (creditoAutorizado) base.push('credito')
    return base
  })()

  const isMethodDisabled = (m: TipoPago) => {
    if (m === 'stripe' && !stripeEnabled) return true
    if (m === 'credito' && !creditoAutorizado) return true
    return false
  }

  // If the currently selected method is disabled (e.g. stripe not configured
  // or credito revoked), nudge to the first available option.
  useEffect(() => {
    if (isMethodDisabled(tipoPago)) {
      const firstAvailable = methods.find(m => !isMethodDisabled(m))
      if (firstAvailable) setTipoPago(firstAvailable)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods.join(','), tipoPago, stripeEnabled, creditoAutorizado])

  const meta = PAGO_METHODS[tipoPago]
  const creditoInsuficiente = tipoPago === 'credito' && total > creditoDisponible
  const zelleRefMissing = tipoPago === 'zelle' && !numeroRef.trim()
  const chequeRefMissing = tipoPago === 'cheque' && !numeroRef.trim()
  const refFaltante = zelleRefMissing || chequeRefMissing
  // Comprador must upload proof for zelle/cheque. Other rols aren't forced
  // by the UI (admin verifies before releasing), but we still offer the upload.
  const proofMissing =
    rol === 'comprador' &&
    (tipoPago === 'zelle' || tipoPago === 'cheque') &&
    !proofUrl
  const ctaDisabled = loading || creditoInsuficiente || refFaltante || proofMissing

  // Efectivo and other deferred-payment methods reuse the "Generar orden"
  // copy because the order lands in /ordenes pending Mache's processing —
  // it isn't a finalized payment at click time. Stripe is the only branch
  // that immediately settles, so it keeps "Pagar con tarjeta".
  const ctaLabel =
    tipoPago === 'stripe'   ? 'Pagar con tarjeta' :
    tipoPago === 'credito'  ? 'Generar orden — crédito' :
    tipoPago === 'zelle'    ? 'Generar orden — Zelle' :
    tipoPago === 'cheque'   ? 'Generar orden — cheque' :
                              'Generar orden — efectivo'

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

            {/* Header with step indicator */}
            <div className="shrink-0 px-7 pt-6 pb-4 border-b border-stone-200/80">
              {/* Top row: title + close */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">
                    Paso {step === 'method' ? '3' : '4'} de 4
                  </p>
                  <h2 className="font-serif text-2xl text-brand-navy mt-1">
                    {step === 'method' ? 'Método de pago' : 'Confirmar pedido'}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full text-brand-charcoal hover:bg-stone-100 transition"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Step dots — 4 phases: Carrito → Envío → Método → Confirmar */}
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-luxe text-brand-charcoal/60 overflow-x-auto">
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-brand-navy/40" /> Carrito
                </span>
                <ChevronRight className="w-3 h-3 text-brand-charcoal/30 shrink-0" />
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-brand-navy/40" /> Envío
                </span>
                <ChevronRight className="w-3 h-3 text-brand-charcoal/30 shrink-0" />
                <span className={`flex items-center gap-1.5 shrink-0 ${step === 'method' ? 'text-brand-navy font-medium' : ''}`}>
                  <span className={`w-2 h-2 rounded-full ${step === 'method' ? 'bg-brand-navy' : 'bg-brand-navy/40'}`} /> Método
                </span>
                <ChevronRight className="w-3 h-3 text-brand-charcoal/30 shrink-0" />
                <span className={`flex items-center gap-1.5 shrink-0 ${step === 'details' ? 'text-brand-navy font-medium' : ''}`}>
                  <span className={`w-2 h-2 rounded-full ${step === 'details' ? 'bg-brand-navy' : 'bg-brand-navy/40'}`} /> Confirmar
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">

              {/* Saved shipping summary — editable */}
              {savedShippingInfo?.direccion && (
                <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> Enviar a
                      </p>
                      {savedShippingInfo.nombre && (
                        <p className="font-serif text-sm text-brand-navy mt-1">{savedShippingInfo.nombre}</p>
                      )}
                      <p className="text-xs text-brand-charcoal/80 leading-snug mt-0.5">
                        {savedShippingInfo.direccion}
                        {savedShippingInfo.ciudad ? `, ${savedShippingInfo.ciudad}` : ''}
                      </p>
                      {savedShippingInfo.telefono && (
                        <p className="text-[11px] text-brand-charcoal/60 mt-1">Tel: {savedShippingInfo.telefono}</p>
                      )}
                    </div>
                    <button
                      onClick={onBack}
                      className="shrink-0 text-[10px] uppercase tracking-luxe text-brand-gold hover:text-brand-navy border-b border-brand-gold/40 hover:border-brand-navy pb-0.5 transition"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              )}

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

              {/* Payment method selector — shown on step 3 (method) only. */}
              {step === 'method' && (
                <div>
                  <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-3">
                    Elige cómo vas a pagar
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {methods.map(m => {
                      const mm = PAGO_METHODS[m]
                      const active = tipoPago === m
                      const disabled = isMethodDisabled(m)
                      const Icon = mm.Icon
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={disabled}
                          onClick={() => !disabled && setTipoPago(m)}
                          className={`relative text-left p-4 rounded-2xl border transition-all active:scale-[0.99] ${
                            disabled
                              ? 'bg-stone-50 border-stone-200 opacity-70 cursor-not-allowed'
                              : active
                              ? `${mm.accent} border-transparent ring-1 ${mm.ring} shadow-sm`
                              : 'bg-white border-stone-200 hover:border-brand-navy/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <Icon className={`w-4 h-4 ${active && !disabled ? mm.text : 'text-brand-charcoal/50'}`} />
                            <span className={`text-xs uppercase tracking-wide font-medium ${active && !disabled ? mm.text : 'text-brand-navy'}`}>
                              {mm.label}
                            </span>
                            {active && !disabled && <CheckCircle2 className={`w-3.5 h-3.5 ml-auto ${mm.text}`} />}
                            {disabled && (
                              <span className="ml-auto text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-stone-200 text-brand-charcoal/60">
                                Próximamente
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-brand-charcoal/70 leading-snug">
                            {disabled && m === 'stripe'
                              ? 'Pago con tarjeta estará disponible pronto.'
                              : disabled && m === 'credito'
                              ? 'Requiere línea de crédito autorizada por el vendedor.'
                              : mm.tagline}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Selected method recap — shown on step 4 (details) only. */}
              {step === 'details' && (() => {
                const mm = PAGO_METHODS[tipoPago]
                const Icon = mm.Icon
                return (
                  <div className={`rounded-2xl p-4 border ${mm.accent} border-transparent ring-1 ${mm.ring} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${mm.text}`} />
                      <div>
                        <p className={`text-xs uppercase tracking-wide font-medium ${mm.text}`}>{mm.label}</p>
                        <p className="text-[11px] text-brand-charcoal/70">{mm.tagline}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('method')}
                      className="text-[10px] uppercase tracking-luxe text-brand-gold hover:text-brand-navy border-b border-brand-gold/40 hover:border-brand-navy pb-0.5 transition"
                    >
                      Cambiar
                    </button>
                  </div>
                )
              })()}

              {/* Payment-method specific cards */}
              {step === 'details' && tipoPago === 'zelle' && (
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
                      <CopyRow label="Monto exacto" value={formatCurrency(total)} />
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white border border-rose-200 p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-600 leading-snug">
                        Zelle no disponible. Contacta al vendedor o usa otro método.
                      </p>
                    </div>
                  )}
                  <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
                    Transfiere el monto exacto a los datos arriba, luego sube el comprobante abajo.
                  </p>
                  <div>
                    <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/70 mb-1.5">
                      Número de confirmación Zelle <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={numeroRef}
                      onChange={e => setNumeroRef(e.target.value)}
                      placeholder="Ej. ABC123XYZ"
                      className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 bg-white text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy transition"
                    />
                    {zelleRefMissing && (
                      <p className="text-[11px] text-rose-500 mt-1.5">Requerido para verificar tu pago.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/70 mb-1.5">
                      Captura de pantalla del pago
                      {rol === 'comprador' && <span className="text-rose-500"> *</span>}
                    </label>
                    <PaymentProofUpload
                      value={proofUrl}
                      onChange={setProofUrl}
                      label="Adjuntar captura"
                      hint="JPG o PNG · máx. 5 MB"
                      accentClass="border-emerald-300 text-emerald-700"
                    />
                    {proofMissing && tipoPago === 'zelle' && (
                      <p className="text-[11px] text-rose-500 mt-1.5">
                        Requerida para confirmar el pago por Zelle.
                      </p>
                    )}
                  </div>

                  <p className="text-[11px] text-brand-charcoal/70 leading-relaxed">
                    Al confirmar, tu orden queda pendiente. Verificaremos el pago y la aprobaremos.
                  </p>
                </div>
              )}

              {step === 'details' && tipoPago === 'cheque' && (
                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5 space-y-3">
                  <p className="text-[10px] uppercase tracking-luxe text-amber-700 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5" /> Pago con cheque
                  </p>
                  <p className="text-[11px] text-brand-charcoal/80 leading-relaxed">
                    Sube la foto del cheque ya firmado. Procesaremos el pedido cuando recibamos el cheque físico.
                  </p>

                  {empresaPayment?.direccion_envio_cheques && (
                    <div className="rounded-xl bg-white border border-amber-200 p-3 space-y-1">
                      <p className="text-[10px] uppercase tracking-luxe text-amber-700">Envía el cheque a:</p>
                      <p className="text-xs text-brand-navy leading-snug">
                        {empresaPayment.direccion_envio_cheques}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/70 mb-1.5">
                      Número de cheque <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={numeroRef}
                      onChange={e => setNumeroRef(e.target.value)}
                      placeholder="Ej. 1024"
                      inputMode="numeric"
                      className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 bg-white text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy transition"
                    />
                    {chequeRefMissing && (
                      <p className="text-[11px] text-rose-500 mt-1.5">Requerido para registrar el pago.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/70 mb-1.5">
                      Banco emisor <span className="normal-case text-brand-charcoal/40 tracking-normal">(opcional)</span>
                    </label>
                    <input
                      value={bancoNombre}
                      onChange={e => setBancoNombre(e.target.value)}
                      placeholder="Ej. Chase, Bank of America"
                      className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 bg-white text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/70 mb-1.5">
                      Foto del frente del cheque
                      {rol === 'comprador' && <span className="text-rose-500"> *</span>}
                    </label>
                    <PaymentProofUpload
                      value={proofUrl}
                      onChange={setProofUrl}
                      label="Adjuntar foto del cheque"
                      hint="JPG o PNG · máx. 5 MB"
                      accentClass="border-amber-300 text-amber-700"
                    />
                    {proofMissing && tipoPago === 'cheque' && (
                      <p className="text-[11px] text-rose-500 mt-1.5">
                        Requerida para confirmar el cheque.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 'details' && tipoPago === 'efectivo' && (
                <div className="rounded-2xl border border-teal-200/60 bg-teal-50/50 p-5 space-y-2">
                  <p className="text-[10px] uppercase tracking-luxe text-teal-700 flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5" /> Pago en efectivo
                  </p>
                  <p className="text-[12px] text-brand-charcoal/80 leading-relaxed">
                    Pagarás al recibir tu pedido. Nuestro conductor confirmará el cobro al momento de la entrega.
                  </p>
                </div>
              )}

              {step === 'details' && tipoPago === 'stripe' && (
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

              {step === 'details' && tipoPago === 'credito' && (
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

              {/* Shipping address + notes — step 4 only */}
              {step === 'details' && (
                <>
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
                </>
              )}
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 px-7 py-5 border-t border-stone-200/80 bg-white space-y-2.5">
              {step === 'method' ? (
                <button
                  onClick={() => setStep('details')}
                  disabled={isMethodDisabled(tipoPago)}
                  className="w-full py-4 rounded-full text-[11px] uppercase tracking-luxe font-medium text-brand-cream bg-brand-navy hover:bg-brand-navy/90 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onConfirm}
                  disabled={ctaDisabled}
                  className={`w-full py-4 rounded-full text-[11px] uppercase tracking-luxe font-medium text-brand-cream flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                    tipoPago === 'stripe'
                      ? 'bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-600 hover:to-indigo-600'
                      : tipoPago === 'credito'
                      ? 'bg-amber-700 hover:bg-amber-600'
                      : tipoPago === 'cheque'
                      ? 'bg-amber-700 hover:bg-amber-600'
                      : tipoPago === 'efectivo'
                      ? 'bg-teal-700 hover:bg-teal-600'
                      : 'bg-brand-navy hover:bg-brand-navy/90'
                  }`}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
                    : <><meta.Icon className="w-4 h-4" /> {ctaLabel}</>
                  }
                </button>
              )}
              {/* Back + clear cart row */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={step === 'method' ? onBack : () => setStep('method')}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-brand-charcoal hover:text-brand-navy transition disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {step === 'method' ? 'Volver a datos de envío' : 'Cambiar método'}
                </button>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-rose-500 hover:text-rose-600 transition disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Vaciar carrito
                </button>
              </div>
            </div>

            {/* Clear cart confirmation */}
            {showClearConfirm && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-brand-navy/60 backdrop-blur-sm">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white rounded-3xl shadow-2xl max-w-sm mx-6 p-6 text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-6 h-6 text-rose-500" />
                  </div>
                  <h3 className="font-serif text-xl text-brand-navy mb-2">¿Vaciar carrito?</h3>
                  <p className="text-sm text-brand-charcoal/70 mb-5">
                    Se eliminarán todos los productos y tu orden actual no se enviará.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 py-2.5 rounded-full border border-stone-200 text-xs uppercase tracking-wide text-brand-charcoal hover:bg-stone-50 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => { setShowClearConfirm(false); onClearCart() }}
                      className="flex-1 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-xs uppercase tracking-wide text-white transition"
                    >
                      Vaciar
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
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

// ── Address Autocomplete (BUG 6) ────────────────────────────────────────────
// Uses OpenStreetMap Nominatim as a free alternative to Google Places.
// Per Nominatim's usage policy (1 req/sec, identify via User-Agent), we
// debounce to 300ms between keystrokes and send minimal queries.
//
// NOTE: If Google Places is preferred, set NEXT_PUBLIC_GOOGLE_PLACES_KEY
// and swap the fetcher — the rest of this component stays the same.
type AddressSuggestion = { display_name: string; lat?: string; lon?: string }

function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSelect?: (suggestion: AddressSuggestion) => void
  placeholder?: string
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!focused || value.trim().length < 3) {
      setSuggestions([])
      return
    }
    const q = value.trim()
    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        const url = new URL('https://nominatim.openstreetmap.org/search')
        url.searchParams.set('q', q)
        url.searchParams.set('format', 'json')
        url.searchParams.set('addressdetails', '1')
        url.searchParams.set('limit', '5')
        const res = await fetch(url.toString(), {
          signal: ctrl.signal,
          headers: { 'Accept-Language': 'es' },
        })
        if (!res.ok) return
        const data: AddressSuggestion[] = await res.json()
        setSuggestions(Array.isArray(data) ? data : [])
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.warn('[AddressAutocomplete]', err)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [value, focused])

  return (
    <div className="relative">
      <textarea
        rows={2}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy resize-none transition"
      />
      {focused && (suggestions.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-xl z-20 overflow-hidden max-h-64 overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-[11px] text-brand-charcoal/60">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando direcciones…
            </div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(s.display_name)
                onSelect?.(s)
                setSuggestions([])
              }}
              className="w-full text-left px-4 py-2.5 text-[12px] text-brand-navy hover:bg-brand-stone transition flex items-start gap-2 border-b border-stone-100 last:border-b-0"
            >
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brand-gold" />
              <span className="line-clamp-2">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shipping Form ─────────────────────────────────────────────────────────────
function ShippingForm({
  open, onClose, onSubmit, initial, submitting, showTipoCliente,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (values: ShippingFormValues) => void
  initial: ShippingFormValues
  submitting: boolean
  /** Only true on first-ever order. Returning users don't re-pick type. */
  showTipoCliente: boolean
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
                <p className="text-[10px] uppercase tracking-luxe text-brand-gold">Paso 2 de 3</p>
                <h2 className="font-serif text-2xl text-brand-navy mt-1">Datos de envío</h2>
                <p className="text-[12px] text-brand-charcoal/70 mt-1">
                  {showTipoCliente
                    ? 'Guardaremos esta información para futuros pedidos.'
                    : 'Actualiza tus datos si lo necesitas.'}
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
                <AddressAutocomplete
                  value={values.direccion}
                  onChange={(v) => set('direccion', v)}
                  onSelect={(s) => {
                    // If city is empty and the suggestion has address parts,
                    // try to auto-fill ciudad from the display_name's trailing part.
                    if (!values.ciudad.trim()) {
                      const parts = s.display_name.split(',').map(p => p.trim()).filter(Boolean)
                      // Heuristic: state/city is usually the last 2-4 components before country.
                      if (parts.length >= 3) {
                        set('ciudad', parts[Math.max(0, parts.length - 3)])
                      }
                    }
                  }}
                  placeholder="Empieza a escribir tu dirección…"
                />
                <p className="text-[10px] text-brand-charcoal/50 mt-1.5">
                  Sugerencias vía OpenStreetMap. Escribe al menos 3 letras.
                </p>
              </div>

              {showTipoCliente && (
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
              )}
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

// ── Category scroller (BUG 3) ──────────────────────────────────────────────
// Mobile-first horizontal scroller for category pills. Uses scroll-snap +
// hidden scrollbar + auto-scroll-into-view so the selected pill is always
// visible. Fades at the edges via a mask-image so the user knows there's
// more to swipe.
function CategoryScroller({
  categorias,
  selected,
  onSelect,
}: {
  categorias: { key: string; label: string }[]
  selected: string | null
  onSelect: (v: string | null) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // When the filter changes (e.g. a category is selected), scroll the
    // active pill into view. `inline: 'center'` keeps it centered on mobile.
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [selected])

  return (
    <div
      ref={scrollerRef}
      className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none flex-1 md:justify-end snap-x snap-mandatory [scroll-padding-inline:1rem]"
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        maskImage:
          'linear-gradient(to right, transparent, #000 12px, #000 calc(100% - 12px), transparent)',
      }}
    >
      <button
        ref={selected === null ? activeRef : undefined}
        onClick={() => onSelect(null)}
        className={`snap-start flex-shrink-0 text-[11px] uppercase tracking-luxe px-4 py-2 rounded-full border transition-all ${
          selected === null
            ? 'bg-brand-navy text-brand-cream border-brand-navy'
            : 'bg-transparent text-brand-charcoal border-stone-300 hover:border-brand-navy'
        }`}
      >
        Todo
      </button>
      {categorias.map(cat => {
        const isActive = selected === cat.key
        return (
          <button
            key={cat.key}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSelect(isActive ? null : cat.key)}
            className={`snap-start flex-shrink-0 text-[11px] uppercase tracking-luxe px-4 py-2 rounded-full border transition-all ${
              isActive
                ? 'bg-brand-navy text-brand-cream border-brand-navy'
                : 'bg-transparent text-brand-charcoal border-stone-300 hover:border-brand-navy'
            }`}
          >
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Product Detail Modal (BUG 4) ────────────────────────────────────────────
// Opened when the user clicks the product image or name. Shows full info:
// description, all presentations with stock, price selector, quantity, and
// a prominent "Añadir al carrito" button. Cart icon on the card still
// triggers the quick-add path.
function ProductDetailModal({
  producto,
  onClose,
  onAdd,
}: {
  producto: Producto | null
  onClose: () => void
  onAdd: (item: CartItem) => void
}) {
  const [selPres, setSelPres] = useState<Presentacion | null>(null)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    if (producto) {
      setSelPres(producto.presentaciones[0] ?? null)
      setQty(1)
    }
  }, [producto])

  if (!producto || !selPres) return null

  const agotado = selPres.stock <= 0
  const st = stockLabel(selPres.stock)

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
    onClose()
  }

  return (
    <AnimatePresence>
      {producto && (
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
            className="relative bg-brand-cream rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-2xl flex flex-col shadow-2xl overflow-hidden"
            style={{ maxHeight: '92vh' }}
          >
            <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-stone-300 z-10" />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 backdrop-blur text-brand-charcoal hover:bg-white transition"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex-1 overflow-y-auto grid sm:grid-cols-2">
              {/* Image */}
              <div className="relative aspect-square sm:aspect-auto sm:min-h-[360px] bg-brand-stone overflow-hidden">
                {producto.imagen_url ? (
                  <img
                    src={producto.imagen_url}
                    alt={producto.nombre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GradientPlaceholder nombre={producto.nombre} />
                )}
                {producto.categoria && (
                  <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-[10px] uppercase tracking-luxe font-medium px-2.5 py-1 rounded-full text-brand-charcoal">
                    {displayCategoria(normalizeCategoriaKey(producto.categoria))}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="p-6 sm:p-8 space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-luxe text-brand-gold mb-2">Detalle</p>
                  <h2 className="font-serif text-2xl sm:text-3xl text-brand-navy leading-tight">
                    {producto.nombre}
                  </h2>
                </div>

                {producto.descripcion && (
                  <p className="text-sm text-brand-charcoal/80 leading-relaxed">
                    {producto.descripcion}
                  </p>
                )}

                {/* Presentations */}
                <div>
                  <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-2">
                    Presentación
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {producto.presentaciones.map(pr => {
                      const active = selPres.id === pr.id
                      return (
                        <button
                          key={pr.id}
                          onClick={() => { setSelPres(pr); setQty(1) }}
                          className={`text-[11px] tracking-wide px-3 py-1.5 rounded-full border transition-all ${
                            active
                              ? 'bg-brand-navy text-brand-cream border-brand-navy'
                              : 'bg-transparent text-brand-charcoal border-stone-300 hover:border-brand-navy'
                          }`}
                        >
                          {pr.nombre}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Stock + price */}
                <div className="flex items-end justify-between pt-3 border-t border-stone-200/80">
                  <div>
                    <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">Precio</p>
                    <p className="font-serif text-3xl text-brand-navy leading-none mt-1 tabular-nums">
                      {formatCurrency(selPres.precio)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      <span className={`text-[11px] font-medium ${st.tone}`}>{st.text}</span>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center border border-stone-200 rounded-full overflow-hidden bg-white">
                    <button
                      disabled={agotado || qty <= 1}
                      onClick={() => setQty(q => Math.max(1, q - 1))}
                      className="w-9 h-9 flex items-center justify-center text-brand-charcoal/70 hover:bg-stone-50 disabled:opacity-30 transition"
                      aria-label="Disminuir"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-brand-navy tabular-nums">
                      {qty}
                    </span>
                    <button
                      disabled={agotado || qty >= selPres.stock}
                      onClick={() => setQty(q => Math.min(selPres.stock, q + 1))}
                      className="w-9 h-9 flex items-center justify-center text-brand-charcoal/70 hover:bg-stone-50 disabled:opacity-30 transition"
                      aria-label="Aumentar"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Code, unit meta */}
                <div className="text-[11px] text-brand-charcoal/60 space-y-1 pt-1">
                  {selPres.unidad && (
                    <p className="flex items-center gap-1.5"><Package className="w-3 h-3" /> Unidad: <span className="text-brand-charcoal">{selPres.unidad}</span></p>
                  )}
                  {(producto as any).codigo && (
                    <p className="flex items-center gap-1.5"><Info className="w-3 h-3" /> Código: <span className="font-mono text-brand-charcoal">{(producto as any).codigo}</span></p>
                  )}
                </div>

                <button
                  disabled={agotado}
                  onClick={handleAdd}
                  className="w-full flex items-center justify-center gap-2 bg-brand-navy hover:bg-brand-navy/90 disabled:bg-stone-200 disabled:text-stone-400 text-brand-cream text-[11px] uppercase tracking-luxe font-medium py-4 rounded-full transition-colors"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {agotado ? 'Agotado' : `Añadir ${qty} al carrito`}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// (Hero is now in TiendaLanding.tsx — replaced by the cinematic
// scroll-driven storefront. The previous editorial split-layout Hero
// was removed in the redesign.)

// ── Main TiendaClient ─────────────────────────────────────────────────────────
export default function TiendaClient({ profile, productos, clienteInfo, empresaPayment, stripeEnabled = false, clientStats }: Props) {
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

  // Default tipoPago respects rol + stripe availability. comprador without
  // stripe → zelle. Otherwise comprador → stripe, authorized → zelle.
  const [tipoPago, setTipoPago] = useState<TipoPago>(
    profile.rol === 'comprador' && stripeEnabled ? 'stripe' : 'zelle'
  )
  const [numeroRef, setNumeroRef] = useState('')
  // Uploaded proof URL (Zelle screenshot / Cheque front photo). Required for
  // comprador on zelle/cheque — enforced server-side in /api/tienda/pedido.
  const [proofUrl, setProofUrl] = useState<string>('')
  // Optional: cheque issuer bank name. Appended to the orden notas.
  const [bancoNombre, setBancoNombre] = useState<string>('')

  // BUG 4 — product detail modal state
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null)

  const [shipping, setShipping] = useState<ShippingFormValues>({
    nombre:       clienteInfo?.nombre       ?? profile.nombre ?? '',
    telefono:     clienteInfo?.telefono     ?? '',
    direccion:    clienteInfo?.direccion    ?? '',
    ciudad:       clienteInfo?.ciudad       ?? '',
    whatsapp:     clienteInfo?.whatsapp     ?? '',
    tipo_cliente: (clienteInfo?.tipo_cliente as TipoClienteForm) ?? 'persona_natural',
  })
  // BUG 5 — consider shipping "stored" when the DB already has the full
  // cliente profile (nombre + direccion + telefono + ciudad). Subsequent
  // checkouts skip the ShippingForm and pre-fill from the saved row.
  const hasStoredShipping = !!(
    clienteInfo?.nombre?.trim() &&
    clienteInfo?.telefono?.trim() &&
    clienteInfo?.direccion?.trim() &&
    clienteInfo?.ciudad?.trim()
  )
  const isShippingComplete = hasStoredShipping || !!(
    shipping.nombre.trim() && shipping.telefono.trim() &&
    shipping.direccion.trim() && shipping.ciudad.trim()
  )

  // BUG 2 — category normalization. Strips case, punctuation, diacritics,
  // collapses en/es synonyms, and returns a canonical label for the UI.
  const categorias = useMemo(() => {
    const byKey = new Map<string, string>() // key → display label
    productos.forEach(p => {
      if (!p.categoria) return
      const key = normalizeCategoriaKey(p.categoria)
      if (!key) return
      if (!byKey.has(key)) byKey.set(key, displayCategoria(key))
    })
    return Array.from(byKey.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
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
    if (categoria) {
      // Compare using the normalized key, so "Salud", "salud.", "Health"
      // all match the same filter button.
      list = list.filter(p => normalizeCategoriaKey(p.categoria ?? '') === categoria)
    }
    return list
  }, [productos, search, categoria])

  // Pulse counter — incremented every time addToCart fires. We feed it
  // into the cart button's animation `key` so each add re-runs the
  // pulse + badge bounce, even if the cart count is unchanged (e.g.
  // user adds the same SKU twice, only the cantidad increases).
  const [cartPulse, setCartPulse] = useState(0)

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
    setCartPulse(p => p + 1)
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
          numero_referencia:
            (tipoPago === 'zelle' || tipoPago === 'cheque')
              ? numeroRef.trim()
              : undefined,
          payment_proof_url:
            (tipoPago === 'zelle' || tipoPago === 'cheque') && proofUrl
              ? proofUrl
              : undefined,
          banco_nombre:
            tipoPago === 'cheque' && bancoNombre.trim()
              ? bancoNombre.trim()
              : undefined,
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
      setProofUrl('')
      router.push('/tienda/mis-pedidos')
      const msg =
        tipoPago === 'credito'  ? `Orden ${data.numero ?? ''} creada con crédito` :
        tipoPago === 'zelle'    ? `Orden ${data.numero ?? ''} enviada — confirma tu pago por Zelle` :
        tipoPago === 'cheque'   ? `Orden ${data.numero ?? ''} enviada — coordinaremos la entrega del cheque` :
        tipoPago === 'efectivo' ? `Orden ${data.numero ?? ''} enviada — paga al recibir` :
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

            {/* Cart — wrapper does a brief scale pulse each time the cart
                pulse key advances (i.e. every addToCart call). The badge
                inside also bumps via its own keyed animation so even
                quantity-only updates feel responsive. */}
            <motion.button
              key={`cart-pulse-${cartPulse}`}
              initial={false}
              animate={
                cartPulse > 0
                  ? { scale: [1, 1.08, 1] }
                  : { scale: 1 }
              }
              transition={{ duration: 0.35, ease: 'easeOut' }}
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-2 pl-4 pr-4 py-2.5 rounded-full bg-brand-navy text-brand-cream text-[11px] uppercase tracking-luxe hover:bg-brand-navy/90 transition active:scale-95"
              aria-label="Abrir carrito"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Carrito</span>
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    key={`badge-${cartPulse}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.25, 1] }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-brand-gold text-brand-navy text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ml-0.5"
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

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

      {/* ── Cinematic landing (Hero + Stats + Categories + Featured + How + CTA) ── */}
      <TiendaLanding profile={profile as any} productos={productos as any} clientStats={clientStats} />

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
            <CategoryScroller
              categorias={categorias}
              selected={categoria}
              onSelect={setCategoria}
            />
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
                <ProductCard
                  key={p.id}
                  producto={p}
                  onAdd={addToCart}
                  onOpenDetail={setDetailProduct}
                />
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
        <motion.button
          key={`mobile-cart-pulse-${cartPulse}`}
          initial={false}
          animate={cartPulse > 0 ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          onClick={() => setCartOpen(true)}
          className="relative flex flex-col items-center gap-1 py-1 text-brand-charcoal hover:text-brand-navy transition"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <motion.span
                key={`mobile-badge-${cartPulse}`}
                initial={false}
                animate={cartPulse > 0 ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
                className="absolute -top-1.5 -right-2 bg-brand-gold text-brand-navy text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
              >
                {cartCount > 9 ? '9+' : cartCount}
              </motion.span>
            )}
          </div>
          <span className="text-[9px] uppercase tracking-luxe">Carrito</span>
        </motion.button>
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
          // BUG 5: if the client already has shipping info stored on their
          // cliente row, skip the form and go straight to review.
          if (hasStoredShipping) {
            setConfirmOpen(true)
          } else if (!isShippingComplete) {
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
        // tipo_cliente only asked on the first-ever order (no stored cliente row)
        showTipoCliente={!clienteInfo?.tipo_cliente}
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
        proofUrl={proofUrl}
        setProofUrl={setProofUrl}
        bancoNombre={bancoNombre}
        setBancoNombre={setBancoNombre}
        rol={profile.rol}
        stripeEnabled={stripeEnabled}
        creditoAutorizado={creditoAutorizado}
        creditoDisponible={creditoDisponible}
        empresaPayment={empresaPayment}
        onBack={() => { setConfirmOpen(false); setShippingOpen(true) }}
        onClearCart={() => {
          setCart([])
          setConfirmOpen(false)
          setCartOpen(false)
          toast.success('Carrito vaciado')
        }}
        savedShippingInfo={hasStoredShipping ? {
          nombre: shipping.nombre,
          direccion: shipping.direccion,
          ciudad: shipping.ciudad,
          telefono: shipping.telefono,
        } : null}
      />

      <ProductDetailModal
        producto={detailProduct}
        onClose={() => setDetailProduct(null)}
        onAdd={addToCart}
      />

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        productos={productos}
      />
    </div>
  )
}
