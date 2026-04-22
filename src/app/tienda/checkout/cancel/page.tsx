'use client'

import { motion } from 'framer-motion'
import { XCircle, ShoppingCart } from 'lucide-react'
import Link from 'next/link'

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center"
      >
        <XCircle className="w-14 h-14 text-slate-400" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Pago cancelado</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
          No se realizó ningún cargo. Tu carrito sigue intacto.
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
          className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 rounded-2xl transition"
        >
          <ShoppingCart className="w-4 h-4" />
          Volver al carrito
        </Link>
      </motion.div>
    </div>
  )
}
