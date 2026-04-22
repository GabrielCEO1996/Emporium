import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  // ── Params Supabase may send ────────────────────────────────────────────────
  const code        = searchParams.get('code')        // PKCE flow (Google OAuth)
  const token_hash  = searchParams.get('token_hash')  // Email OTP / magic-link flow
  const type        = searchParams.get('type')        // 'recovery' | 'signup' | 'email' | …
  const next        = searchParams.get('next') ?? '/tienda'

  const supabase = createClient()

  // ── 1. token_hash flow — used by Supabase for resetPasswordForEmail ─────────
  //    The email link format is:
  //      /auth/callback?token_hash=<hash>&type=recovery
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]['type'],
    })

    if (!error) {
      if (type === 'recovery') {
        // Redirect to the password-reset form (session is already established)
        return NextResponse.redirect(`${origin}/auth/reset-password`)
      }
      // Email confirmation or magic-link → redirect by role
      return NextResponse.redirect(`${origin}${next}`)
    }

    // Token expired / invalid
    return NextResponse.redirect(
      `${origin}/login?error=link_expired`
    )
  }

  // ── 2. PKCE code flow — used by Google OAuth / email confirm with PKCE ──────
  //    The callback URL format is:
  //      /auth/callback?code=<code>&next=/tienda
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // ── Ensure the user has a profile row (fallback for missing DB trigger) ──
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
              id: user.id,
              email: user.email!,
              nombre:
                user.user_metadata?.nombre ??
                user.user_metadata?.full_name ??
                user.email?.split('@')[0] ??
                'Usuario',
              rol: 'cliente',
              activo: true,
            })
          }
        }
      } catch {
        // Non-fatal — middleware handles missing profiles gracefully
      }

      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(`${origin}/login?error=auth_error`)
  }

  // ── Nothing matched — bad callback ─────────────────────────────────────────
  return NextResponse.redirect(`${origin}/login?error=auth_error`)
}
