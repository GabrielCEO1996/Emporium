import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paths that never require auth
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
]

// Dashboard paths only accessible to staff roles (admin | vendedor | conductor)
const DASHBOARD_PREFIX = '/dashboard'

// Admin-only paths within the dashboard
const ADMIN_ONLY_PATHS = [
  '/equipo',
  '/empresa',
  '/compras',
  '/proveedores',
]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Always allow public routes and API ──────────────────────────────────────
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return supabaseResponse
  }

  // ── Not authenticated → login ───────────────────────────────────────────────
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── Fetch role only for paths that need it ──────────────────────────────────
  // (skip for static assets, API, etc.)
  const needsRoleCheck =
    pathname.startsWith('/mi-cuenta') ||
    pathname === '/' ||
    pathname.startsWith('/pendiente') ||
    // Everything under the (dashboard) route group
    (!PUBLIC_PATHS.some(p => pathname.startsWith(p)) && !pathname.startsWith('/api'))

  if (!needsRoleCheck) return supabaseResponse

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  const rol = profile?.rol ?? 'cliente'

  // ── Role-based routing ──────────────────────────────────────────────────────

  // cliente role: can only access /tienda (and /mi-cuenta redirects to /tienda)
  if (rol === 'cliente') {
    if (pathname.startsWith('/mi-cuenta')) {
      const url = request.nextUrl.clone()
      url.pathname = '/tienda'
      return NextResponse.redirect(url)
    }
    if (!pathname.startsWith('/tienda')) {
      const url = request.nextUrl.clone()
      url.pathname = '/tienda'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // pendiente role: can only access /pendiente
  if (rol === 'pendiente') {
    if (!pathname.startsWith('/pendiente')) {
      const url = request.nextUrl.clone()
      url.pathname = '/pendiente'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Staff roles (admin | vendedor | conductor): redirect away from client-only pages
  if (['admin', 'vendedor', 'conductor'].includes(rol)) {
    if (pathname.startsWith('/mi-cuenta') || pathname.startsWith('/tienda') || pathname.startsWith('/pendiente')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // vendedor & conductor cannot access admin-only paths
    if (rol !== 'admin' && ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p))) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
