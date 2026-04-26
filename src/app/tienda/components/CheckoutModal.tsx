'use client'

/**
 * CheckoutModal — Fase E del refactor de checkout.
 *
 * Reemplaza al ConfirmModal monolítico viejo (que tenía un grid de
 * "métodos de pago" con un useEffect que silenciosamente cambiaba la
 * elección del cliente — ahí estaba el bypass que aprobó pedidos sin
 * pasar por Stripe).
 *
 * El modal nuevo tiene una máquina de estados explícita y por construcción
 * NO puede caer en un método distinto al que el usuario tocó:
 *
 *   Para rol 'cliente' (B2B autorizado):
 *     'choice'           → "Generar orden" o "Comprar ahora"
 *       ├─ Generar orden  → 'orden_details'  → POST /api/ordenes/crear
 *       └─ Comprar ahora  → 'pay_method'
 *                            ├─ Tarjeta → 'stripe_details' → /api/checkout/stripe
 *                            └─ Zelle   → 'zelle_details'  → /api/checkout/zelle
 *
 *   Para rol 'comprador' (B2C):
 *     'pay_method' (skip choice)
 *       ├─ Tarjeta → 'stripe_details' → /api/checkout/stripe
 *       └─ Zelle   → 'zelle_details'  → /api/checkout/zelle
 *
 * No hay rama "tipo_pago se decide silenciosamente". Cada CTA invoca un
 * handler único pasado por el padre, que llama exactamente UN endpoint.
 *
 * Métodos eliminados del UI: efectivo, cheque, crédito directo. El
 * crédito y método de pago "real" se decide en facturación al despachar
 * (la orden B2B "Generar orden" no decide método).
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronRight, ChevronLeft, Loader2, MapPin, AlertCircle, CheckCircle2,
  CreditCard, Wallet, Trash2, ShoppingBag, Package2, ClipboardList, Sparkles,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface CartItem {
  presentacionId: string
  productoNombre: string
  presentacionNombre: string
  precio: number
  cantidad: number
  imagenUrl?: string
  stock: number
}

type Step =
  | 'choice'          // cliente only — Generar orden vs Comprar ahora
  | 'pay_method'      // pick Tarjeta or Zelle
  | 'orden_details'   // confirm B2B orden (Generar orden)
  | 'stripe_details'  // confirm Stripe (Tarjeta)
  | 'zelle_details'   // confirm Zelle + referencia + comprobante

interface EmpresaPayment {
  zelle_numero?: string | null
  zelle_titular?: string | null
}

interface SavedShippingInfo {
  nombre?: string
  direccion?: string
  ciudad?: string
  telefono?: string
}

interface Props {
  /** Profile rol — drives initial step and which CTAs are visible. */
  rol: string
  /** Whether Stripe is configured server-side. If false, the Tarjeta
   *  button is disabled with a "Próximamente" tag. */
  stripeEnabled: boolean
  items: CartItem[]
  open: boolean
  onClose: () => void
  /** Click "Volver" en la primera pantalla — vuelve al ShippingForm. */
  onBack: () => void
  /** Click "Vaciar carrito" → llama esto y cierra el modal. */
  onClearCart: () => void

  loading: boolean
  notas: string;             setNotas: (v: string) => void
  direccion: string;         setDireccion: (v: string) => void
  numeroRef: string;         setNumeroRef: (v: string) => void
  proofUrl: string;          setProofUrl: (v: string) => void

  empresaPayment?: EmpresaPayment | null
  savedShippingInfo?: SavedShippingInfo | null

  // Three explicit handlers — uno por flow.
  onGenerarOrden:  () => void
  onComprarStripe: () => void
  onComprarZelle:  () => void

  /** Render-prop opcional para el upload del comprobante. El TiendaClient
   *  ya tiene el componente PaymentProofUpload con su lógica de Supabase
   *  Storage; lo pasamos como children-style para no duplicarlo. */
  renderProofUpload?: (props: {
    value: string
    onChange: (url: string) => void
  }) => React.ReactNode
}

