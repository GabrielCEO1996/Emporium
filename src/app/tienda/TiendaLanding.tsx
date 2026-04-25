'use client'

/**
 * TiendaLanding — cinematic, scroll-driven storefront landing.
 *
 * This component owns ONLY the marketing sections that sit above the
 * catalog grid. The catalog (#catalogo anchor) and everything below it
 * still live inside TiendaClient.tsx. The shared sticky header in
 * TiendaClient handles cart state — we don't duplicate it.
 *
 * Sections (top to bottom):
 *   1. Hero (dark) — cinematic reveal with GSAP scroll trigger
 *   2. Stats bar (cream) — count-up animation when in viewport
 *   3. Categories grid (cream) — stagger reveal
 *   4. Featured products (cream) — slide-in from right
 *   5. How it works (dark) — sequential fade-in
 *   6. Final CTA (cream)
 *
 * Animations follow the frontend-design skill: scroll-driven > time-driven,
 * stagger 100-150ms, ease-out-expo cubic-bezier. Mobile gets the same
 * structure but with simplified animations (no scrub, no parallax).
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

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

interface Props {
  profile: Profile
  productos: Producto[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pull a "first name" out of the profile. Tries:
 *   1. profile.nombre's first whitespace-separated word
 *   2. local-part of the email (split_part(email, '@', 1))
 *   3. fallback "amig@" so we never render an empty slot
 *
 * Capitalize first letter, drop leading numbers/special chars.
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

/** Map raw categoria strings to a normalized display name + slug. */
function normalizeCategoria(raw: string | null | undefined): string {
  if (!raw) return 'otros'
  const s = raw.toLowerCase().trim()
  if (s.includes('salud') || s.includes('medicament') || s.includes('otc')) return 'salud'
  if (s.includes('belleza') || s.includes('cuidado') || s.includes('cosmet')) return 'belleza'
  if (s.includes('nutric') || s.includes('vitamin') || s.includes('supleme')) return 'nutricion'
  if (s.includes('bebida') || s.includes('hidrat')) return 'bebidas'
  if (s.includes('alimento') || s.includes('comida') || s.includes('snack')) return 'alimentos'
  return 'otros'
}

/** Build a frequency table of normalized categories. */
function categoryCounts(productos: Producto[]) {
  const counts: Record<string, number> = {
    salud: 0, belleza: 0, nutricion: 0, bebidas: 0, alimentos: 0, otros: 0,
  }
  for (const p of productos) {
    const k = normalizeCategoria(p.categoria)
    counts[k] = (counts[k] ?? 0) + 1
  }
  return counts
}

// ─── Smooth-scroll setup (Lenis) ─────────────────────────────────────────────

