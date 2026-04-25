'use client'

/**
 * GlobeStage — Client wrapper que decide entre el Canvas 3D (desktop) y
 * el fallback SVG estático (mobile / reduce-motion).
 *
 * Two reasons we need this wrapper:
 *   1. Globe.tsx uses Three.js APIs that touch `document` / `window` on
 *      construction (canvas-generated textures, mouse listeners). Loading
 *      it via next/dynamic({ ssr: false }) avoids both SSR errors and
 *      shipping ~600KB of three+drei to clients that won't render it.
 *   2. On hover-less / pointer-coarse devices we replace the entire 3D
 *      scene with a static SVG placeholder — same composition, zero GPU.
 */

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const Globe = dynamic(() => import('./Globe'), {
  ssr: false,
  loading: () => null,
})

function useUse3D(): boolean {
  // Initial value matches SSR: assume we will use 3D so layout doesn't
  // shift when the user IS on desktop. On hydration we re-check and
  // downgrade to fallback if the user is on a coarse pointer / reduce
  // motion device.
  const [use3D, setUse3D] = useState(true)

  useEffect(() => {
    const evaluate = () => {
      const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const wide = window.matchMedia('(min-width: 768px)').matches
      setUse3D(fineHover && wide && !reduceMotion)
    }
    evaluate()

    const mq = window.matchMedia('(min-width: 768px)')
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', evaluate)
    mqMotion.addEventListener('change', evaluate)
    return () => {
      mq.removeEventListener('change', evaluate)
      mqMotion.removeEventListener('change', evaluate)
    }
  }, [])

  return use3D
}

// ─── Mobile fallback ─────────────────────────────────────────────────────
// Static SVG that mimics the globe — navy ocean, cream continents on a
// teal halo. Sized + positioned identically to the 3D scene so the
// surrounding layout (Hero text on the left, PinOverlay) lines up.
function StaticGlobeFallback() {
  return (
    <div className="tienda-globe-fallback" aria-hidden="true">
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        {/* Atmosphere halo — radial fade from teal to transparent */}
        <defs>
          <radialGradient id="tienda-globe-halo" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#0D9488" stopOpacity="0" />
            <stop offset="85%" stopColor="#0D9488" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="190" fill="url(#tienda-globe-halo)" />
        {/* Ocean */}
        <circle cx="200" cy="200" r="150" fill="#1E3A5F" />
        {/* Approximate continents — same shapes simplified */}
        <g fill="#fafaf7">
          <path d="M120 130 Q140 120 165 130 Q185 140 180 165 Q175 185 155 195 Q135 200 120 195 Q100 185 105 160 Q105 140 120 130 Z" />
          <path d="M155 220 Q170 215 180 230 Q188 255 180 280 Q170 305 158 305 Q146 295 148 270 Q150 240 155 220 Z" />
          <path d="M225 130 Q255 130 270 145 Q280 165 265 180 Q235 185 220 175 Q215 155 225 130 Z" />
          <path d="M240 195 Q260 195 275 220 Q280 250 270 280 Q255 295 240 280 Q235 250 240 220 Q240 200 240 195 Z" />
        </g>
        {/* Chicago HQ marker */}
        <circle cx="170" cy="155" r="4" fill="#5EBFB6" />
        <circle cx="170" cy="155" r="9" fill="none" stroke="#0D9488" strokeWidth="1" opacity="0.6" />
      </svg>
    </div>
  )
}

export default function GlobeStage() {
  const use3D = useUse3D()
  return use3D ? <Globe /> : <StaticGlobeFallback />
}
