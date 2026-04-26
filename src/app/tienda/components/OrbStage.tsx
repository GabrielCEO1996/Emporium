'use client'

/**
 * OrbStage — wrapper client del IridescentOrb. Reemplaza a GlobeStage.
 *
 * Razones:
 *   1. IridescentOrb usa Three.js APIs que tocan window al construirse
 *      (mouse listeners, pixelRatio). next/dynamic({ ssr: false }) evita
 *      hydration errors y baja bundle inicial.
 *   2. En touch devices / pointer coarse / reduce motion → fallback
 *      SVG estático: gradient teal→navy + halos suaves. Mismo footprint
 *      visual, cero GPU.
 */

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const IridescentOrb = dynamic(() => import('./IridescentOrb'), {
  ssr: false,
  loading: () => null,
})

function useUse3D(): boolean {
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

// ─── Static fallback — gradient orb + halos blur ─────────────────────────
// Reemplaza el 3D con un disco SVG que evoca el orb iridiscente. Sin GPU.
function StaticOrbFallback() {
  return (
    <div className="tienda-orb-fallback" aria-hidden="true">
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Halo exterior — fade teal-soft a transparente */}
          <radialGradient id="tienda-orb-halo" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#0D9488" stopOpacity="0" />
            <stop offset="78%" stopColor="#0D9488" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0" />
          </radialGradient>
          {/* Cuerpo del orb — navy → teal-soft con shift sutil */}
          <radialGradient id="tienda-orb-body" cx="38%" cy="34%" r="65%">
            <stop offset="0%"  stopColor="#5EBFB6" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#0D9488" stopOpacity="0.85" />
            <stop offset="80%" stopColor="#1E3A5F" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0F2238" stopOpacity="1" />
          </radialGradient>
          {/* Highlight especular */}
          <radialGradient id="tienda-orb-spec" cx="35%" cy="28%" r="22%">
            <stop offset="0%" stopColor="#fafaf7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fafaf7" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Halo exterior */}
        <circle cx="200" cy="200" r="195" fill="url(#tienda-orb-halo)" />
        {/* Orb body */}
        <circle cx="200" cy="200" r="140" fill="url(#tienda-orb-body)" />
        {/* Specular highlight */}
        <circle cx="200" cy="200" r="140" fill="url(#tienda-orb-spec)" />
        {/* Edge ring teal sutil */}
        <circle cx="200" cy="200" r="140" fill="none" stroke="#5EBFB6" strokeWidth="0.5" strokeOpacity="0.35" />
      </svg>
    </div>
  )
}

export default function OrbStage() {
  const use3D = useUse3D()
  return use3D ? <IridescentOrb /> : <StaticOrbFallback />
}
