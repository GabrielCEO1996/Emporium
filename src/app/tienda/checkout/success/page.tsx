'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, ClipboardList, ShoppingBag, Loader2 } from 'lucide-react'
import Link from 'next/link'

// ─── /tienda/checkout/success ──────────────────────────────────────────────
// Landing page tras pago exitoso de Stripe.
//
// Antes: este page llamaba a /api/tienda/pedido para crear el pedido del
// lado del cliente — eso era el bypass viejo, porque cualquier cliente
// podía pegar la URL y crear pedidos sin pagar.
//
// Ahora: la creación del pedido la hace EXCLUSIVAMENTE el webhook
// /api/webhook/stripe al recibir checkout.session.completed con firma
// válida. Este page solo muestra "gracias" y limpia el cart de localStorage.
// ───────────────────────────────────────────────────────────────────────────

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [status, setStatus] = useState<'loading' | 'success'>('loading')

  useEffect(() => {
    // Limpieza del cart local — el pedido ya lo creó el webhook server-side.
    localStorage.removeItem('emporium_cart')
    localStorage.removeItem('emporium_stripe_cart')
    localStorage.removeItem('emporium_stripe_direccion')
    // Pequeño delay para que la animación no parpadee si el redirect es muy rápido.
    const t = setTimeout(() => setStatus('success'), 600)
    return () => clearTimeout(t)
  }, [sessionId])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <div className="text-center space-y-5">
          <Loader2 className="w-10 h-10 animate-spin text-brand-navy mx-auto" strokeWidth={1.5} />
          <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal">Procesando tu pago…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center gap-8 p-8 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 180 }}
        className="relative w-28 h-28"
      >
        <div className="absolute inset-0 rounded-full bg-brand-gold/20 animate-pulse" />
        <div className="absolute inset-2 rounded-full bg-brand-mint flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-700" strokeWidth={1.5} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-sm space-y-3"
      >
        <p className="text-[10px] uppercase tracking-luxe text-brand-gold">Pago confirmado</p>
        <h1 className="font-serif text-4xl text-brand-navy leading-tight">
          Gracias por tu pedido
        </h1>
        <p className="text-sm text-brand-charcoal/70 leading-relaxed">
          Tu pago fue procesado correctamente. En unos segundos verás tu pedido en
          <span className="font-semibold text-brand-navy"> Mis pedidos</span> con todos los detalles.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <Link
          href="/tienda/mis-pedidos"
          className="flex items-center justify-center gap-2 bg-brand-navy hover:bg-brand-navy/90 text-brand-cream text-[11px] uppercase tracking-luxe py-4 rounded-full transition"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Ver mis pedidos
        </Link>
        <Link
          href="/tienda"
          className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-luxe text-brand-charcoal hover:text-brand-navy transition py-3"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Seguir explorando
        </Link>
      </motion.div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-navy" strokeWidth={1.5} />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
