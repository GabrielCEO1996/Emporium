'use client'

/**
 * Tienda error boundary.
 *
 * Any uncaught error thrown in the `/tienda` route tree renders here
 * instead of the raw Next.js "Application error — a client-side
 * exception has occurred" message. This is the safety net for new
 * sign-ups where a profile row may not yet exist.
 */
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'

export default function TiendaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // In production this goes to Vercel logs via console.
    // eslint-disable-next-line no-console
    console.error('[tienda/error] uncaught', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream px-4">
      <div className="max-w-md w-full rounded-3xl bg-white shadow-xl p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-brand-navy mb-2">
          Algo salió mal
        </h2>
        <p className="text-sm text-brand-charcoal/70 mb-6">
          Estamos preparando tu catálogo. Si acabas de crear tu cuenta,
          espera unos segundos e intenta de nuevo. Nuestro equipo ya fue
          notificado.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-navy/90 transition-colors"
          >
            <RefreshCcw className="h-4 w-4" />
            Reintentar
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 rounded-xl border border-brand-navy/20 bg-white px-5 py-2.5 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5 transition-colors"
          >
            <Home className="h-4 w-4" />
            Ir al inicio
          </Link>
        </div>
        {error?.digest && (
          <p className="mt-6 text-[10px] text-brand-charcoal/40 font-mono">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