export default function CheckoutModal({
  rol,
  stripeEnabled,
  items,
  open,
  onClose,
  onBack,
  onClearCart,
  loading,
  notas, setNotas,
  direccion, setDireccion,
  numeroRef, setNumeroRef,
  proofUrl, setProofUrl,
  empresaPayment,
  savedShippingInfo,
  onGenerarOrden,
  onComprarStripe,
  onComprarZelle,
  renderProofUpload,
}: Props) {
  // Initial step: 'choice' for cliente (puede generar orden B2B);
  // 'pay_method' para todos los demás (comprador siempre paga directo).
  const initialStep: Step = rol === 'cliente' ? 'choice' : 'pay_method'
  const [step, setStep] = useState<Step>(initialStep)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Reset on open so reabrir nunca aparezca en una pantalla intermedia.
  useEffect(() => {
    if (open) setStep(initialStep)
  }, [open, initialStep])

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  // Validations per step
  const zelleRefMissing = step === 'zelle_details' && numeroRef.trim().length < 6
  const zelleProofMissing = step === 'zelle_details' && !proofUrl

  const ctaDisabled =
    loading ||
    (step === 'zelle_details' && (zelleRefMissing || zelleProofMissing))

  const stepNumber = (
    step === 'choice' || step === 'pay_method' ? 3 :
    step === 'orden_details' ? 4 :
    step === 'stripe_details' ? 4 :
    /* zelle_details */ 4
  )

  const stepTitle = (
    step === 'choice'         ? '¿Cómo querés proceder?' :
    step === 'pay_method'     ? 'Elige cómo pagar' :
    step === 'orden_details'  ? 'Confirmar orden' :
    step === 'stripe_details' ? 'Confirmar pago con tarjeta' :
    /* zelle_details */         'Confirmar pago Zelle'
  )

  const handlePrimaryCTA = () => {
    if (step === 'orden_details')  onGenerarOrden()
    if (step === 'stripe_details') onComprarStripe()
    if (step === 'zelle_details')  onComprarZelle()
  }

  const handleBack = () => {
    if (step === 'orden_details') setStep('choice')
    else if (step === 'stripe_details' || step === 'zelle_details') setStep('pay_method')
    else if (step === 'pay_method' && rol === 'cliente') setStep('choice')
    else onBack()  // Volver al shipping form
  }

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
            <div className="shrink-0 px-7 pt-6 pb-4 border-b border-stone-200/80">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">
                    Paso {stepNumber} de 4
                  </p>
                  <h2 className="font-serif text-2xl text-brand-navy mt-1">{stepTitle}</h2>
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
                <span className={`flex items-center gap-1.5 shrink-0 ${stepNumber === 3 ? 'text-brand-navy font-medium' : ''}`}>
                  <span className={`w-2 h-2 rounded-full ${stepNumber === 3 ? 'bg-brand-navy' : 'bg-brand-navy/40'}`} /> Método
                </span>
                <ChevronRight className="w-3 h-3 text-brand-charcoal/30 shrink-0" />
                <span className={`flex items-center gap-1.5 shrink-0 ${stepNumber === 4 ? 'text-brand-navy font-medium' : ''}`}>
                  <span className={`w-2 h-2 rounded-full ${stepNumber === 4 ? 'bg-brand-navy' : 'bg-brand-navy/40'}`} /> Confirmar
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">

              {/* Saved shipping summary */}
              {savedShippingInfo?.direccion && step !== 'choice' && step !== 'pay_method' && (
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

              {/* Items summary — visible en todos los pasos */}
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

              <div className="flex items-end justify-between pt-4 border-t border-stone-200/80">
                <span className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">Total</span>
                <span className="font-serif text-3xl text-brand-navy">{formatCurrency(total)}</span>
              </div>

              {/* ── Step: choice (cliente only) ───────────────────────── */}
              {step === 'choice' && (
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">
                    Elige el flujo
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep('orden_details')}
                    className="group w-full text-left rounded-2xl border-2 border-teal-600 bg-teal-50/60 hover:bg-teal-50 transition p-5 flex items-start gap-4"
                  >
                    <ClipboardList className="w-6 h-6 text-teal-700 shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-[18px] text-brand-navy">Generar orden</p>
                      <p className="text-[12px] text-brand-charcoal/75 leading-snug mt-1">
                        Mache o Valen revisa y aprueba. El método de pago lo decidimos
                        cuando despachemos. <span className="text-teal-700 font-medium">Recomendado para clientes.</span>
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-teal-700 shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('pay_method')}
                    className="group w-full text-left rounded-2xl border-2 border-stone-200 bg-white hover:border-brand-navy transition p-5 flex items-start gap-4"
                  >
                    <Sparkles className="w-6 h-6 text-brand-navy shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-[18px] text-brand-navy">Comprar ahora</p>
                      <p className="text-[12px] text-brand-charcoal/75 leading-snug mt-1">
                        Pago directo con tarjeta o Zelle. Sin esperar aprobación.
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-brand-navy shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

              {/* ── Step: pay_method ──────────────────────────────────── */}
              {step === 'pay_method' && (
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">
                    ¿Cómo vas a pagar?
                  </p>
                  <button
                    type="button"
                    disabled={!stripeEnabled}
                    onClick={() => stripeEnabled && setStep('stripe_details')}
                    className={`group w-full text-left rounded-2xl border-2 transition p-5 flex items-start gap-4 ${
                      stripeEnabled
                        ? 'border-violet-600 bg-violet-50/60 hover:bg-violet-50 cursor-pointer'
                        : 'border-stone-200 bg-stone-50 cursor-not-allowed opacity-70'
                    }`}
                  >
                    <CreditCard className={`w-6 h-6 shrink-0 mt-1 ${stripeEnabled ? 'text-violet-700' : 'text-brand-charcoal/40'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-serif text-[18px] text-brand-navy">Tarjeta</p>
                        {!stripeEnabled && (
                          <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-stone-200 text-brand-charcoal/60">
                            Próximamente
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-brand-charcoal/75 leading-snug mt-1">
                        Pago seguro con Stripe. Crédito o débito. Tu pedido se activa automáticamente cuando se procesa.
                      </p>
                    </div>
                    {stripeEnabled && (
                      <ChevronRight className="w-5 h-5 text-violet-700 shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('zelle_details')}
                    className="group w-full text-left rounded-2xl border-2 border-emerald-600 bg-emerald-50/60 hover:bg-emerald-50 transition p-5 flex items-start gap-4"
                  >
                    <Wallet className="w-6 h-6 text-emerald-700 shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-[18px] text-brand-navy">Zelle</p>
                      <p className="text-[12px] text-brand-charcoal/75 leading-snug mt-1">
                        Transferí a nuestra cuenta y subí el comprobante. Confirmamos en minutos.
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-emerald-700 shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

              {/* ── Step: orden_details ───────────────────────────────── */}
              {step === 'orden_details' && (
                <div className="rounded-2xl border border-teal-200/60 bg-teal-50/50 p-5 space-y-2">
                  <p className="text-[10px] uppercase tracking-luxe text-teal-700 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5" /> Generar orden
                  </p>
                  <p className="text-[12px] text-brand-charcoal/80 leading-relaxed">
                    Tu orden quedará pendiente de aprobación. Mache o Valen la revisa
                    y, si todo está en orden, la convierten en pedido. <strong>El método
                    de pago se decide al despachar</strong> en la factura. Mientras
                    tanto, reservamos el inventario para tu orden.
                  </p>
                </div>
              )}

              {/* ── Step: stripe_details ──────────────────────────────── */}
              {step === 'stripe_details' && (
                <div className="rounded-2xl border border-violet-200/60 bg-violet-50/50 p-5 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-luxe text-violet-700 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Pago con tarjeta
                  </p>
                  <p className="text-[12px] text-brand-charcoal/80 leading-relaxed">
                    Al confirmar serás redirigido a la pasarela segura de Stripe.
                    Tu pedido se activa automáticamente cuando el pago se procese.
                    Si cerrás la pestaña sin pagar, no se cobra nada.
                  </p>
                </div>
              )}

              {/* ── Step: zelle_details ───────────────────────────────── */}
              {step === 'zelle_details' && (
                <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5 space-y-3">
                  <p className="text-[10px] uppercase tracking-luxe text-emerald-700 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Enviar pago por Zelle
                  </p>
                  {empresaPayment?.zelle_numero ? (
                    <div className="space-y-2.5 rounded-xl bg-white p-3 border border-stone-200">
                      <p className="text-[10px] uppercase tracking-wide text-brand-charcoal/60">Zelle</p>
                      <p className="font-mono font-semibold text-brand-navy text-sm">{empresaPayment.zelle_numero}</p>
                      {empresaPayment.zelle_titular && (
                        <>
                          <p className="text-[10px] uppercase tracking-wide text-brand-charcoal/60 pt-2 border-t border-stone-100">Titular</p>
                          <p className="text-sm text-brand-navy">{empresaPayment.zelle_titular}</p>
                        </>
                      )}
                      <p className="text-[10px] uppercase tracking-wide text-brand-charcoal/60 pt-2 border-t border-stone-100">Monto exacto</p>
                      <p className="text-sm text-brand-navy font-semibold tabular-nums">{formatCurrency(total)}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white border border-rose-200 p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-600 leading-snug">
                        Zelle no disponible. Contactá al vendedor o usá tarjeta.
                      </p>
                    </div>
                  )}
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
                      <p className="text-[11px] text-rose-600 mt-1">El número de confirmación debe tener al menos 6 caracteres.</p>
                    )}
                  </div>
                  {renderProofUpload && (
                    <div>
                      <label className="block text-[10px] uppercase tracking-luxe text-brand-charcoal/70 mb-1.5">
                        Captura del pago <span className="text-rose-500">*</span>
                      </label>
                      {renderProofUpload({ value: proofUrl, onChange: setProofUrl })}
                      {zelleProofMissing && (
                        <p className="text-[11px] text-rose-600 mt-1">Adjuntá una captura para que el equipo verifique el pago.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Shipping address + notes (steps 4) ────────────────── */}
              {(step === 'orden_details' || step === 'stripe_details' || step === 'zelle_details') && (
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
              {(step === 'choice' || step === 'pay_method') ? (
                // En step de selección no hay CTA primario — los botones de
                // elección dentro del body son los que progresan. Solo mostramos
                // navegación de back.
                <div className="text-center text-[11px] text-brand-charcoal/60">
                  Tocá una opción para continuar
                </div>
              ) : (
                <button
                  onClick={handlePrimaryCTA}
                  disabled={ctaDisabled}
                  className={`w-full py-4 rounded-full text-[11px] uppercase tracking-luxe font-medium text-brand-cream flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                    step === 'stripe_details'
                      ? 'bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-600 hover:to-indigo-600'
                      : step === 'zelle_details'
                      ? 'bg-emerald-700 hover:bg-emerald-600'
                      : 'bg-teal-700 hover:bg-teal-600'  // orden_details
                  }`}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
                  ) : step === 'stripe_details' ? (
                    <><CreditCard className="w-4 h-4" /> Pagar con tarjeta</>
                  ) : step === 'zelle_details' ? (
                    <><Wallet className="w-4 h-4" /> Confirmar pago Zelle</>
                  ) : (
                    <><ClipboardList className="w-4 h-4" /> Generar orden</>
                  )}
                </button>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-brand-charcoal hover:text-brand-navy transition disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {step === 'choice' || step === 'pay_method' ? 'Volver a datos de envío' : 'Cambiar'}
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
                    Se eliminarán todos los productos.
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
