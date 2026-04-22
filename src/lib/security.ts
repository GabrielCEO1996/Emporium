/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Emporium — Central Security Utilities
 * Import from this file in every API route that needs auth / validation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'vendedor' | 'conductor' | 'cliente' | 'pendiente'

export interface AuthContext {
  userId: string
  email: string
  rol: UserRole
}

// ── UUID validation ───────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id)
}

/** Returns 400 if id is not a valid UUID, otherwise null. */
export function validateUUID(id: unknown, label = 'ID'): NextResponse | null {
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: `${label} inválido` }, { status: 400 })
  }
  return null
}

// ── String sanitisation ───────────────────────────────────────────────────────
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
}

/** Strip leading/trailing whitespace and HTML-encode dangerous characters. */
export function sanitize(value: unknown, maxLength = 1000): string {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .slice(0, maxLength)
    .replace(/[&<>"'/]/g, c => HTML_ENTITIES[c] ?? c)
}

/** Trim only — use for fields that should allow some special chars (addresses, notes). */
export function clean(value: unknown, maxLength = 1000): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

// ── Numeric validators ────────────────────────────────────────────────────────
export function safeInt(value: unknown, fallback = 0): number {
  const n = parseInt(String(value ?? fallback), 10)
  return isNaN(n) ? fallback : n
}

export function safePositiveDecimal(value: unknown, fallback = 0): number {
  const n = parseFloat(String(value ?? fallback))
  return isNaN(n) || n < 0 ? fallback : n
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Resolve the authenticated user + their role in ONE call.
 * Returns { ctx } on success or { error: NextResponse } on failure.
 *
 * Usage:
 *   const { ctx, error } = await getAuthContext(supabase)
 *   if (error) return error
 */
export async function getAuthContext(
  supabase: SupabaseClient,
): Promise<{ ctx: AuthContext; error: null } | { ctx: null; error: NextResponse }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ctx: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle()

  const rol: UserRole = (profile?.rol as UserRole) ?? 'cliente'

  return {
    ctx: { userId: user.id, email: user.email ?? '', rol },
    error: null,
  }
}

/**
 * Require that the caller holds one of the allowed roles.
 * Returns a 403 NextResponse if not, otherwise null.
 *
 * Usage:
 *   const denied = requireRole(ctx, ['admin', 'vendedor'])
 *   if (denied) return denied
 */
export function requireRole(
  ctx: AuthContext,
  allowed: UserRole[],
): NextResponse | null {
  if (!allowed.includes(ctx.rol)) {
    return NextResponse.json(
      { error: `Acceso denegado. Roles permitidos: ${allowed.join(', ')}` },
      { status: 403 },
    )
  }
  return null
}

// ── In-memory rate limiter ────────────────────────────────────────────────────
// NOTE: Works for single-instance / dev. For multi-replica production, swap
// the store for a Redis client (e.g. Upstash via @upstash/ratelimit).

interface RateEntry { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateEntry>()

/**
 * Simple token-bucket rate limiter.
 * @param key      Unique key, e.g. `login:${ip}` or `checkout:${userId}`
 * @param max      Max allowed calls in the window
 * @param windowMs Window duration in milliseconds
 * @returns true  → within limit (allow)
 *          false → over limit (reject with 429)
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= max) return false

  entry.count += 1
  return true
}

/** Returns a 429 response with a Retry-After header. */
export function rateLimitResponse(windowMs: number): NextResponse {
  return NextResponse.json(
    { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) },
    },
  )
}

// ── Activity logger ───────────────────────────────────────────────────────────
/**
 * Fire-and-forget activity log insert.
 * Does NOT throw — failures are swallowed so they never break the main request.
 */
export function logActivity(
  supabase: SupabaseClient,
  params: {
    userId: string
    action: string
    resource?: string
    resourceId?: string
    details?: Record<string, unknown>
    ipAddress?: string
  },
): void {
  supabase
    .from('activity_logs')
    .insert({
      user_id:     params.userId,
      action:      params.action,
      resource:    params.resource ?? null,
      resource_id: params.resourceId ?? null,
      details:     params.details ?? null,
      ip_address:  params.ipAddress ?? null,
    })
    .then(() => null)
    .catch(() => null)
}
