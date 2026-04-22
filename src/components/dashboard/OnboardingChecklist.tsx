'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, X, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface Step {
  id: string
  label: string
  desc: string
  href: string
  done: boolean
}

interface Props {
  empresaDone: boolean
  productosDone: boolean
  clientesDone: boolean
  ventasDone: boolean
}

export default function OnboardingChecklist({ empresaDone, productosDone, clientesDone, ventasDone }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('emporium-onboarding-dismissed')
    if (!dismissed) setVisible(true)
  }, [])

  const steps: Step[] = [
    { id: 'empresa',   label: 'Configura tu empresa',  desc: 'Nombre, RIF, logo y datos de contacto', href: '/configuracion', done: empresaDone },
    { id: 'producto',  label: 'Agrega tu primer producto', desc: 'Crea un producto con precio y stock', href: '/productos/nuevo', done: productosDone },
    { id: 'cliente',   label: 'Registra un cliente',   desc: 'Ingresa el primer cliente o distribuidor', href: '/clientes/nuevo', done: clientesDone },
    { id: 'venta',     label: 'Realiza tu primera venta', desc: 'Crea un pedido o genera una factura', href: '/pedidos/nuevo', done: ventasDone },
  ]

  const doneCount = steps.filter(s => s.done).length
  const allDone = doneCount === steps.length
  const progress = (doneCount / steps.length) * 100

  const dismiss = () => {
    localStorage.setItem('emporium-onboarding-dismissed', '1')
    setVisible(false)
  }

  if (allDone || !visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25 }}
        className="mx-4 lg:mx-8 mt-4 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 dark:border-teal-800 p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">
                  Configura Emporium — {doneCount}/{steps.length} completado
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Completa estos pasos para empezar a gestionar tu negocio
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-teal-100 dark:bg-teal-900/40 rounded-full mb-4 overflow-hidden">
              <motion.div
                className="h-full bg-teal-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {steps.map(step => (
                <Link
                  key={step.id}
                  href={step.done ? '#' : step.href}
                  onClick={e => step.done && e.preventDefault()}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all group ${
                    step.done
                      ? 'opacity-60 cursor-default'
                      : 'hover:bg-white/60 dark:hover:bg-white/5 hover:shadow-sm'
                  }`}
                >
                  {step.done
                    ? <CheckCircle2 className="w-5 h-5 text-teal-500 flex-shrink-0" />
                    : <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 flex-shrink-0 group-hover:text-teal-400 transition-colors" />
                  }
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium leading-tight ${step.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{step.desc}</p>
                  </div>
                  {!step.done && <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-500 flex-shrink-0 transition-colors" />}
                </Link>
              ))}
            </div>
          </div>

          <button
            onClick={dismiss}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
