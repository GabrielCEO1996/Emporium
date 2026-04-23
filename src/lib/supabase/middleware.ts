import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// Route classification
// ─────────────────────────────────────────────────────────────────────────────

/** Exact-match public paths (cannot use startsWith because '/' matches everything). */
const PUBLIC_EXACT = new Set(['/', '/pendiente'])

/** Prefix-match public paths — no auth needed at all. */
const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',       // legacy redirect
  '/auth/',                // /auth/callback, /auth/reset-password
  '/catalogo/',
  '/api/webhook/',         // Stripe webhook (raw body, no session)
]

/** Staff-accessible path prefixes (vendedor, conductor, admin). */
const STAFF_PREFIXES = [
  '/dashboard',
  '/productos',
  '/clientes',
  '/pedidos',
  '/facturas',
  '/historial',
  '/rutas',
  '/notas-credito',
  '/mi-cuenta',
]

/** Admin-only path prefixes. */
const ADMIN_PREFIXES = [
  '/configuracion',
  '/finanzas',
  '/equipo',
  '/reportes',
  '/proveedores',
  '/compras',
  '/empresa',
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function redirect(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  return NextResponse.redirect(url)
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

// ─────────────────────────────────────────────────────────────────────────────
// Main middleware
// ─────────────────────────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest): Promise<NextResponse> {
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { pathname } = request.nextUrl

  // ── 1. Static assets / Next internals / public API ─────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/)
  ) {
    return supabaseResponse
  }

  // ── 2. Fully public routes — no session needed ─────────────────────────────
  if (isPublic(pathname)) {
    // Refresh session cookies even on public routes (keeps Supabase SSR happy)
    await supabase.auth.getUser()
    return supabaseResponse
  }

  // ── 3. All other routes require a valid session ────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  // ── 4. Fetch role (needed for every authenticated route) ───────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle()

  const rol: string = profile?.rol ?? 'comprador'

  // ── 5. Role-based routing ──────────────────────────────────────────────────

  // pendiente: can only be on /pendiente
  if (rol === 'pendiente') {
    if (pathname !== '/pendiente') return redirect(request, '/pendiente')
    return supabaseResponse
  }

  // cliente + comprador: can only access /tienda/*
  if (rol === 'cliente' || rol === 'comprador') {
    if (pathname.startsWith('/tienda')) return supabaseResponse
    // Any other authenticated route → send to tienda
    return redirect(request, '/tienda')
  }

  // Staff (admin | vendedor | conductor):
  // /pendiente is a limbo page only for that role — redirect staff away from it.
  // /tienda/* is intentionally accessible to staff so vendedores can place orders.
  if (pathname === '/pendiente') {
    return redirect(request, '/dashboard')
  }

  // vendedor / conductor: block admin-only paths
  if (
    rol !== 'admin' &&
    ADMIN_PREFIXES.some(p => pathname.startsWith(p))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.searchParams.set('error', 'acceso_denegado')
    return NextResponse.redirect(url)
  }

  // ── 6. Allow ──────────────────────────────────────────────────────────────
  return supabaseResponse
}
