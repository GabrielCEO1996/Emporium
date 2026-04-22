'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Emporium error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
        Algo salió mal
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 max-w-sm">
        {error.message || 'Ocurrió un error inesperado al cargar esta página.'}
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 font-mono mb-6">ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Reintentar
      </button>
    </div>
  )
}
