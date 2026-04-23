import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl  = new URL(request.url)
  const searchParams = requestUrl.searchParams

  const code        = searchParams.get('code')
  const token_hash  = searchParams.get('token_hash')
  const type        = searchParams.get('type')
  const next        = searchParams.get('next')

  // ── Resolve base URL ───────────────────────────────────────────────────────
  // On Vercel the internal origin may differ from the public host.
  // x-forwarded-host always contains the browser-visible hostname.
  const reqHeaders    = new Headers(request.headers)
  const fwdHost       = reqHeaders.get('x-forwarded-host')
  const fwdProto      = reqHeaders.get('x-forwarded-proto') ?? 'https'
  const baseUrl       = fwdHost
    ? `${fwdProto}://${fwdHost}`
    : requestUrl.origin

  // ── Build Supabase client that captures every Set-Cookie it needs ──────────
  const cookieStore = cookies()
  const captured: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Capture every cookie so we can forward them on the redirect response.
          // Also write them to the cookie store for any further DB calls below.
          cookiesToSet.forEach(c => {
            captured.push(c as (typeof captured)[0])
            try { cookieStore.set(c.name, c.value, c.options as Parameters<typeof cookieStore.set>[2]) } catch { /* Server Component — ignored */ }
          })
        },
      },
    }
  )

  // Helper: redirect AND carry all captured auth cookies with the response.
  // Without this explicit copy the session is lost because NextResponse.redirect()
  // creates a brand-new Response object that doesn't inherit the cookie store.
  function redirectWith(path: string): NextResponse {
    const res = NextResponse.redirect(`${baseUrl}${path}`)
    captured.forEach(({ name, value, options }) =>
      res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
    )
    return res
  }

  // ── Determine redirect path by role ───────────────────────────────────────
  async function roleRedirect(fallback = '/tienda'): Promise<string> {
    if (next) return next                           // explicit ?next= wins
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return fallback

      const { data: profile } = await supabase
        .from('profiles')
        .select('rol, activo')
        .eq('id', user.id)
        .maybeSingle()

      const rol = profile?.rol ?? 'cliente'
      if (rol === 'pendiente')                                    return '/pendiente'
      if (['admin', 'vendedor', 'conductor'].includes(rol))       return '/dashboard'
      return '/tienda'
    } catch {
      return fallback
    }
  }

  // ── 1. token_hash flow — email OTP / magic-link / password reset ──────────
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]['type'],
    })

    if (!error) {
      if (type === 'recovery') return redirectWith('/auth/reset-password')
      const dest = await roleRedirect()
      return redirectWith(dest)
    }

    return redirectWith('/login?error=link_expired')
  }

  // ── 2. PKCE code flow — Google OAuth / email PKCE confirm ─────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Ensure the user has a profiles row (fallback if DB trigger hasn't run)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: existing } = await supabase
            .from('profiles')
            .select('id, rol')
            .eq('id', user.id)
            .maybeSingle()

          if (!existing) {
            await supabase.from('profiles').insert({
              id:     user.id,
              email:  user.email!,
              nombre:
                user.user_metadata?.nombre ??
                user.user_metadata?.full_name ??
                user.email?.split('@')[0] ??
                'Usuario',
              rol:    'cliente',
              activo: true,
            })
            return redirectWith(next ?? '/tienda')
          }
        }
      } catch {
        // Non-fatal — middleware handles missing profiles gracefully
      }

      if (type === 'recovery') return redirectWith('/auth/reset-password')

      const dest = await roleRedirect()
      return redirectWith(dest)
    }

    return redirectWith('/login?error=auth_error')
  }

  // ── Nothing matched — bad callback ────────────────────────────────────────
  return redirectWith('/login?error=auth_error')
}