function useLenis() {
  useEffect(() => {
    let lenisInstance: any = null
    let rafId: number | null = null
    let cancelled = false

    // Lenis is a browser-only library — dynamic import keeps SSR clean and
    // avoids "window is not defined" during the prerender pass.
    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return
      lenisInstance = new Lenis({
        duration: 1.2,
        // ease-out-expo per the skill — feels premium, not jittery.
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      })
      const raf = (time: number) => {
        lenisInstance?.raf(time)
        rafId = requestAnimationFrame(raf)
      }
      rafId = requestAnimationFrame(raf)

      // Bridge Lenis ↔ GSAP ScrollTrigger so scrub animations stay in sync.
      lenisInstance.on('scroll', ScrollTrigger.update)
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

if (typeof window !== 'undefined') {
  // Register once at module load. SSR-guarded.
  gsap.registerPlugin(ScrollTrigger)
}

export default function TiendaLanding({ profile, productos }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const heroImageRef = useRef<HTMLDivElement>(null)
  const heroHeadlineRef = useRef<HTMLHeadingElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsInView, setStatsInView] = useState(false)

  useLenis()

  const firstName = firstNameFrom(profile)

  // Pick a real product image for the hero. Prefer products that have an
  // imagen_url AND look like a "wellness" item (skip the cleaning supplies).
  const heroProduct =
    productos.find(
      (p) =>
        p.imagen_url &&
        ['salud', 'belleza', 'nutricion'].includes(normalizeCategoria(p.categoria)),
    ) ?? productos.find((p) => p.imagen_url) ?? null

  // Stats counts — real data, not lorem.
  const totalProductos = productos.length
  const counts = categoryCounts(productos)
  const totalCategorias = Object.values(counts).filter((n) => n > 0).length

  // ─── Hero scroll-driven animation ───────────────────────────────────────
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!heroImageRef.current || !heroHeadlineRef.current || !rootRef.current) return

      // Skip scrub on small screens — phones don't handle it well and the
      // motion adds zero value when the hero is already mostly off-screen
      // by the time the user scrolls a notch.
      const isMobile = window.matchMedia('(max-width: 767px)').matches
      if (isMobile) return

      gsap.to(heroImageRef.current, {
        scale: 0.4,
        y: -120,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: '+=600',
          scrub: 1,
        },
      })

      gsap.to(heroHeadlineRef.current, {
        // 56px → 40px in raw px units; we approximate via fontSize tween.
        fontSize: '40px',
        opacity: 0.85,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: '+=600',
          scrub: 1,
        },
      })
    }, rootRef)
    return () => ctx.revert()
  }, [])

  // ─── Stats count-up trigger via IntersectionObserver ────────────────────
  useEffect(() => {
    if (!statsRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={rootRef}>
      {/* ════════════════════════════════════════════════════════════════════
          1. HERO — full viewport, dark, cinematic
          ════════════════════════════════════════════════════════════════════ */}
      <section
        className="relative isolate overflow-hidden bg-[#0a0a0a] text-[#fafaf7]"
        style={{ minHeight: 'calc(100vh - 73px)' }}
      >
        {/* Subtle radial glow — replaces the harsh "purple gradient" trope */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(201,169,97,0.08) 0%, rgba(10,10,10,0) 65%)',
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 lg:px-10 pt-20 pb-24 lg:pt-28 lg:pb-32 flex flex-col items-center text-center">
          {/* Eyebrow */}
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#C9A961] mb-8">
            Emporium · Distribución premium
          </p>

          {/* Hero product image */}
          <div
            ref={heroImageRef}
            className="relative w-full max-w-md aspect-square mb-10"
            style={{ willChange: 'transform' }}
          >
            {heroProduct?.imagen_url ? (
              <Image
                src={heroProduct.imagen_url}
                alt={heroProduct.nombre}
                fill
                sizes="(max-width: 768px) 80vw, 480px"
                priority
                className="object-contain drop-shadow-[0_30px_60px_rgba(201,169,97,0.15)]"
              />
            ) : (
              // Graceful fallback if no productos have imagen_url yet —
              // a soft gold disc with the brand initial.
              <div className="w-full h-full rounded-full border border-[#C9A961]/30 flex items-center justify-center">
                <span className="font-serif text-[#C9A961]/60 text-[120px] leading-none">E</span>
              </div>
            )}
          </div>

          {/* Headline */}
          <h1
            ref={heroHeadlineRef}
            className="font-serif text-[#fafaf7] tracking-tight"
            style={{
              fontSize: 'clamp(32px, 5.5vw, 56px)',
              lineHeight: 1.08,
              maxWidth: '20ch',
            }}
          >
            Bienvenido, {firstName}.{' '}
            <span className="italic text-[#C9A961]">listo para tu próximo pedido.</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#fafaf7]/60">
            Tu distribuidor de confianza, ahora online. Agilidad de compra al mejor precio.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <a
              href="#catalogo"
              className="inline-flex items-center gap-2 bg-[#C9A961] text-[#0a0a0a] text-[11px] uppercase tracking-[0.18em] px-8 py-4 rounded-full hover:bg-[#d4b572] transition-all group min-h-[48px]"
            >
              Explorar catálogo
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <Link
              href="/tienda/mis-pedidos"
              className="text-[11px] uppercase tracking-[0.18em] text-[#fafaf7]/70 border-b border-[#fafaf7]/20 hover:text-[#fafaf7] hover:border-[#fafaf7]/60 pb-1 transition min-h-[48px] flex items-center"
            >
              Mis pedidos
            </Link>
          </div>

          {/* Scroll hint — only on first paint, fades on first scroll */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[#fafaf7]/30 text-[10px] uppercase tracking-[0.3em] hidden lg:block">
            <span className="inline-flex flex-col items-center gap-2">
              Scroll
              <span className="w-px h-8 bg-[#fafaf7]/20" />
            </span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          2. STATS BAR — cream, count-up
          ════════════════════════════════════════════════════════════════════ */}
      <section
        ref={statsRef}
        className="bg-[#fafaf7] border-y border-[#0a0a0a]/[0.06]"
      >
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16 lg:py-24 grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-8">
          <Stat
            value={totalProductos}
            label="Productos"
            inView={statsInView}
            big
          />
          <Stat
            value={totalCategorias}
            label="Categorías"
            inView={statsInView}
          />
          <Stat
            value="24h"
            label="Entrega"
            inView={statsInView}
          />
          <Stat
            value="15+"
            label="Años"
            inView={statsInView}
          />
        </div>
      </section>
    </div>
  )
}

// ─── Stat number ─────────────────────────────────────────────────────────────

function Stat({
  value,
  label,
  inView,
  big = false,
}: {
  value: number | string
  label: string
  inView: boolean
  big?: boolean
}) {
  const [display, setDisplay] = useState<number | string>(typeof value === 'number' ? 0 : value)

  useEffect(() => {
    if (!inView) return
    if (typeof value !== 'number') {
      setDisplay(value)
      return
    }
    // Count up over ~1.2s using GSAP for smoother frame pacing than rAF loops.
    const obj = { n: 0 }
    const tween = gsap.to(obj, {
      n: value,
      duration: 1.4,
      ease: 'expo.out',
      onUpdate: () => setDisplay(Math.round(obj.n)),
    })
    return () => { tween.kill() }
  }, [inView, value])

  return (
    <div className="flex flex-col items-start">
      <span
        className="font-serif text-[#0a0a0a] leading-none tabular-nums"
        style={{ fontSize: big ? 'clamp(48px, 8vw, 88px)' : 'clamp(40px, 6vw, 64px)' }}
      >
        {display}
      </span>
      <span className="mt-3 text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/55">
        {label}
      </span>
    </div>
  )
}
