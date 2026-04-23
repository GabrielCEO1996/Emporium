'use client'

/**
 * /auth/callback — universal auth landing page.
 *
 * Supabase can deliver sessions in three ways:
 *
 *  A) Hash flow   → /auth/callback#access_token=…&type=recovery
 *     Used by: password-reset emails (implicit / non-PKCE)
 *     The browser strips the hash before the HTTP request, so a route.ts
 *     can never see it. Only client-side JS can read window.location.hash.
 *
 *  B) token_hash  → /auth/callback?token_hash=…&type=recovery
 *     Used by: email OTP, magic-link (PKCE-less server-side)
 *
 *  C) PKCE code   → /auth/callback?code=…
 *     Used by: Google OAuth, email confirm with PKCE
 *
 * This page handles all three flows entirely in the browser so the session
 * cookies are set by supabase-js automatically (no manual cookie forwarding).
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // ── Role-based redirect helper ───────────────────────────────────────────
    async function redirectByRole(userId: string) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', userId)
          .maybeSingle()
        const rol = profile?.rol ?? 'cliente'
        if (rol === 'pendiente')                                    router.replace('/pendiente')
        else if (['admin', 'vendedor', 'conductor'].includes(rol)) router.replace('/dashboard')
        else                                                         router.replace('/tienda')
      } catch {
        router.replace('/tienda')
      }
    }

    // ── Ensure profile row exists (fallback for missing DB trigger) ──────────
    async function ensureProfile(userId: string, email: string, meta: Record<string, unknown>) {
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('id', userId).maybeSingle()
      if (!existing) {
        await supabase.from('profiles').insert({
          id:     userId,
          email,
          nombre: (meta?.full_name as string) ?? (meta?.nombre as string) ?? email.split('@')[0] ?? 'Usuario',
          rol:    'cliente',
          activo: true,
        })
      }
    }

    async function handle() {
      const search = new URLSearchParams(window.location.search)
      const next   = search.get('next')

      // ────────────────────────────────────────────────────────────────────────
      // A. Hash flow  →  #access_token=…&type=recovery
      // ────────────────────────────────────────────────────────────────────────
      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const type       = hashParams.get('type')

        // supabase-js v2 auto-detects the hash on the next getSession() call.
        // Give it a short tick to parse and persist the tokens.
        await new Promise(r => setTimeout(r, 300))

        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          if (type === 'recovery') {
            router.replace('/auth/reset-password')
            return
          }
          await redirectByRole(session.user.id)
          return
        }

        // Hash was present but session still not found — fall through to
        // listen for PASSWORD_RECOVERY event (Supabase fires this async)
        await new Promise<void>(resolve => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, sess) => {
              if (event === 'PASSWORD_RECOVERY' && sess) {
                subscription.unsubscribe()
                router.replace('/auth/reset-password')
                resolve()
              } else if (event === 'SIGNED_IN' && sess) {
                subscription.unsubscribe()
                await redirectByRole(sess.user.id)
                resolve()
              }
            }
          )
          // Safety timeout — if Supabase never fires, give up
          setTimeout(() => { subscription.unsubscribe(); resolve() }, 5000)
        })
        return
      }

      // ────────────────────────────────────────────────────────────────────────
      // B. token_hash flow  →  ?token_hash=…&type=…
      // ────────────────────────────────────────────────────────────────────────
      const tokenHash = search.get('token_hash')
      const type      = search.get('type')

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as Parameters<typeof supabase.auth.verifyOtp>[0]['type'],
        })
        if (!error) {
          if (type === 'recovery') { router.replace('/auth/reset-password'); return }
          const { data: { user } } = await supabase.auth.getUser()
          if (user) { await redirectByRole(user.id); return }
          router.replace(next ?? '/tienda')
          return
        }
        router.replace('/login?error=link_expired')
        return
      }

      // ────────────────────────────────────────────────────────────────────────
      // C. PKCE code flow  →  ?code=…  (Google OAuth / email PKCE confirm)
      // ────────────────────────────────────────────────────────────────────────
      const code = search.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await ensureProfile(user.id, user.email!, user.user_metadata ?? {})
            if (type === 'recovery') { router.replace('/auth/reset-password'); return }
            await redirectByRole(user.id)
            return
          }
        }
        router.replace('/login?error=auth_error')
        return
      }

      // ────────────────────────────────────────────────────────────────────────
      // D. Session already set (second visit / page refresh)
      // ────────────────────────────────────────────────────────────────────────
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { await redirectByRole(session.user.id); return }

      router.replace('/login?error=auth_error')
    }

    handle()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 text-teal-400 animate-spin mx-auto" />
        <p className="text-slate-300 text-sm">Iniciando sesión…</p>
      </div>
    </div>
  )
}
