'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Package2, Eye, EyeOff, CheckCircle2, Loader2,
  XCircle, Lock, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'

type PageState = 'loading' | 'ready' | 'success' | 'expired'

export default function AuthResetPasswordPage() {
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [pageState,  setPageState]  = useState<PageState>('loading')
  const router  = useRouter()
  const supabase = createClient()

  // ── Verify a recovery session is present ───────────────────────────────────
  useEffect(() => {
    let expired = false

    const check = async () => {
      // 1. Immediate check — callback page already set the session before redirecting
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { setPageState('ready'); return }

      // 2. Listen for PASSWORD_RECOVERY / SIGNED_IN (hash flow fires this async)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
        if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && sess) {
          if (!expired) setPageState('ready')
          subscription.unsubscribe()
        }
      })

      // 3. Give up after 6 s if nothing arrives
      const timer = setTimeout(() => {
        expired = true
        subscription.unsubscribe()
        setPageState('expired')
      }, 6000)

      return () => { clearTimeout(timer); subscription.unsubscribe() }
    }

    check()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(
        updateError.message.includes('expired')
          ? 'El enlace ha expirado. Solicita uno nuevo.'
          : 'No se pudo actualizar la contraseña. Intenta de nuevo.'
      )
      setSubmitting(false)
      return
    }

    setPageState('success')

    // Redirect by role after 2 s
    setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        const { data: profile } = await supabase
          .from('profiles').select('rol').eq('id', user.id).maybeSingle()
        const rol = profile?.rol ?? 'cliente'
        if (['admin', 'vendedor', 'conductor'].includes(rol)) router.push('/dashboard')
        else                                                    router.push('/tienda')
      } catch {
        router.push('/login')
      }
    }, 2000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-2xl mb-4 shadow-lg shadow-teal-500/30">
            <Package2 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Emporium</h1>
          <p className="text-slate-400 mt-1 text-sm">Sistema de Distribución</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Loading */}
          {pageState === 'loading' && (
            <div className="text-center space-y-4 py-4">
              <Loader2 className="w-10 h-10 text-teal-400 animate-spin mx-auto" />
              <p className="text-slate-300 text-sm">Verificando enlace…</p>
            </div>
          )}

          {/* Expired / invalid */}
          {pageState === 'expired' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                  <XCircle className="w-9 h-9 text-red-400" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-white">Enlace expirado</h2>
              <p className="text-slate-400 text-sm">
                El enlace de restablecimiento ya no es válido.<br />
                Los enlaces expiran después de 1 hora.
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <Link
                  href="/forgot-password"
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-3 rounded-lg transition-colors text-sm text-center block"
                >
                  Solicitar nuevo enlace
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </div>
          )}

          {/* Success */}
          {pageState === 'success' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-white">¡Contraseña actualizada!</h2>
              <p className="text-slate-400 text-sm">
                Tu contraseña fue cambiada exitosamente.<br />
                Redirigiendo…
              </p>
              <Loader2 className="w-5 h-5 text-teal-400 animate-spin mx-auto" />
            </div>
          )}

          {/* Form */}
          {pageState === 'ready' && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-teal-400" />
                  Nueva contraseña
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Ingresa tu nueva contraseña para continuar.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Nueva contraseña */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                    >
                      {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {password && (
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            password.length >= i * 3
                              ? i <= 1 ? 'bg-red-400'
                              : i <= 2 ? 'bg-amber-400'
                              : i <= 3 ? 'bg-teal-400'
                              : 'bg-emerald-400'
                              : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirmar contraseña */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Confirmar contraseña
                  </label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="Repite la contraseña"
                    className={`w-full bg-white/10 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition ${
                      confirm && confirm !== password
                        ? 'border-red-500/60 focus:ring-red-500'
                        : confirm && confirm === password
                        ? 'border-emerald-500/60 focus:ring-emerald-500'
                        : 'border-white/20 focus:ring-teal-500'
                    }`}
                  />
                  {confirm && confirm !== password && (
                    <p className="mt-1 text-xs text-red-400">Las contraseñas no coinciden</p>
                  )}
                  {confirm && confirm === password && (
                    <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Las contraseñas coinciden
                    </p>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Guardar */}
                <button
                  type="submit"
                  disabled={submitting || !password || !confirm}
                  className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-lg transition-colors shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                    : <><CheckCircle2 className="w-4 h-4" /> Guardar</>
                  }
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
