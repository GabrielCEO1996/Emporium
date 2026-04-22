import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  // Default to /tienda so new clients land in the store, not the dashboard.
  // Staff users will be redirected to /dashboard by middleware automatically.
  const next = searchParams.get('next') ?? '/tienda'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // ── After session is established, ensure the user has a profile ─────────
      // This is a fallback in case the DB trigger (handle_new_user) hasn't
      // been set up or failed due to a stale CHECK constraint.
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          // Check if profile already exists (e.g., existing admin/staff member)
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle()

          if (!existing) {
            // Create profile with 'cliente' as default role
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
        // Non-fatal — the middleware handles missing profiles gracefully
      }

      // ── Redirect ─────────────────────────────────────────────────────────────
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`)
}
