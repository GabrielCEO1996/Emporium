'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  facturaId: string
  facturaNumero: string
  isAdmin: boolean
}

export default function EliminarFacturaButton({ facturaId, facturaNumero, isAdmin }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [canDelete, setCanDelete] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!showConfirm) {
      setCountdown(3)
      setCanDelete(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          setCanDelete(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [showConfirm])

  if (!isAdmin) return null

  const handleDelete = async () => {
    if (!canDelete || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/facturas/${facturaId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar')
      toast.success(`Factura ${facturaNumero} eliminada`)
      router.push('/facturas')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado')
      setLoading(false)
    }
  }

  const close = () => setShowConfirm(false)
  const CIRCUMFERENCE = 2 * Math.PI * 8

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
        Eliminar
      </button>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => e.target === e.currentTarget && close()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">¿Eliminar factura?</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Se eliminará permanentemente la factura{' '}
                    <strong>{facturaNumero}</strong> y todos sus artículos. Esta acción no se puede deshacer.
                  </p>

                  <div className="mt-5 flex gap-3 items-center">
                    <button
                      onClick={handleDelete}
                      disabled={!canDelete || loading}
                      className="relative flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {loading ? 'Eliminando...' : canDelete ? 'Sí, eliminar' : `Espera ${countdown}s…`}

                      {/* Circular countdown ring */}
                      {!canDelete && !loading && (
                        <svg
                          className="absolute -right-1.5 -top-1.5 h-5 w-5 -rotate-90 pointer-events-none"
                          viewBox="0 0 20 20"
                        >
                          <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                          <motion.circle
                            cx="10" cy="10" r="8"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeDasharray={CIRCUMFERENCE}
                            initial={{ strokeDashoffset: 0 }}
                            animate={{ strokeDashoffset: CIRCUMFERENCE }}
                            transition={{ duration: 3, ease: 'linear' }}
                          />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={close}
                      disabled={loading}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-60 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
