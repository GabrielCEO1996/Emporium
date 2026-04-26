'use client'

/**
 * CustomCursor — dot teal + ring navy con lerp delay (Fase 8).
 *
 * Solo se monta en pointers de tipo "fine" + "hover" (mouse de escritorio).
 * En touch/coarse devices retorna null inmediatamente, el cursor del SO
 * sigue intacto.
 *
 * Cuando se monta:
 *   1. Agrega `body.has-custom-cursor` → activa la regla `cursor:none` que
 *      ya existe en tienda.css.
 *   2. Renderiza dos divs fijos. Dot sigue al puntero instantáneo. Ring
 *      lerps con factor 0.18 (≈ 90ms para alcanzar el cursor).
 *   3. Detecta hover sobre <a>, <button>, [role=button], [data-cursor=hover]
 *      vía event delegation en document → ring crece a 56px, dot se oculta.
 *
 * Reduce-motion: el cursor sí se monta (lo dijo explícitamente el usuario),
 * pero el ring deja de lerp-ear y queda glued al dot — así el efecto no
 * marea a quien lo apaga.
 */

import { useEffect, useRef, useState } from 'react'

const HOVER_SELECTOR =
  'a, button, [role="button"], input[type="submit"], input[type="button"], [data-cursor-hover]'

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false)
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const evaluate = () => setEnabled(fineHover.matches)
    evaluate()

    fineHover.addEventListener('change', evaluate)
    return () => fineHover.removeEventListener('change', evaluate)
  }, [])

  useEffect(() => {
    if (!enabled) return
    document.body.classList.add('has-custom-cursor')

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dot = dotRef.current!
    const ring = ringRef.current!

    // Pointer position — mutated by mousemove, read each frame
    const cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const ringPos = { x: cursor.x, y: cursor.y }

    let rafId = 0

    const onMove = (e: MouseEvent) => {
      cursor.x = e.clientX
      cursor.y = e.clientY
    }

    const onOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest(HOVER_SELECTOR)
      if (target) {
        dot.classList.add('is-hover')
        ring.classList.add('is-hover')
      }
    }

    const onOut = (e: MouseEvent) => {
      const from = (e.target as HTMLElement | null)?.closest(HOVER_SELECTOR)
      const rt = e.relatedTarget as Element | null
      const to = rt ? rt.closest(HOVER_SELECTOR) : null
      if (from && from !== to) {
        dot.classList.remove('is-hover')
        ring.classList.remove('is-hover')
      }
    }

    const onLeave = () => {
      dot.style.opacity = '0'
      ring.style.opacity = '0'
    }
    const onEnter = () => {
      dot.style.opacity = '1'
      ring.style.opacity = '0.4'
    }

    const tick = () => {
      // Dot follows pointer instantly
      dot.style.transform = `translate3d(${cursor.x - 3}px, ${cursor.y - 3}px, 0)`

      if (reduceMotion) {
        // No lerp — ring sticks to pointer too
        ring.style.transform = `translate3d(${cursor.x - 18}px, ${cursor.y - 18}px, 0)`
      } else {
        // Lerp with factor 0.18 — feels like 90ms ease-out
        ringPos.x += (cursor.x - ringPos.x) * 0.18
        ringPos.y += (cursor.y - ringPos.y) * 0.18
        ring.style.transform = `translate3d(${ringPos.x - 18}px, ${ringPos.y - 18}px, 0)`
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('mouseenter', onEnter)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('mouseenter', onEnter)
      document.body.classList.remove('has-custom-cursor')
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <>
      <div ref={dotRef} className="tienda-cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="tienda-cursor-ring" aria-hidden="true" />
    </>
  )
}
