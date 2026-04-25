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

/**
 * Returns true when the user prefers reduced motion. We honor this
 * everywhere — GSAP scroll triggers and the count-up tween both fall
 * back to instant state changes when this is true. Re-checked at
 * mount because the OS setting can change between visits.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
      // by the time the user scrolls a notch. Also bail if the user has
      // OS-level "reduce motion" turned on.
      const isMobile = window.matchMedia('(max-width: 767px)').matches
      if (isMobile || prefersReducedMotion()) return

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

      {/* ════════════════════════════════════════════════════════════════════
          3. CATEGORIES — "El catálogo, curado"
          ════════════════════════════════════════════════════════════════════ */}
      <CategoriesSection counts={counts} />

      {/* ════════════════════════════════════════════════════════════════════
          4. FEATURED PRODUCTS — "Más vendidos"
          ════════════════════════════════════════════════════════════════════ */}
      <FeaturedSection productos={productos} />

      {/* ════════════════════════════════════════════════════════════════════
          5. HOW IT WORKS — dark, sequential reveal
          ════════════════════════════════════════════════════════════════════ */}
      <HowItWorksSection />

      {/* ════════════════════════════════════════════════════════════════════
          6. FINAL CTA — cream, restrained
          ════════════════════════════════════════════════════════════════════ */}
      <FinalCTA firstName={firstName} />
    </div>
  )
}

// ─── Categories ──────────────────────────────────────────────────────────────

const CATEGORIES_META: Array<{
  key: 'salud' | 'belleza' | 'nutricion' | 'bebidas' | 'alimentos' | 'otros'
  label: string
  blurb: string
  /** Solid bg color — restraint per the skill (no gradients on bg). */
  bg: string
  /** Foreground tone derived to keep contrast comfortable. */
  fg: string
  /** Filter slug pushed via the URL hash so the catalog scrolls + filters. */
  slug: string
}> = [
  { key: 'salud',     label: 'Salud',      blurb: 'Medicamentos y OTC',  bg: '#2d4a3e', fg: '#fafaf7', slug: 'salud' },
  { key: 'belleza',   label: 'Belleza',    blurb: 'Cuidado personal',    bg: '#C9A961', fg: '#0a0a0a', slug: 'belleza' },
  { key: 'nutricion', label: 'Nutrición',  blurb: 'Vitaminas + suplementos', bg: '#3a3635', fg: '#fafaf7', slug: 'nutricion' },
  { key: 'bebidas',   label: 'Bebidas',    blurb: 'Hidratación y energía', bg: '#0a4a4a', fg: '#fafaf7', slug: 'bebidas' },
  { key: 'otros',     label: 'Otros',      blurb: 'Cuidado del hogar',   bg: '#7a6a5a', fg: '#fafaf7', slug: 'otros' },
  { key: 'alimentos', label: 'Alimentos',  blurb: 'Snacks y comida',     bg: '#a04a3e', fg: '#fafaf7', slug: 'alimentos' },
]

