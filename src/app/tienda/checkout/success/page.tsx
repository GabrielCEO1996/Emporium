'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, ClipboardList, ShoppingBag, Loader2 } from 'lucide-react'
import Link from 'next/link'

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [status, setStatus] = useState<'loading' | 'success'>('loading')
  const [orderNum, setOrderNum] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) { setStatus('success'); return }

    const cartRaw = localStorage.getItem('emporium_stripe_cart') ?? '[]'
    const direccion = localStorage.getItem('emporium_stripe_direccion') ?? ''

    fetch('/api/tienda/pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: JSON.parse(cartRaw),
        notas: `Pagado vía Stripe. Session: ${sessionId}`,
        direccion_entrega: direccion,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.numero) {
          setOrderNum(data.numero)
          localStorage.removeItem('emporium_stripe_cart')
          localStorage.removeItem('emporium_stripe_direccion')
        }
        setStatus('success')
      })
      .catch(() => setStatus('success'))
  }, [sessionId])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto" />
          <p className="text-slate-500 text-sm">Procesando tu pago...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center"
      >
        <CheckCircle2 className="w-14 h-14 text-emerald-500" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">¡Pago exitoso!</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
          {orderNum
            ? <>Tu pedido <span className="font-bold text-teal-600">{orderNum}</span> fue creado y está siendo procesado.</>
            : 'Tu pago fue procesado correctamente. Tu pedido está siendo preparado.'
          }
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
          className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 rounded-2xl transition"
        >
          <ClipboardList className="w-4 h-4" />
          Ver mis pedidos
        </Link>
        <Link
          href="/tienda"
          className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition py-2"
        >
          <ShoppingBag className="w-4 h-4" />
          Seguir comprando
        </Link>
      </motion.div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
