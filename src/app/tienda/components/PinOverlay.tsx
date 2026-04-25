'use client'

/**
 * PinOverlay — SVG layer that wraps the 3D globe like a location pin.
 *
 * Two stroked outlines (no fill) so the globo 3D sigue siendo visible
 * adentro. Posición fija superpuesta al canvas. En mobile el contorno
 * encoge y se centra (handled in tienda.css media query).
 */

export default function PinOverlay() {
  return (
    <div className="tienda-pin-overlay" aria-hidden="true">
      <svg viewBox="0 0 520 620" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="tienda-pin-soft-glow">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {/* Outer pin outline */}
        <path
          d="M260 30 C385 30, 470 115, 470 240 C470 360, 385 470, 260 590 C250 600, 240 600, 230 590 C105 470, 50 360, 50 240 C50 115, 135 30, 260 30 Z"
          fill="none"
          stroke="#0D9488"
          strokeWidth="2.5"
          strokeOpacity="0.55"
        />
        {/* Inner soft ring */}
        <path
          d="M260 50 C375 50, 450 125, 450 240 C450 350, 375 450, 260 565 C250 575, 240 575, 230 565 C115 450, 60 350, 60 240 C60 125, 145 50, 260 50 Z"
          fill="none"
          stroke="#5EBFB6"
          strokeWidth="1"
          strokeOpacity="0.35"
        />
      </svg>
    </div>
  )
}
