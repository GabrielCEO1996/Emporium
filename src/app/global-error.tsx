'use client'

/**
 * Global error boundary — last line of defense.
 *
 * This fires when even the root layout throws. It must include its own
 * <html>/<body>. Keep styles inline so we don't depend on CSS that may
 * have failed to load.
 */
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FDFBF7',
            padding: '1rem',
          }}
        >
          <div
            style={{
              maxWidth: '28rem',
              width: '100%',
              background: '#fff',
              borderRadius: '1.5rem',
              padding: '2rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#0D9488',
                marginBottom: '0.5rem',
              }}
            >
              Algo salió mal
            </h2>
            <p style={{ color: '#4b5563', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Intentemos de nuevo. Si el problema persiste, contáctanos.
            </p>
            <button
              onClick={() => reset()}
              style={{
                background: '#0D9488',
                color: '#fff',
                padding: '0.625rem 1.25rem',
                borderRadius: '0.75rem',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
