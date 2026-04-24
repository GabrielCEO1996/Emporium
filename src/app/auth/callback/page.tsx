"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Auth callback page.
 *
 * Handles the post-signin / post-signup redirect for:
 *  - Email/password sign-ups (handle_new_user trigger inserts profile row)
 *  - Google OAuth sign-ins
 *  - Password recovery links
 *
 * Robustness notes (why this is defensive):
 *  - `.maybeSingle()` (not `.single()`) tolerates a missing profile row,
 *    which can happen briefly while the `handle_new_user` trigger runs.
 *  - If the profile row is missing, we retry a couple of times with a
 *    short backoff before falling back to the safe default (`/tienda`
 *    for `comprador` — the default role for public sign-ups).
 *  - All errors are caught and logged; the user is always redirected
 *    somewhere sensible instead of seeing a client-side exception page.
 */
export default function AuthCallback() {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const fetchProfileRol = async (userId: string): Promise<string> => {
      // Retry a few times to absorb the small window between auth.users insert
      // and the handle_new_user trigger inserting the profile row.
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data, error } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', userId)
          .maybeSingle()
        if (error) {
          console.warn('[auth/callback] profile lookup error', error)
        }
        if (data?.rol) return data.rol
        // Short backoff: 150ms, 300ms, 600ms, 1200ms
        await new Promise(r => setTimeout(r, 150 * Math.pow(2, attempt)))
      }
      // Safe default for new public sign-ups
      return 'comprador'
    }

    const handleCallback = async () => {
      try {
        const hash = typeof window !== 'undefined' ? window.location.hash : ''
        if (hash.includes('type=recovery')) {
          router.push('/auth/reset-password')
          return
        }

        const { data: { session }, error: sessionError } =
          await supabase.auth.getSession()

        if (sessionError) {
          console.error('[auth/callback] session error:', sessionError)
          router.push('/login?error=session')
          return
        }

        if (!session) {
          router.push('/login')
          return
        }

        const rol = await fetchProfileRol(session.user.id)

        if (rol === 'admin' || rol === 'vendedor') {
          router.push('/dashboard')
        } else {
          router.push('/tienda')
        }
      } catch (err: any) {
        console.error('[auth/callback] unexpected error:', err)
        setErrorMsg(
          'Ocurrió un problema al iniciar sesión. Te llevamos a la tienda…',
        )
        // Safe fallback — public users land on /tienda, protected routes
        // will redirect them away if they shouldn't be there.
        setTimeout(() => router.push('/tienda'), 1200)
      }
    }
    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="text-center">
        <p className="text-white text-xl">
          {errorMsg ?? 'Iniciando sesión...'}
        </p>
      </div>
    </div>
  )
}
