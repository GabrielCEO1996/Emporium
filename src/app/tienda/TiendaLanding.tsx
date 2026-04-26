'use client'

/**
 * TiendaLanding — landing del módulo /tienda (encima del catálogo real).
 *
 * Estructura final tras el trim de pre-Fase 5 (el cliente ya está logueado
 * y vino a comprar — fuera marketing):
 *   1. Hero — globo 3D + saludo personalizado + meta lateral
 *   2. Cómo funciona — tres pasos con cards glass sobre navy local
 *
 * Lo demás (catálogo real, sticky filters, carrito) lo monta TiendaClient
 * inmediatamente después de este componente, ya con su `id="catalogo"`
 * que recibe el smooth-scroll del CTA del hero.
 */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils'
import GlobeStage from './components/GlobeStage'
import PinOverlay from './components/PinOverlay'

// Lazy: three.js es pesado y la capa cósmica es puramente decorativa.
const SpaceBackground = dynamic(() => import('./components/SpaceBackground'), {
  ssr: false,
  loading: () => null,
})

// ─── Types ───────────────────────────────────────────────────────────────────

interface Producto {
  id: string
  codigo?: string | null
  nombre: string
  categoria?: string | null
  imagen_url?: string | null
  presentaciones?: Array<{
    id: string
    nombre?: string
    precio?: number
    stock?: number
  }>
}

interface Profile {
  id: string
  nombre?: string | null
  email?: string | null
}

interface ClientStats {
  pedidosPendientes: number
  pedidosTotales: number
  ultimaCompra: { fecha: string; total: number } | null
  productosNuevos: number
  /** B2B clientes with credit authorised. null for B2C compradores. */
  creditoDisponible: number | null
  /** profile.rol === 'cliente'. Used to pick B2B vs B2C meta column. */
  esB2B: boolean
}

interface Props {
  profile: Profile
  productos: Producto[]
  clientStats?: ClientStats
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pull a "first name" out of the profile. Tries:
 *   1. profile.nombre's first whitespace-separated word
 *   2. local-part of the email (split_part(email, '@', 1))
 *   3. fallback "amig@" so we never render an empty slot
 */
function firstNameFrom(profile: Profile): string {
  const fromName = (profile.nombre ?? '').trim().split(/\s+/)[0] ?? ''
  if (fromName.length >= 2) {
    return fromName.charAt(0).toUpperCase() + fromName.slice(1).toLowerCase()
  }
  const local = (profile.email ?? '').split('@')[0] ?? ''
  const cleaned = local.replace(/[._\d-]+/g, ' ').trim().split(/\s+/)[0] ?? ''
  if (cleaned.length >= 2) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
  }
  return 'amig@'
}

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

// ─── Stats copy helpers ──────────────────────────────────────────────────────

/** "1 pedido" / "N pedidos". Empty for 0 — caller decides what to show. */
function pluralPedidos(n: number): string {
  if (n <= 0) return ''
  return n === 1 ? '1 pedido en preparación' : `${n} pedidos en preparación`
}

/** "1 producto nuevo" / "M productos nuevos". Empty for 0. */
function pluralProductos(n: number): string {
  if (n <= 0) return ''
  return n === 1 ? '1 producto nuevo' : `${n} productos nuevos`
}

/** "hace 5 días" — date-fns con locale es, addSuffix:true. */
function relativeFromFecha(fechaISO: string): string {
  return formatDistanceToNow(new Date(fechaISO), {
    addSuffix: true,
    locale: es,
  })
}

/**
 * Build the hero subtitle copy from real stats. Covers six cases so the
 * sentence stays human regardless of which numbers happen to be zero.
 *
 *   N>0  M>0      → "Tienes N… y M…"
 *   N>0  M=0      → "Tienes N…"
 *   N=0  M>0  últ → "Tu última compra fue X. Hay M…"
 *   N=0  M=0  últ → "Tu última compra fue X."
 *   N=0  M>0  ∅   → "Hay M productos nuevos en el catálogo."
 *   N=0  M=0  ∅   → "Bienvenido al catálogo."
 */
