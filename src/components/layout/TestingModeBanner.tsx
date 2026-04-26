import { AlertTriangle } from 'lucide-react'
import { isTestingMode } from '@/lib/testing-mode'

// ─── TestingModeBanner ──────────────────────────────────────────────────────
// Sticky yellow banner que se muestra en TODAS las páginas del admin
// mientras NEXT_PUBLIC_IS_PRODUCTION !== 'true'. Sirve como reminder
// visual de que los datos no son de producción y se van a resetear
// antes de la entrega final.
//
// NO se muestra en /tienda — el cliente final no debe ver disclaimers
// internos. Esto se monta en (dashboard)/layout.tsx que solo cubre el
// panel admin.
//
// Server component — la decisión de renderizar o no es estática (solo
// depende de la env var), no necesita interactividad ni hidratar.
// ────────────────────────────────────────────────────────────────────────────

export default function TestingModeBanner() {
  if (!isTestingMode()) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-30 flex items-center justify-center gap-2 px-4 py-2 bg-amber-300 text-amber-950 border-b border-amber-500/40 text-sm font-semibold shadow-sm"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        🚧 MODO PRUEBA · Los datos se reiniciarán antes de la entrega
      </span>
    </div>
  )
}
