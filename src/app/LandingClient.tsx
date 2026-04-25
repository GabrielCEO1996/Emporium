'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight, Menu, X, ShieldCheck, Truck, DollarSign, Smartphone,
  Package, Clock, Award, Briefcase,
} from 'lucide-react'

// ── Brand constants ───────────────────────────────────────────────────────────
const LOGO_URL =
  'https://axeefndebatrmgqzncuo.supabase.co/storage/v1/object/public/empresa/Editable%20Emporium%20logo%20transparente%20.png'

const HERO_IMG =
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1920&q=80'

// Brand palette (kept as hex strings so the Tailwind compiler can't tree-shake them out)
const TEAL = '#0D9488'
const NAVY = '#1E3A5F'
const NAVY_DARK = '#132944'
const GOLD = '#D4A017'
const MINT = '#F0FDFA'
const BG = '#FAFAFA'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProductoDestacado {
  id: string
  nombre: string
  categoria?: string
  imagen_url?: string
  precio_desde: number
}
interface Props {
  empresa: { nombre?: string; logo_url?: string } | null
  productos: ProductoDestacado[]
  isLoggedIn: boolean
  userRole: string | null
}

// ── Static content ────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    name: 'Medicamentos OTC',
    img: 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=400',
  },
  {
    name: 'Vitaminas y Suplementos',
    img: 'https://images.unsplash.com/photo-1612531386530-97286d97c2d2?w=400',
  },
  {
    name: 'Cuidado Personal',
    img: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400',
  },
  {
    // Previous URL (1583947215259-38e31be8751f) was 404 on the Unsplash
    // CDN — replaced with a verified household-cleaning still life.
    name: 'Higiene del Hogar',
    img: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400',
  },
  {
    name: 'Bebés y Maternidad',
    img: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
  },
  {
    name: 'Primeros Auxilios',
    img: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400',
  },
]

const STATS = [
  { value: '500+', label: 'Productos disponibles', icon: Package },
  { value: '24h',  label: 'Entrega express',       icon: Clock },
  { value: '100%', label: 'Calidad garantizada',   icon: Award },
  { value: 'B2B',  label: 'Distribución mayorista', icon: Briefcase },
]

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Productos Certificados',
    desc: 'Todos nuestros productos cumplen estándares FDA y regulaciones locales.',
  },
  {
    icon: Truck,
    title: 'Entrega Directa',
    desc: 'Llevamos tus pedidos directamente a tu tienda o farmacia.',
  },
  {
    icon: DollarSign,
    title: 'Precios Mayoristas',
    desc: 'Obtén los mejores precios del mercado para maximizar tu margen.',
  },
  {
    icon: Smartphone,
    title: 'Pedidos Online 24/7',
    desc: 'Haz tus pedidos cuando quieras desde cualquier dispositivo.',
  },
]

const STEPS = [
  { n: 1, title: 'Crea tu cuenta',       desc: 'Regístrate y solicita acceso mayorista.' },
  { n: 2, title: 'Explora el catálogo',  desc: 'Miles de productos disponibles.' },
  { n: 3, title: 'Recibe tu pedido',     desc: 'Entrega rápida a tu negocio.' },
]