function subtitleFor(stats: ClientStats | undefined): React.ReactNode {
  const pendientes = stats?.pedidosPendientes ?? 0
  const nuevos     = stats?.productosNuevos ?? 0
  const ultima     = stats?.ultimaCompra ?? null

  if (pendientes > 0 && nuevos > 0) {
    return (
      <>
        Tienes <strong>{pluralPedidos(pendientes)}</strong> y {pluralProductos(nuevos)} en
        el catálogo.
      </>
    )
  }
  if (pendientes > 0) {
    return (
      <>
        Tienes <strong>{pluralPedidos(pendientes)}</strong>. Te avisamos cuando salgan a
        ruta.
      </>
    )
  }
  if (ultima) {
    const cuando = relativeFromFecha(ultima.fecha)
    if (nuevos > 0) {
      return (
        <>
          Tu última compra fue <strong>{cuando}</strong>. Hay {pluralProductos(nuevos)} en
          el catálogo.
        </>
      )
    }
    return (
      <>
        Tu última compra fue <strong>{cuando}</strong>. Cuando quieras volver, estamos.
      </>
    )
  }
  if (nuevos > 0) {
    return <>Hay {pluralProductos(nuevos)} esperándote en el catálogo.</>
  }
  return <>Bienvenido al catálogo. Listo cuando quieras explorar.</>
}

// ─── Smooth scroll + force-top on mount ──────────────────────────────────────
// Combined into one effect so the scrollTo(0) fires BEFORE Lenis takes over
// (otherwise Lenis can re-anchor to whatever the browser had cached). Also
// strips any URL hash so the browser doesn't auto-anchor on hydrate.
function useLenisAndScrollTop() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Strip any hash so the browser doesn't restore an anchor target.
    if (window.location.hash) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
    }

    // 2. Disable browser's automatic scroll restoration for this navigation.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    // 3. Force native scroll to top synchronously, before Lenis attaches.
    window.scrollTo(0, 0)

    // 4. Boot Lenis async and re-anchor it to top once it's alive.
    let lenisInstance: { raf: (t: number) => void; on: (e: string, cb: unknown) => void; scrollTo: (x: number, opts?: { immediate?: boolean }) => void; destroy?: () => void } | null = null
    let rafId: number | null = null
    let cancelled = false

    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return
      lenisInstance = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      }) as unknown as typeof lenisInstance
      lenisInstance?.scrollTo(0, { immediate: true })

      const raf = (time: number) => {
        lenisInstance?.raf(time)
        rafId = requestAnimationFrame(raf)
      }
      rafId = requestAnimationFrame(raf)

      lenisInstance?.on('scroll', ScrollTrigger.update)
      gsap.ticker.add((t: number) => lenisInstance?.raf(t * 1000))
      gsap.ticker.lagSmoothing(0)
    })

    return () => {
      cancelled = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      lenisInstance?.destroy?.()
    }
  }, [])
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TiendaLanding({ profile, clientStats }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLenisAndScrollTop()

  const firstName = firstNameFrom(profile)
  const fechaHoy = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const pedidosPendientes = clientStats?.pedidosPendientes ?? 0
  const pedidosTotales    = clientStats?.pedidosTotales ?? 0
  const ultimaCompra      = clientStats?.ultimaCompra ?? null
  const creditoDisponible = clientStats?.creditoDisponible ?? null
  const showCredito       = creditoDisponible !== null

  // CTA badge: "(N)" only when there's something to point at.
  const misPedidosLabel = pedidosPendientes > 0
    ? `Mis pedidos (${pedidosPendientes})`
    : 'Mis pedidos'

  return (
    <div ref={rootRef} className="tienda-landing-root">
      {/* Cosmic depth — fixed behind everything (z-index 0). The non-hero
          sections live at z-index 1 so their solid backgrounds paint over
          the cosmos when scrolled into view. */}
      <SpaceBackground />

      {/* ════════════════════════════════════════════════════════════════════
          1. HERO — globo 3D + saludo personalizado
          Fase 5 conectará el subtitle/meta a Supabase real (pedidos, crédito,
          última factura, productos nuevos 30d).
          ════════════════════════════════════════════════════════════════════ */}
      <section className="tienda-hero">
        <GlobeStage />
        <PinOverlay />

        <div className="tienda-hero-content">
          <div className="tienda-hero-eyebrow">Hola · {fechaHoy}</div>
          <h1 className="tienda-hero-title">
            Bienvenido,
            <br />
            <em>{firstName}.</em>
          </h1>
          <p className="tienda-hero-subtitle">{subtitleFor(clientStats)}</p>
          <div className="tienda-hero-actions">
            <a href="#catalogo" className="tienda-cta-primary">
              Ver catálogo
              <svg className="arrow" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 7H13M13 7L7 1M13 7L7 13"
                  stroke="currentColor"
                  strokeWidth="0.8"
                />
              </svg>
            </a>
            <Link href="/tienda/mis-pedidos" className="tienda-cta-secondary">
              {misPedidosLabel}
            </Link>
          </div>
        </div>

        {/* Hero meta column — top slot toggles between credit (B2B with auth)
            and total orders (B2C / B2B without credit). Bottom slot is the
            last invoice; if there's none yet we show a single first-time
            line instead of empty divider+placeholder. */}
        <aside className="tienda-hero-meta">
          {showCredito ? (
            <>
              <div className="tienda-hero-meta-label">Crédito disponible</div>
              <div className="tienda-hero-meta-value">
                {formatCurrency(creditoDisponible ?? 0)}
              </div>
            </>
          ) : (
            <>
              <div className="tienda-hero-meta-label">Pedidos realizados</div>
              <div className="tienda-hero-meta-value">
                {pedidosTotales}{' '}
                {pedidosTotales > 0 && (
                  <em>{pedidosTotales === 1 ? 'pedido' : 'pedidos'}</em>
                )}
              </div>
            </>
          )}

          {ultimaCompra ? (
            <>
              <div className="tienda-hero-meta-divider" />
              <div className="tienda-hero-meta-label">Última compra</div>
              <div className="tienda-hero-meta-value">
                {relativeFromFecha(ultimaCompra.fecha)}{' '}
                <em>{formatCurrency(ultimaCompra.total)}</em>
              </div>
            </>
          ) : (
            <>
              <div className="tienda-hero-meta-divider" />
              <div className="tienda-hero-meta-label">Tu primera vez</div>
              <div className="tienda-hero-meta-value">
                Empezamos juntos
              </div>
            </>
          )}
        </aside>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          2. CÓMO FUNCIONA — tres pasos, paleta espacial sobre navy local
          La sección tiene su propio bg navy oscuro que tapa el SpaceBackground
          al scrollearla. Cards glass con borde teal-soft.
          ════════════════════════════════════════════════════════════════════ */}
      <HowItWorksSection />
    </div>
  )
}

