'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, ShieldCheck, Truck, Star, ArrowRight } from 'lucide-react'

// Map URL ?error= codes → human-readable Spanish messages
const URL_ERROR_MESSAGES: Record<string, string> = {
  auth_error:   'Error al autenticar con Google. Por favor intenta de nuevo.',
  auth_failed:  'No se pudo completar la autenticación. Intenta de nuevo.',
  link_expired: 'El enlace ha expirado. Solicita uno nuevo desde ¿Olvidaste tu contraseña?',
  acceso_denegado: 'No tienes permisos para acceder a esa sección.',
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LOGO_URL =
  'https://axeefndebatrmgqzncuo.supabase.co/storage/v1/object/public/empresa/Editable%20Emporium%20logo%20transparente%20.png'

const HERO_URL =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&q=80'

const STATS = [
  { icon: ShieldCheck, value: '100%', label: 'Calidad garantizada' },
  { icon: Truck,       value: '24/7',  label: 'Tienda online'       },
  { icon: Star,        value: '⭐',    label: 'Clientes satisfechos' },
]

// ── Google SVG icon ───────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const supabase = useMemo(() => createClient(), [])

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [googleLoading,setGoogleLoading]= useState(false)
  const [error,        setError]        = useState('')

  // Read ?error= from URL on mount and show a friendly message
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('error')
    if (code && URL_ERROR_MESSAGES[code]) {
      setError(URL_ERROR_MESSAGES[code])
    }
  }, [])

  const busy = loading || googleLoading

  // ── Email / password ──────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.session) {
      setError(
        authError?.message?.includes('Email not confirmed')
          ? 'Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada.'
          : authError?.message?.includes('Invalid login credentials')
          ? 'Correo o contraseña incorrectos.'
          : authError?.message?.includes('Email link is invalid or has expired')
          ? 'El enlace ha expirado. Solicita uno nuevo.'
          : 'Correo o contraseña incorrectos.'
      )
      setLoading(false)
      return
    }

    // Role-based redirect after email/password login
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', data.session.user.id)
        .maybeSingle()
      const rol = profile?.rol ?? 'cliente'
      if (rol === 'pendiente')                                    window.location.href = '/pendiente'
      else if (['admin', 'vendedor', 'conductor'].includes(rol))  window.location.href = '/dashboard'
      else                                                         window.location.href = '/tienda'
    } catch {
      window.location.href = '/dashboard'
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    if (busy) return
    setGoogleLoading(true)
    setError('')

    // Use env variable when set (production), fall back to current origin (dev)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const redirectTo = `${appUrl}/auth/callback`

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          // Force account chooser every time so users can switch accounts
          prompt: 'select_account',
        },
      },
    })

    if (oauthError) {
      setError('No se pudo conectar con Google. Intenta de nuevo.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — hero image (desktop only) ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden">

        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_URL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          fetchPriority="high"
        />

        {/* Teal overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/90 via-teal-800/80 to-emerald-900/90" />

        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full px-14 py-12">

          {/* Top — logo + brand */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link href="/" className="inline-flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_URL} alt="Emporium" className="h-10 w-auto object-contain" />
              <span className="text-white font-extrabold text-xl tracking-tight">Emporium</span>
            </Link>
          </motion.div>

          {/* Center — main message */}
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1, type: 'spring', stiffness: 150 }}
              className="mb-8"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={LOGO_URL}
                alt="Emporium"
                className="h-[150px] w-auto mx-auto object-contain"
                style={{ filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.35))' }}
              />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4 max-w-sm"
            >
              Tu tienda de distribución de confianza
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="text-teal-200 text-lg max-w-xs leading-relaxed"
            >
              Productos de calidad · Entrega rápida · Precios directos
            </motion.p>
          </div>

          {/* Bottom — stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="grid grid-cols-3 gap-4"
          >
            {STATS.map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-4 text-center"
              >
                <div className="flex justify-center mb-2">
                  <Icon className="w-5 h-5 text-teal-300" />
                </div>
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-teal-300 text-xs mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ───────────────────────────────────────────────── */}
      <div className="flex-1 lg:w-[40%] flex items-center justify-center bg-white relative min-h-screen">

        {/* Mobile-only background gradient */}
        <div className="absolute inset-0 lg:hidden bg-gradient-to-br from-teal-50 via-white to-emerald-50" />

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-sm px-6 py-10"
        >
          {/* Mobile logo — only on small screens */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_URL}
              alt="Emporium"
              className="h-16 w-auto object-contain mb-3"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(13,148,136,0.30))' }}
            />
            <h1 className="text-2xl font-extrabold text-slate-900">Emporium</h1>
            <p className="text-slate-400 text-sm mt-0.5">Sistema de Distribución</p>
          </div>

          {/* Desktop small logo */}
          <div className="hidden lg:flex items-center gap-2 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_URL}
              alt="Emporium"
              className="h-[60px] w-auto object-contain"
            />
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-3xl font-black text-slate-900 leading-tight">
              Bienvenido de vuelta
            </h2>
            <p className="text-slate-500 mt-1.5 text-sm">
              Ingresa a tu cuenta para continuar
            </p>
          </div>

          {/* ── Google button ── */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-semibold py-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-sm hover:shadow-md text-sm"
          >
            {googleLoading
              ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              : <GoogleIcon />
            }
            {googleLoading ? 'Redirigiendo…' : 'Continuar con Google'}
          </button>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-slate-400 text-xs font-medium">o con correo y contraseña</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* ── Email / Password form ── */}
          <form onSubmit={handleLogin} className="space-y-4" noValidate>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={busy}
                placeholder="usuario@empresa.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-all disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  Contraseña
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-teal-600 hover:text-teal-500 font-medium transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={busy}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 pr-12 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm flex items-start gap-2"
              >
                <span className="mt-0.5 shrink-0">⚠️</span>
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="group w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-[1.02] active:scale-[0.98] text-base"
            >
              {loading
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Ingresando…</>
                : <>Ingresar <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
              }
            </button>
          </form>

          {/* ── Create account ── */}
          <p className="text-center text-sm text-slate-500 mt-6">
            ¿No tienes cuenta?{' '}
            <Link
              href="/signup"
              className="text-teal-600 hover:text-teal-500 font-semibold transition-colors"
            >
              Crear cuenta gratis
            </Link>
          </p>

          {/* ── Back to landing ── */}
          <div className="text-center mt-3">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Volver al inicio
            </Link>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-300 text-xs mt-10">
            Emporium © {new Date().getFullYear()} — Sistema de Distribución
          </p>
        </motion.div>
      </div>
    </div>
  )
}
