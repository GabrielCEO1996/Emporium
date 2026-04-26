'use client'

/**
 * Microinteractions — global side-effects mounted once per /tienda session
 * to deliver Fase 8 polish:
 *
 *   • Tilt 3D en [data-tilt-card]: event delegation desde document. Mouse
 *     position dentro de la card → rotateX/Y máx 6deg + glow teal sutil.
 *     Vuelve a 0 al salir, con transition 0.4s ease-out-expo.
 *
 *   • Scroll reveal en [data-reveal]: IntersectionObserver, fadeIn +
 *     translateY(20px → 0) la primera vez que entra al viewport. Después
 *     deja de observar el elemento. No se repite al subir/bajar.
 *
 * Ambos se desactivan automáticamente con prefers-reduced-motion.
 *
 * Dejar este componente como side-effect-only (retorna null) y montarlo
 * cerca de la raíz del árbol — se mantiene vivo durante toda la sesión.
 */

import { useEffect } from 'react'

const TILT_MAX_DEG = 6
const TILT_PERSPECTIVE = 800
const TILT_RESET_TRANSITION = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.45s cubic-bezier(0.16, 1, 0.3, 1)'
const TILT_TRACK_TRANSITION = 'transform 0.08s linear'
const TILT_GLOW = '0 0 32px rgba(13, 148, 136, 0.12)'

export default function Microinteractions() {
  // ─── Tilt 3D event delegation ──────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let active: HTMLElement | null = null

    const setTilt = (card: HTMLElement, e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      const rotY = (x - 0.5) * (TILT_MAX_DEG * 2)
      const rotX = -(y - 0.5) * (TILT_MAX_DEG * 2)
      card.style.transform = `perspective(${TILT_PERSPECTIVE}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`
      card.style.boxShadow = TILT_GLOW
    }

    const onOver = (e: MouseEvent) => {
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tilt-card]')
      if (!card || card === active) return
      active = card
      card.style.transition = TILT_TRACK_TRANSITION
      card.style.willChange = 'transform'
      setTilt(card, e)
    }

    const onMove = (e: MouseEvent) => {
      if (!active) return
      // If pointer left the card (e.g. moved to a sibling), bail and let
      // mouseout reset us — but still update if we're still over it.
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tilt-card]')
      if (card === active) setTilt(active, e)
    }

    const onOut = (e: MouseEvent) => {
      if (!active) return
      const rt = e.relatedTarget as Element | null
      const to = rt ? rt.closest('[data-tilt-card]') : null
      if (to === active) return
      active.style.transition = TILT_RESET_TRANSITION
      active.style.transform = ''
      active.style.boxShadow = ''
      active.style.willChange = ''
      active = null
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseout', onOut)
    return () => {
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseout', onOut)
      // Reset any active card on unmount
      if (active) {
        active.style.transform = ''
        active.style.boxShadow = ''
        active.style.transition = ''
        active.style.willChange = ''
      }
    }
  }, [])

  // ─── Scroll reveal via IntersectionObserver ────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Force every reveal to its final state immediately so users with
      // reduce-motion don't see hidden content.
      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        el.classList.add('is-revealed')
      })
      return
    }

    // Observer fires once per element, then unobserves.
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
            obs.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px',
      },
    )

    // We re-scan the DOM on each effect mount AND when the user navigates
    // within the SPA — but since this component is mounted once at the top
    // of TiendaClient and stays alive, a single scan is enough for the
    // initial page. New cards added by filtering/searching also get
    // observed via a MutationObserver.
    const scan = () => {
      document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-revealed)').forEach((el) => {
        // Skip elements already being observed by checking a marker class.
        if (el.dataset.revealObserved === '1') return
        el.dataset.revealObserved = '1'
        obs.observe(el)
      })
    }
    scan()

    const mut = new MutationObserver(scan)
    mut.observe(document.body, { childList: true, subtree: true })

    return () => {
      obs.disconnect()
      mut.disconnect()
    }
  }, [])

  return null
}
