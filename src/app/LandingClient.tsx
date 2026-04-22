'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Package2, Truck, DollarSign, ShieldCheck, Smartphone,
  ArrowRight, ChevronDown, Menu, X, ShoppingBag, Star,
  MapPin, Phone, Mail,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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

// ── Static data ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Salud y Bienestar',  img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', emoji: '💊' },
  { name: 'Cuidado Personal',   img: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&q=80', emoji: '🧴' },
  { name: 'Alimentos',          img: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=400&q=80', emoji: '🥗' },
  { name: 'Hogar y Limpieza',   img: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80', emoji: '🏠' },
  { name: 'Belleza',            img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&q=80', emoji: '💄' },
  { name: 'Nutrición',          img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80', emoji: '🥦' },
]

const FEATURES = [
  {
    icon: Truck,
    label: 'Entrega rápida',
    desc: 'Recibe tus pedidos directamente en tu puerta en tiempo récord.',
    gradient: 'from-teal-500 to-cyan-400',
    shadow: 'shadow-teal-200',
  },
  {
    icon: DollarSign,
    label: 'Precios directos',
    desc: 'Sin intermediarios. Precios de distribuidor directo al comprador.',
    gradient: 'from-emerald-500 to-teal-400',
    shadow: 'shadow-emerald-200',
  },
  {
    icon: ShieldCheck,
    label: 'Calidad garantizada',
    desc: 'Todos nuestros productos pasan por estricto control de calidad.',
    gradient: 'from-amber-500 to-orange-400',
    shadow: 'shadow-amber-200',
  },
  {
    icon: Smartphone,
    label: 'Pide desde donde estés',
    desc: 'Tienda digital disponible 24/7 desde cualquier dispositivo.',
    gradient: 'from-violet-500 to-purple-400',
    shadow: 'shadow-violet-200',
  },
]

const PRODUCT_GRADIENTS = [
  'from-teal-400 to-emerald-500',
  'from-violet-400 to-purple-500',
  'from-orange-400 to-amber-500',
  'from-sky-400 to-blue-500',
  'from-rose-400 to-pink-500',
  'from-amber-400 to-yellow-500',
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function LandingClient({ empresa, productos, isLoggedIn, userRole }: Props) {
  const [scrolled, setScrolled]         = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Determine the right dashboard link and CTA label for logged-in users
  const dashboardHref =
    userRole === 'cliente' ? '/tienda' :
    userRole ? '/dashboard' : '/login'

  const dashboardLabel =
    userRole === 'cliente' ? 'Ir a mi tienda' :
    userRole === 'admin'   ? 'Ir al dashboard' :
    userRole               ? 'Ir al sistema'   : 'Ingresar'

  const companyName = empresa?.nombre ?? 'Emporium'

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">

      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled || mobileOpen
            ? 'bg-white/95 backdrop-blur-lg shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            {empresa?.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={empresa.logo_url}
                alt={companyName}
                className="h-9 w-9 object-contain rounded-xl"
              />
            ) : (
              <div className="h-9 w-9 bg-teal-600 rounded-xl flex items-center justify-center">
                <Package2 className="w-5 h-5 text-white" />
              </div>
            )}
            <span className={`font-extrabold text-lg tracking-tight transition-colors ${scrolled || mobileOpen ? 'text-slate-900' : 'text-white'}`}>
              {companyName}
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: 'Inicio',   href: '/' },
              { label: 'Tienda',   href: '/tienda' },
              { label: 'Contacto', href: '#contacto' },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  scrolled ? 'text-slate-600 hover:text-teal-600' : 'text-white/80 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href={dashboardHref}
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 hover:scale-105"
              >
                {dashboardLabel}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`text-sm font-medium transition-colors ${
                    scrolled ? 'text-slate-600 hover:text-slate-900' : 'text-white/80 hover:text-white'
                  }`}
                >
                  Ingresar
                </Link>
                <Link
                  href="/tienda"
                  className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 hover:scale-105"
                >
                  Comprar ahora
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Menú"
          >
            {mobileOpen
              ? <X className={`w-5 h-5 ${scrolled || mobileOpen ? 'text-slate-900' : 'text-white'}`} />
              : <Menu className={`w-5 h-5 ${scrolled ? 'text-slate-900' : 'text-white'}`} />
            }
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
            >
              <div className="px-4 py-4 flex flex-col gap-1">
                {[
                  { label: 'Inicio',   href: '/' },
                  { label: 'Tienda',   href: '/tienda' },
                  { label: 'Contacto', href: '#contacto' },
                ].map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="py-3 px-3 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
                <div className="pt-2 flex flex-col gap-2">
                  {!isLoggedIn && (
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="py-3 px-3 rounded-xl text-center text-teal-600 font-semibold border border-teal-200 hover:bg-teal-50 transition-colors"
                    >
                      Ingresar al sistema
                    </Link>
                  )}
                  <Link
                    href={isLoggedIn ? dashboardHref : '/tienda'}
                    onClick={() => setMobileOpen(false)}
                    className="py-3 px-3 rounded-xl text-center bg-teal-600 hover:bg-teal-500 text-white font-semibold transition-colors"
                  >
                    {isLoggedIn ? dashboardLabel : 'Comprar ahora'}
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Background image */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&q=80"
            alt=""
            className="w-full h-full object-cover"
            fetchPriority="high"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/80" />
          {/* Color tint */}
          <div className="absolute inset-0 bg-teal-900/20" />
        </div>

        {/* Floating particles (decorative) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-teal-400/40 rounded-full"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 20}%`,
              }}
              animate={{ y: [-20, 20, -20], opacity: [0.3, 0.8, 0.3] }}
              transition={{ repeat: Infinity, duration: 3 + i * 0.5, ease: 'easeInOut' }}
            />
          ))}
        </div>

        {/* Hero content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto pt-16">

          {/* Logo badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
            className="flex justify-center mb-8"
          >
            {empresa?.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={empresa.logo_url}
                alt={companyName}
                className="h-24 w-24 object-contain rounded-3xl shadow-2xl shadow-black/40 ring-4 ring-white/20"
              />
            ) : (
              <div className="h-24 w-24 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-teal-800/50 ring-4 ring-white/20">
                <Package2 className="w-12 h-12 text-white" />
              </div>
            )}
          </motion.div>

          {/* Badge chip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="inline-flex items-center gap-2 bg-teal-500/20 backdrop-blur-sm border border-teal-400/30 text-teal-300 text-sm font-semibold px-4 py-1.5 rounded-full mb-6"
          >
            <Star className="w-3.5 h-3.5 fill-teal-400 text-teal-400" />
            Distribución premium
            <Star className="w-3.5 h-3.5 fill-teal-400 text-teal-400" />
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white leading-[0.95] tracking-tight mb-5"
          >
            {companyName}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-2xl sm:text-3xl font-bold text-teal-300 mb-4 leading-tight"
          >
            Tu tienda de distribución de confianza
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-lg sm:text-xl text-white/65 mb-10 max-w-lg mx-auto leading-relaxed"
          >
            Productos de calidad · Entrega rápida · Precios directos
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link
              href="/tienda"
              className="group w-full sm:w-auto bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all shadow-2xl shadow-teal-500/40 hover:shadow-teal-400/60 hover:scale-105 flex items-center justify-center gap-2.5"
            >
              <ShoppingBag className="w-5 h-5" />
              Comprar ahora
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href={isLoggedIn ? dashboardHref : '/login'}
              className="group w-full sm:w-auto border-2 border-white/30 hover:border-white/70 text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all hover:bg-white/10 backdrop-blur-sm flex items-center justify-center gap-2"
            >
              {isLoggedIn ? dashboardLabel : 'Ingresar al sistema'}
            </Link>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-wrap justify-center gap-8 mt-14 pt-10 border-t border-white/10"
          >
            {[
              { value: '100%', label: 'Calidad garantizada' },
              { value: '24/7', label: 'Tienda online' },
              { value: '🚚', label: 'Entrega a domicilio' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-black text-white">{stat.value}</p>
                <p className="text-sm text-white/50 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          >
            <ChevronDown className="w-7 h-7 text-white/40" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── CATEGORIES ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-14"
          >
            <span className="inline-block text-teal-600 font-bold text-xs uppercase tracking-[0.2em] bg-teal-50 px-4 py-1.5 rounded-full mb-4">
              Categorías
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 leading-tight">
              Todo lo que necesitas
            </h2>
            <p className="text-slate-500 mt-3 max-w-md mx-auto">
              Encuentra productos de las mejores marcas en cada categoría
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -4 }}
                className="group relative rounded-2xl overflow-hidden aspect-square cursor-pointer shadow-sm hover:shadow-xl transition-shadow duration-300"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cat.img}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                {/* Hover tint */}
                <div className="absolute inset-0 bg-teal-600/0 group-hover:bg-teal-600/20 transition-colors duration-300" />

                <div className="absolute inset-x-0 bottom-0 p-3 text-center">
                  <span className="text-xl mb-1 block">{cat.emoji}</span>
                  <p className="text-white font-bold text-xs sm:text-sm leading-tight drop-shadow">
                    {cat.name}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY EMPORIUM ────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-16"
          >
            <span className="inline-block text-teal-600 font-bold text-xs uppercase tracking-[0.2em] bg-teal-50 px-4 py-1.5 rounded-full mb-4">
              Ventajas
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900">
              ¿Por qué elegir {companyName}?
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                className="group text-center p-7 rounded-2xl bg-slate-50 hover:bg-white hover:shadow-2xl transition-all duration-300 border border-transparent hover:border-slate-100"
              >
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mx-auto mb-5 shadow-lg ${f.shadow} group-hover:scale-110 transition-transform duration-300`}
                >
                  <f.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-black text-slate-900 text-lg mb-2">{f.label}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ───────────────────────────────────────────────── */}
      {productos.length > 0 && (
        <section className="py-24 px-4 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              className="text-center mb-14"
            >
              <span className="inline-block text-teal-600 font-bold text-xs uppercase tracking-[0.2em] bg-teal-50 px-4 py-1.5 rounded-full mb-4">
                Destacados
              </span>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900">
                Productos populares
              </h2>
              <p className="text-slate-500 mt-3">
                Lo más pedido por nuestros clientes
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {productos.slice(0, 6).map((p, i) => {
                const grad = PRODUCT_GRADIENTS[p.nombre.charCodeAt(0) % PRODUCT_GRADIENTS.length]
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ y: -4 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 group"
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                      {p.imagen_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.imagen_url}
                          alt={p.nombre}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
                          <span className="text-6xl font-black text-white/80 select-none">
                            {p.nombre.charAt(0)}
                          </span>
                        </div>
                      )}
                      {/* Category badge */}
                      {p.categoria && (
                        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full text-slate-600 shadow-sm">
                          {p.categoria}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-5">
                      <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-2">
                        {p.nombre}
                      </h3>
                      <div className="flex items-center justify-between mt-4">
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Desde</p>
                          <p className="text-2xl font-black text-teal-600 leading-none mt-0.5">
                            {formatCurrency(p.precio_desde)}
                          </p>
                        </div>
                        <Link
                          href="/tienda"
                          className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-teal-500/20 hover:shadow-teal-500/40 flex items-center gap-1.5 group/btn"
                        >
                          Ver más
                          <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* CTA link */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mt-12"
            >
              <Link
                href="/tienda"
                className="inline-flex items-center gap-2.5 bg-teal-600 hover:bg-teal-500 text-white px-9 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-teal-500/30 hover:shadow-teal-500/50 hover:scale-105"
              >
                <ShoppingBag className="w-5 h-5" />
                Ver catálogo completo
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── CTA BANNER ──────────────────────────────────────────────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-emerald-600 to-teal-700" />
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
          >
            <span className="inline-block text-teal-200 font-bold text-xs uppercase tracking-[0.2em] bg-white/10 px-4 py-1.5 rounded-full mb-6">
              ¡Empieza hoy!
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-5 leading-tight">
              ¿Listo para empezar a{' '}
              <span className="text-teal-200">ahorrar?</span>
            </h2>
            <p className="text-teal-100 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
              Únete a cientos de clientes que ya disfrutan de precios directos
              y entrega rápida a domicilio.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/tienda"
                className="group inline-flex items-center justify-center gap-2.5 bg-white hover:bg-teal-50 text-teal-700 px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-2xl hover:scale-105"
              >
                <ShoppingBag className="w-5 h-5" />
                Explorar tienda
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              {!isLoggedIn && (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 border-2 border-white/40 hover:border-white text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:bg-white/10"
                >
                  Ingresar al sistema
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer id="contacto" className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                {empresa?.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={empresa.logo_url}
                    alt={companyName}
                    className="h-9 w-9 object-contain rounded-xl"
                  />
                ) : (
                  <div className="h-9 w-9 bg-teal-600 rounded-xl flex items-center justify-center">
                    <Package2 className="w-5 h-5 text-white" />
                  </div>
                )}
                <span className="text-white font-extrabold text-lg">{companyName}</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                Tu tienda de distribución de confianza. Calidad, rapidez y precios directos.
              </p>
            </div>

            {/* Links */}
            <div>
              <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">
                Navegación
              </h3>
              <nav className="flex flex-col gap-2.5">
                {[
                  { label: 'Inicio',  href: '/' },
                  { label: 'Tienda',  href: '/tienda' },
                  { label: 'Ingresar', href: '/login' },
                ].map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="text-sm text-slate-400 hover:text-teal-400 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">
                Contacto
              </h3>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShoppingBag className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>Tienda disponible 24/7</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Truck className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>Entrega a domicilio</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>Calidad garantizada</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              © {new Date().getFullYear()} {companyName}. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-1 text-xs text-slate-700">
              Hecho con
              <span className="text-teal-500 mx-1">♥</span>
              para nuestros clientes
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
