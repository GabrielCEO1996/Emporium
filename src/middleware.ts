import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // ── API routes are NEVER rewritten or redirected by middleware.
  // Each /api/* route handler enforces its own auth + role checks and
  // returns structured JSON. Letting the role-based redirect logic run
  // against /api/tienda/pedido (or any other /api/* path) was sending
  // cliente/comprador/vendedor POSTs back to /tienda as text/plain,
  // which surfaces to the client as "unexpected response" / "Object".
  //
  // We also force 'no-store' on every API response here so that
  // browsers, proxies and the Next.js fetch cache never serve stale
  // data after a mutation (create / update / delete). Individual
  // handlers can still override if they really want caching.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const res = NextResponse.next()
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.headers.set('Pragma', 'no-cache')
    return res
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