// ── Animation helpers ─────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
}
const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LandingClient({ empresa, isLoggedIn, userRole }: Props) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const logoSrc = empresa?.logo_url || LOGO_URL
  const empresaName = empresa?.nombre || 'Emporium'

  // Where do we send a logged-in user who clicks "Ver Catálogo"?
  const catalogHref =
    isLoggedIn
      ? userRole === 'admin' || userRole === 'vendedor'
        ? '/dashboard'
        : '/tienda'
      : '/tienda'

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 antialiased">
      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt={empresaName} className="h-9 w-auto" />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#categorias"
              className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-slate-700 hover:text-[#0D9488]' : 'text-white/90 hover:text-white'
              }`}
            >
              Categorías
            </a>
            <a
              href="#nosotros"
              className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-slate-700 hover:text-[#0D9488]' : 'text-white/90 hover:text-white'
              }`}
            >
              Nosotros
            </a>
            <a
              href="#como-funciona"
              className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-slate-700 hover:text-[#0D9488]' : 'text-white/90 hover:text-white'
              }`}
            >
              Cómo funciona
            </a>
            {isLoggedIn ? (
              <Link
                href={catalogHref}
                className="rounded-full bg-[#0D9488] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0B7A6F] hover:shadow-md"
              >
                Mi cuenta
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`text-sm font-medium transition-colors ${
                    scrolled ? 'text-slate-700 hover:text-[#0D9488]' : 'text-white/90 hover:text-white'
                  }`}
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-[#0D9488] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0B7A6F] hover:shadow-md"
                >
                  Solicitar cuenta
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`md:hidden ${scrolled ? 'text-slate-700' : 'text-white'}`}
            aria-label="Menú"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <div className="flex flex-col gap-1 px-6 py-4">
              <a href="#categorias" onClick={() => setMenuOpen(false)} className="py-2 text-sm font-medium text-slate-700">Categorías</a>
              <a href="#nosotros" onClick={() => setMenuOpen(false)} className="py-2 text-sm font-medium text-slate-700">Nosotros</a>
              <a href="#como-funciona" onClick={() => setMenuOpen(false)} className="py-2 text-sm font-medium text-slate-700">Cómo funciona</a>
              {isLoggedIn ? (
                <Link href={catalogHref} className="mt-2 rounded-full bg-[#0D9488] px-4 py-2 text-center text-sm font-semibold text-white">
                  Mi cuenta
                </Link>
              ) : (
                <>
                  <Link href="/login" className="py-2 text-sm font-medium text-slate-700">Iniciar sesión</Link>
                  <Link href="/signup" className="mt-2 rounded-full bg-[#0D9488] px-4 py-2 text-center text-sm font-semibold text-white">
                    Solicitar cuenta
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[680px] overflow-hidden">
        {/* Background image + overlay */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMG}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: NAVY, opacity: 0.65 }}
          />
          {/* Subtle radial highlight for depth */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(13,148,136,0.15) 0%, rgba(30,58,95,0) 60%)',
            }}
          />
        </div>

        <div className="relative mx-auto flex min-h-[680px] max-w-5xl flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="flex flex-col items-center"
          >
            <motion.div variants={fadeUp} className="mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt={empresaName}
                className="h-20 w-auto drop-shadow-lg sm:h-24"
              />
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-white/90 backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
              Distribuidor autorizado
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl"
            >
              Distribución de Salud y{' '}
              <span style={{ color: '#5EEAD4' }}>Cuidado Personal</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg"
            >
              Productos farmacéuticos, vitaminas y cuidado del hogar entregados
              directamente a tu negocio.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4"
            >
              <Link
                href={catalogHref}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#0D9488] px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/30 transition-all hover:bg-[#0B7A6F] hover:shadow-xl hover:shadow-teal-900/40"
              >
                Ver Catálogo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href={isLoggedIn ? '/mi-cuenta' : '/signup'}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 bg-transparent px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white hover:text-[#1E3A5F]"
              >
                Solicitar Cuenta
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Soft curve to stats bar */}
        <div
          className="absolute inset-x-0 bottom-0 h-12"
          style={{
            background: `linear-gradient(to bottom, transparent, ${BG})`,
          }}
        />
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section className="relative -mt-12 px-4 sm:-mt-16 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
          className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-xl shadow-slate-900/5 lg:grid-cols-4"
        >
          {STATS.map((stat) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                className="flex flex-col items-center justify-center gap-2 bg-white px-6 py-8"
              >
                <Icon className="h-5 w-5" style={{ color: TEAL }} />
                <div className="text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
                  {stat.value}
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  {stat.label}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </section>

      {/* ── Categories ───────────────────────────────────────────────────── */}
      <section id="categorias" className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
            className="mb-14 text-center"
          >
            <motion.p
              variants={fadeUp}
              className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: TEAL }}
            >
              Catálogo
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ color: NAVY }}
            >
              Nuestras Categorías
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-4 max-w-xl text-base text-slate-500"
            >
              Todo lo que tu negocio necesita, en un solo lugar.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {CATEGORIES.map((cat) => (
              <motion.div key={cat.name} variants={fadeUp}>
                <Link
                  href={catalogHref}
                  className="group relative block aspect-[4/3] overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/10 hover:ring-slate-300"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cat.img}
                    alt={cat.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1E3A5F]/90 via-[#1E3A5F]/40 to-transparent" />
                  {/* Label */}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-6">
                    <h3 className="text-lg font-bold leading-tight text-white sm:text-xl">
                      {cat.name}
                    </h3>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-all group-hover:bg-[#0D9488]">
                      <ArrowRight className="h-4 w-4 text-white" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Why Emporium ─────────────────────────────────────────────────── */}
      <section id="nosotros" className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
            className="mb-14 text-center"
          >
            <motion.p
              variants={fadeUp}
              className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: TEAL }}
            >
              Por qué elegirnos
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ color: NAVY }}
            >
              La distribución que tu negocio merece
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={f.title}
                  variants={fadeUp}
                  className="group relative flex flex-col rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-900/5"
                >
                  <div
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-colors group-hover:scale-105"
                    style={{ backgroundColor: MINT }}
                  >
                    <Icon className="h-5 w-5" style={{ color: TEAL }} />
                  </div>
                  <h3 className="mb-2 text-base font-semibold" style={{ color: NAVY }}>
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-500">{f.desc}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section
        id="como-funciona"
        className="relative overflow-hidden px-6 py-24 sm:py-32"
        style={{ backgroundColor: NAVY }}
      >
        {/* Decorative accent */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: TEAL }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: GOLD }}
        />

        <div className="relative mx-auto max-w-5xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
            className="mb-16 text-center"
          >
            <motion.p
              variants={fadeUp}
              className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: '#5EEAD4' }}
            >
              Proceso simple
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
            >
              Cómo funciona
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
            className="grid grid-cols-1 gap-10 md:grid-cols-3"
          >
            {STEPS.map((step, idx) => (
              <motion.div
                key={step.n}
                variants={fadeUp}
                className="relative flex flex-col items-start text-left"
              >
                {/* Connector line (desktop only, skip on last) */}
                {idx < STEPS.length - 1 && (
                  <div className="absolute left-16 top-7 hidden h-px w-[calc(100%-4rem)] md:block"
                       style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.2), rgba(255,255,255,0))' }} />
                )}

                <div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold"
                  style={{
                    backgroundColor: 'rgba(13,148,136,0.15)',
                    border: `1px solid ${TEAL}`,
                    color: '#5EEAD4',
                  }}
                >
                  {step.n.toString().padStart(2, '0')}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-white/60">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="mt-14 flex justify-center"
          >
            <Link
              href={isLoggedIn ? catalogHref : '/signup'}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold shadow-lg transition-all hover:shadow-xl"
              style={{ color: NAVY }}
            >
              {isLoggedIn ? 'Ir al catálogo' : 'Empezar ahora'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: NAVY_DARK }} className="px-6 py-14 text-white/70">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt={empresaName} className="mb-4 h-9 w-auto brightness-200" />
              <p className="max-w-xs text-sm leading-relaxed text-white/60">
                Distribución especializada en salud y cuidado personal.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                Navegación
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link href={catalogHref} className="transition-colors hover:text-white">
                    Catálogo
                  </Link>
                </li>
                <li>
                  <a href="#nosotros" className="transition-colors hover:text-white">
                    Nosotros
                  </a>
                </li>
                <li>
                  <a href="#como-funciona" className="transition-colors hover:text-white">
                    Cómo funciona
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                Contacto
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="mailto:contacto@emporium.com" className="transition-colors hover:text-white">
                    Contacto
                  </a>
                </li>
                <li>
                  <Link href="/login" className="transition-colors hover:text-white">
                    Iniciar sesión
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="transition-colors hover:text-white">
                    Solicitar cuenta
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} {empresaName}. Todos los derechos reservados.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="transition-colors hover:text-white">Términos</a>
              <a href="#" className="transition-colors hover:text-white">Privacidad</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