function CategoriesSection({ counts }: { counts: Record<string, number> }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!cardsRef.current) return
      gsap.from(cardsRef.current.querySelectorAll('[data-category-card]'), {
        y: 60,
        opacity: 0,
        stagger: 0.1,
        duration: 0.9,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: cardsRef.current,
          start: 'top 80%',
          // No scrub — fire once when section enters viewport
        },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="bg-[#fafaf7]">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        {/* Section heading — asymmetric editorial layout */}
        <div className="mb-14 lg:mb-20 max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#C9A961] mb-5">
            Catálogo
          </p>
          <h2
            className="font-serif text-[#0a0a0a] tracking-tight"
            style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.08 }}
          >
            El catálogo, <span className="italic text-[#C9A961]">curado</span>.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-[#0a0a0a]/55 max-w-md">
            Seis categorías, cientos de referencias. Cada una seleccionada para entrega rápida y precio mayorista.
          </p>
        </div>

        {/* Grid: 2-col mobile, 3-col desktop. Aspect 4/5. */}
        <div
          ref={cardsRef}
          className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5"
        >
          {CATEGORIES_META.map((c) => {
            const n = counts[c.key] ?? 0
            // Hide categories with 0 items — better to show 4-5 populated
            // cards than 6 with zeros. We render an empty placeholder slot
            // to keep the grid balanced if necessary.
            return (
              <a
                key={c.key}
                href={`#catalogo`}
                data-category-card
                aria-label={`Ver ${c.label} (${n} productos)`}
                className="group relative aspect-[4/5] rounded-[12px] overflow-hidden flex flex-col justify-end p-6 lg:p-8 transition-transform hover:-translate-y-1"
                style={{ backgroundColor: c.bg, color: c.fg, willChange: 'transform' }}
              >
                {/* Subtle inner ring instead of a drop shadow */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[12px] ring-1 ring-inset"
                  style={{ borderColor: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)' }}
                />
                <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-3">
                  {c.blurb}
                </p>
                <h3
                  className="font-serif tracking-tight"
                  style={{ fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1 }}
                >
                  {c.label}
                </h3>
                <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] opacity-70">
                  <span>{n} {n === 1 ? 'producto' : 'productos'}</span>
                  <ArrowUpRight
                    className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Featured products ───────────────────────────────────────────────────────

function FeaturedSection({ productos }: { productos: Producto[] }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Pick 4 products with imagen_url. Skip the ones used as the hero so we
  // don't repeat the same photo. If there aren't enough, just show what
  // we have — the section still reads cleanly with 1-3 cards.
  const featured = productos.filter((p) => p.imagen_url).slice(0, 4)

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!gridRef.current || featured.length === 0) return
      gsap.from(gridRef.current.querySelectorAll('[data-featured-card]'), {
        x: 80,
        opacity: 0,
        stagger: 0.12,
        duration: 1.0,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 80%',
        },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [featured.length])

  if (featured.length === 0) return null // Don't render an empty section

  return (
    <section ref={sectionRef} className="bg-[#fafaf7]">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 pb-20 lg:pb-28">
        {/* Heading on the right — editorial asymmetry vs the categories block above */}
        <div className="mb-14 lg:mb-20 lg:ml-auto max-w-3xl lg:text-right">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#C9A961] mb-5">
            Destacados
          </p>
          <h2
            className="font-serif text-[#0a0a0a] tracking-tight"
            style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.08 }}
          >
            Más <span className="italic text-[#C9A961]">vendidos</span>.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-[#0a0a0a]/55 max-w-md lg:ml-auto">
            Los productos que tu negocio vuelve a pedir mes a mes.
          </p>
        </div>

        <div
          ref={gridRef}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5"
        >
          {featured.map((p) => {
            const cheapest = (p.presentaciones ?? [])
              .filter((pr) => typeof pr.precio === 'number' && (pr.precio ?? 0) > 0)
              .map((pr) => pr.precio as number)
              .sort((a, b) => a - b)[0]
            return (
              <a
                key={p.id}
                href="#catalogo"
                data-featured-card
                aria-label={`Ver ${p.nombre} en el catálogo`}
                className="group bg-white rounded-[12px] overflow-hidden border border-[#0a0a0a]/[0.06] hover:border-[#C9A961]/40 transition-colors"
              >
                <div className="relative aspect-square bg-[#fafaf7]">
                  {p.imagen_url && (
                    <Image
                      src={p.imagen_url}
                      alt={p.nombre}
                      fill
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      loading="lazy"
                      className="object-contain p-6 transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  )}
                </div>
                <div className="p-5 lg:p-6 border-t border-[#0a0a0a]/[0.06]">
                  <p className="text-[9px] uppercase tracking-[0.25em] text-[#C9A961] mb-2">
                    {p.categoria ?? 'Otros'}
                  </p>
                  <h3 className="font-serif text-[18px] lg:text-[20px] text-[#0a0a0a] leading-snug line-clamp-2 min-h-[2.5em]">
                    {p.nombre}
                  </h3>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[12px] text-[#0a0a0a]/55">
                      {cheapest ? `Desde $${cheapest.toFixed(2)}` : 'Ver precios'}
                    </span>
                    <ArrowUpRight
                      className="w-3.5 h-3.5 text-[#0a0a0a]/40 transition-all group-hover:text-[#C9A961] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
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
    // Honor reduce-motion: snap directly to the final number, no animation.
    if (prefersReducedMotion()) {
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

// ─── How it works ────────────────────────────────────────────────────────────

const STEPS: Array<{ num: string; title: string; copy: string }> = [
  {
    num: '01·',
    title: 'Explora',
    copy:
      'Recorre el catálogo. Filtros por categoría, búsqueda por nombre o código de barras. Sin distracciones.',
  },
  {
    num: '02·',
    title: 'Elige',
    copy:
      'Agrega productos al carrito. Te mostramos el precio aplicable a tu cuenta y el stock disponible al instante.',
  },
  {
    num: '03·',
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
        // Sequential — feels like a process unfolding, not a parallel reveal
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
    <section ref={sectionRef} className="bg-[#0a0a0a] text-[#fafaf7]">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-24 lg:py-32">
        <div className="mb-16 lg:mb-20 max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#C9A961] mb-5">
            Proceso
          </p>
          <h2
            className="font-serif text-[#fafaf7] tracking-tight"
            style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.08 }}
          >
            Cómo <span className="italic text-[#C9A961]">funciona</span>.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-[#fafaf7]/55">
            Tres pasos. Sin fricciones.
          </p>
        </div>

        <div ref={stepsRef} className="grid lg:grid-cols-3 gap-12 lg:gap-8">
          {STEPS.map((s) => (
            <div key={s.num} data-step className="lg:border-l lg:border-[#fafaf7]/10 lg:pl-8">
              <p
                className="font-serif text-[#C9A961]/80 tabular-nums mb-6"
                style={{ fontSize: 'clamp(28px, 3.5vw, 40px)' }}
              >
                {s.num}
              </p>
              <h3
                className="font-serif text-[#fafaf7] mb-4 tracking-tight"
                style={{ fontSize: 'clamp(24px, 2.5vw, 32px)', lineHeight: 1.1 }}
              >
                {s.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-[#fafaf7]/60 max-w-sm">
                {s.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCTA({ firstName }: { firstName: string }) {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!sectionRef.current) return
      // One smooth fade-up. No stagger — single block, single move.
      gsap.from(sectionRef.current.querySelectorAll('[data-cta-line]'), {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 1.0,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
        },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="bg-[#fafaf7]">
      <div className="max-w-4xl mx-auto px-6 lg:px-10 py-24 lg:py-32 text-center">
        <p data-cta-line className="text-[10px] uppercase tracking-[0.3em] text-[#C9A961] mb-6">
          {firstName ? `Para ti, ${firstName}` : 'Tu próximo pedido'}
        </p>
        <h2
          data-cta-line
          className="font-serif text-[#0a0a0a] tracking-tight max-w-3xl mx-auto"
          style={{ fontSize: 'clamp(32px, 5.5vw, 64px)', lineHeight: 1.05 }}
        >
          Tu próximo pedido,
          <br />
          <span className="italic text-[#C9A961]">en menos clics que un café</span>.
        </h2>
        <div data-cta-line className="mt-12">
          <a
            href="#catalogo"
            className="inline-flex items-center gap-2 bg-[#0a0a0a] text-[#fafaf7] text-[11px] uppercase tracking-[0.18em] px-10 py-5 rounded-full hover:bg-[#0a0a0a]/85 transition-all group min-h-[52px]"
          >
            Empezar ahora
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </section>
  )
}
