'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Per-segment error boundary for /clientes/[id]. If anything in the server
 * component or any child still throws despite our defensive defaults, this
 * gives Mache a recoverable, well-styled fallback instead of the generic
 * Next.js red-screen.
 *
 * `reset()` re-renders the segment — ideal for transient query errors.
 */
export default function ClienteDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log everything we can — in prod React mangles the message but we
    // still get the stack, name, digest, and the toString form of the
    // error object. This goes to the BROWSER console (not Vercel
    // server logs) since error.tsx is a client component, so anyone
    // debugging valen's profile can paste this into a bug report.
    try {
      console.group('[clientes/[id]] segment error')
      console.error('error:', error)
      console.error('error.message:', error?.message)
      console.error('error.name:', error?.name)
      console.error('error.stack:', error?.stack)
      console.error('error.digest:', error?.digest)
      console.error('error.toString:', String(error))
      console.error('JSON:', (() => {
        try { return JSON.stringify(error, Object.getOwnPropertyNames(error ?? {})) }
        catch { return '<not JSON-serializable>' }
      })())
      console.groupEnd()
    } catch (_ignored) {
      console.error('[clientes/[id]] segment error (logging itself failed):', error)
    }
  }, [error])

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-2xl mx-auto p-6 sm:p-10">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Clientes
        </Link>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold text-amber-900">
                No pudimos cargar este cliente
              </h1>
              <p className="mt-1 text-sm text-amber-800">
                Ocurrió un error al renderizar la ficha. Algunos datos opcionales
                pueden no estar disponibles. Intenta recargar — si el problema
                persiste, abre el cliente desde la lista nuevamente.
              </p>
              {error.digest && (
                <p className="mt-2 text-[11px] text-amber-700 font-mono">
                  ref: {error.digest}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reintentar
                </button>
                <Link
                  href="/clientes"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 transition-colors"
                >
                  Volver a la lista
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