// ─── How it works ────────────────────────────────────────────────────────────

const STEPS: Array<{ num: string; title: string; copy: string }> = [
  {
    num: '01',
    title: 'Explora',
    copy:
      'Recorre el catálogo. Filtros por categoría, búsqueda por nombre o código de barras. Sin distracciones.',
  },
  {
    num: '02',
    title: 'Elige',
    copy:
      'Agrega productos al carrito. Te mostramos el precio aplicable a tu cuenta y el stock disponible al instante.',
  },
  {
    num: '03',
    title: 'Recibe',
    copy:
      'Confirma el pedido. Coordinamos entrega en 24 horas o pago contra entrega si tu cuenta lo autoriza.',
  },
]

function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!stepsRef.current) return
      gsap.from(stepsRef.current.querySelectorAll('[data-step]'), {
        y: 40,
        opacity: 0,
        stagger: 0.15,
        duration: 0.9,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: stepsRef.current,
          start: 'top 75%',
        },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="tienda-howitworks">
      <div className="tienda-howitworks-container">
        <div className="tienda-howitworks-heading">
          <p className="tienda-howitworks-eyebrow">Proceso</p>
          <h2 className="tienda-howitworks-title">
            Cómo <em>funciona</em>.
          </h2>
          <p className="tienda-howitworks-lead">Tres pasos. Sin fricciones.</p>
        </div>

        <div ref={stepsRef} className="tienda-howitworks-steps">
          {STEPS.map((s) => (
            <article key={s.num} data-step className="tienda-howitworks-card">
              <p className="tienda-howitworks-num">{s.num}</p>
              <h3 className="tienda-howitworks-step-title">{s.title}</h3>
              <p className="tienda-howitworks-copy">{s.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
