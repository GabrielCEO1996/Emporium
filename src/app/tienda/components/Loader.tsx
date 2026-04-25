'use client'

/**
 * Loader — Cinematic curtain mounted on the first visit of a session.
 *
 * Visual fidelity to emporium-tienda-hero.html:
 *   - Logo SVG (pin + globo + continentes) fades in at 0.2s
 *   - "EMPORIUM" tracked uppercase at 0.6s
 *   - Teal progress bar fills 1.0s → 2.4s
 *   - Curtain fades out 1.2s after the 2.4s mark
 *
 * Session gate: we use sessionStorage so the cinematic plays once per
 * tab/session. The initial render always shows the loader (so SSR and
 * first client paint match — no hydration mismatch). On mount, if the
 * flag is already set, we skip straight to the unmounted phase. The
 * flash is at most one frame in that case.
 */

import { useEffect, useState } from 'react'

const SESSION_FLAG = 'emporium_tienda_loader_v1'

type Phase = 'visible' | 'fading' | 'gone'

export default function Loader() {
  const [phase, setPhase] = useState<Phase>('visible')

  useEffect(() => {
    const alreadyShown =
      typeof window !== 'undefined' && window.sessionStorage.getItem(SESSION_FLAG)

    if (alreadyShown) {
      setPhase('gone')
      return
    }

    window.sessionStorage.setItem(SESSION_FLAG, '1')
    const fadeTimer = window.setTimeout(() => setPhase('fading'), 2400)
    const goneTimer = window.setTimeout(() => setPhase('gone'), 2400 + 1200)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(goneTimer)
    }
  }, [])

  if (phase === 'gone') return null

  return (
    <div
      className={`tienda-loader${phase === 'fading' ? ' is-done' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Cargando Emporium"
    >
      <svg
        className="tienda-loader-logo"
        viewBox="0 0 200 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Pin shadow */}
        <path
          d="M105 12 C148 12, 178 42, 178 86 C178 128, 148 168, 105 220 C100 226, 96 226, 91 220 C48 168, 18 128, 18 86 C18 42, 48 12, 91 12 Z"
          fill="#0D9488"
          opacity="0.45"
        />
        {/* Pin body */}
        <path
          d="M100 8 C143 8, 173 38, 173 82 C173 124, 143 164, 100 216 C95 222, 91 222, 86 216 C43 164, 13 124, 13 82 C13 38, 43 8, 86 8 Z"
          fill="#5EBFB6"
          stroke="#fafaf7"
          strokeWidth="3"
        />
        {/* Inner globe */}
        <circle cx="93" cy="86" r="46" fill="#1E3A5F" />
        {/* Continents (Norteamérica + Sudamérica + masa Atlántica) */}
        <path
          d="M75 60 Q72 58, 70 62 L68 68 Q66 72, 70 74 L74 78 L72 82 Q70 86, 74 86 L78 84 L82 88 L80 92 L84 96 Q88 96, 88 92 L86 88 L90 86 L94 90 L98 88 L100 92 L96 96 L94 100 L92 106 L96 110 L102 108 L104 112 L102 116 L106 120 L110 116 L112 110 L116 110 L118 106 L116 100 L114 96 L116 92 L114 86 L112 82 L116 78 L114 72 L108 70 L104 66 L98 64 L92 62 L86 60 L80 58 Z"
          fill="#fafaf7"
        />
        <path
          d="M120 80 Q124 78, 124 82 L122 86 L124 88 L122 92 L120 90 L118 86 L120 82 Z"
          fill="#fafaf7"
        />
        {/* Pin point shadow on ground */}
        <ellipse cx="93" cy="222" rx="22" ry="4" fill="#fafaf7" opacity="0.25" />
      </svg>
      <div className="tienda-loader-name">EMPORIUM</div>
      <div className="tienda-loader-progress" />
    </div>
  )
}
