'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package2, Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!nombre.trim()) {
      setError('Por favor ingresa tu nombre completo.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre: nombre.trim() },
        // After email confirmation, land directly on /tienda
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/tienda`,
      },
    })

    if (signUpError) {
      setError(
        signUpError.message.includes('already registered') ||
        signUpError.message.includes('User already registered')
          ? 'Este correo ya tiene una cuenta. Inicia sesión.'
          : signUpError.message.includes('Database error')
          ? 'Error de base de datos. Contacta al administrador.'
          : 'No se pudo crear la cuenta. Intenta de nuevo.'
      )
      setLoading(false)
      return
    }

    // ── Case 1: Email confirmation is DISABLED (auto-confirm on) ─────────────
    // The session is available immediately. Create the profile here as fallback
    // in case the DB trigger hasn't been set up or failed.
    if (data.session && data.user) {
      try {
        // Use INSERT … ON CONFLICT DO NOTHING to avoid overwriting
        // a profile the trigger may have already created
        await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            email: data.user.email!,
            nombre: nombre.trim(),
            rol: 'cliente',
            activo: true,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        )
      } catch {
        // Non-fatal: the trigger may have already inserted the row
      }
      router.push('/tienda')
      return
    }

    // ── Case 2: Email confirmation is ENABLED ─────────────────────────────────
    // Profile will be created in /auth/callback after the user clicks the link.
    setDone(true)
    setLoading(false)
  }

  // ── Success screen (email confirmation required) ──────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full">
            <CheckCircle2 className="w-9 h-9 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">¡Cuenta creada!</h2>
          <p className="text-slate-400 text-sm">
            Revisa tu correo <span className="text-white font-medium">{email}</span> y haz clic en el enlace
            de confirmación para activar tu cuenta.
          </p>
          <Link
            href="/login"
            className="inline-block text-teal-400 hover:text-teal-300 text-sm transition-colors"
          >
            Volver al inicio de sesión →
          </Link>
        </div>
      </div>
    )
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-2xl mb-4 shadow-lg shadow-teal-500/30">
            <Package2 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Emporium</h1>
          <p className="text-slate-400 mt-1 text-sm">Crea tu cuenta de cliente</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl space-y-5">
          <h2 className="text-xl font-semibold text-white">Crear cuenta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Nombre completo
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                autoComplete="name"
                disabled={loading}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition disabled:opacity-50"
                placeholder="Tu nombre completo"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition disabled:opacity-50"
                placeholder="correo@ejemplo.com"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition disabled:opacity-50"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Confirmar contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition disabled:opacity-50"
                placeholder="Repite la contraseña"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                'Crear cuenta'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-teal-400 hover:text-teal-300 font-medium transition-colors">
              Iniciar sesión
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Emporium © {new Date().getFullYear()} — Sistema de Distribución
        </p>
      </div>
    </div>
  )
}
