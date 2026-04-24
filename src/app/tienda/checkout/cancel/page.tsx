'use client'

import { motion } from 'framer-motion'
import { XCircle, ShoppingBag } from 'lucide-react'
import Link from 'next/link'

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center gap-8 p-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 180 }}
        className="w-24 h-24 rounded-full bg-stone-100 flex items-center justify-center"
      >
        <XCircle className="w-12 h-12 text-brand-charcoal/50" strokeWidth={1.5} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-sm space-y-3"
      >
        <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">Pago cancelado</p>
        <h1 className="font-serif text-3xl text-brand-navy leading-tight">
          Tu carrito sigue intacto
        </h1>
        <p className="text-sm text-brand-charcoal/70 leading-relaxed">
          No se realizó ningún cargo. Puedes volver al catálogo y continuar cuando estés listo.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <Link
          href="/tienda"
          className="flex items-center justify-center gap-2 bg-brand-navy hover:bg-brand-navy/90 text-brand-cream text-[11px] uppercase tracking-luxe py-4 rounded-full transition"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Volver al catálogo
        </Link>
      </motion.div>
    </div>
  )
}
