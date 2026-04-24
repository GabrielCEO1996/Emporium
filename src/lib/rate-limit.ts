/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Rate limiter — LRU-backed sliding window.
 *
 * Works per process (single-replica). For multi-replica production, swap the
 * store for Redis (e.g. Upstash via @upstash/ratelimit) without changing the
 * public API.
 *
 * Coexists with the simpler token-bucket rateLimit() in src/lib/security.ts.
 * Prefer checkRateLimit() for new routes — it gives a remaining budget.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { LRUCache } from 'lru-cache'
import { NextResponse } from 'next/server'

// The cache capacity is the *number of distinct identifiers* tracked. Each
// value is an array of request timestamps within the window. We hold 5k keys
// with a 60-second TTL, which covers bursts without unbounded memory.
const ratelimit = new LRUCache<string, number[]>({
  max: 5000,
  ttl: 60 * 1000,
})

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Sliding-window rate limit check.
 *
 * @param identifier  unique key (`email:${userId}`, `chat:${ip}`, etc)
 * @param limit       max calls allowed within `windowMs`
 * @param windowMs    window duration (ms). Default 60_000.
 *
 * @returns success=true if within limit; success=false if exceeded.
 *          `remaining` is the budget left after counting this call.
 *          `resetAt` is the ms-epoch when the oldest recorded call ages out.
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60_000,
): RateLimitResult {
  const now = Date.now()
  const timestamps = ratelimit.get(identifier) || []

  // Drop anything outside the sliding window.
  const recent = timestamps.filter((t) => now - t < windowMs)

  if (recent.length >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: recent[0] + windowMs,
    }
  }

  recent.push(now)
  ratelimit.set(identifier, recent)
  return {
    success: true,
    remaining: limit - recent.length,
    resetAt: now + windowMs,
  }
}

/** Standard 429 response helper. */
export function tooManyRequests(windowMs: number = 60_000): NextResponse {
  return NextResponse.json(
    { error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) },
    },
  )
}
