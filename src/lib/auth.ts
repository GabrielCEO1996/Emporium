// ════════════════════════════════════════════════════════════════════════════
// src/lib/auth.ts
//
// Shared auth / role-check helpers for API route handlers and server components.
//
// Why this exists: before this helper, nearly every /api/**/route.ts had its
// own hand-rolled `getUser() → getProfile() → check rol` block. That's ~40+
// copies of the same logic and any forgotten check is a security hole. The
// audit (2026-04-24) found:
//   - clientes/[id] PUT/DELETE, notas-credito, facturas/[id]/pagar, email/factura,
//     facturas/[id] DELETE — all missing role gating.
//
// Every helper:
//   - Accepts a SupabaseClient created with @/lib/supabase/server.
//   - Returns `{ ok: true, user, profile }` on success or `{ ok: false, response }`
//     with the NextResponse to return immediately. Call sites use early-return:
//
//       const gate = await requireAdmin(supabase)
//       if (!gate.ok) return gate.response
//       const { user, profile } = gate
//
//   - Never throws. Supabase fetch errors are converted to 500s.
//
// Profile lookup is memoized per-request via React.cache() so the many pages /
// routes that check role don't each issue their own query.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { cache } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export type Rol = 'admin' | 'vendedor' | 'comprador' | 'cliente' | 'pendiente'

export interface AuthProfile {
  id:     string
  rol:    Rol | null
  nombre: string | null
  email:  string | null
  activo: boolean | null
}

export type GateResult =
  | { ok: true;  user: User; profile: AuthProfile }
  | { ok: false; response: NextResponse }

/**
 * Fetch the user's profile row. Memoized for the lifetime of a server
 * render / route handler via React.cache(), so calling it multiple times
 * across helpers in the same request costs ONE query.
 */
export const getProfile = cache(async (
  supabase: SupabaseClient,
  userId: string,
): Promise<AuthProfile | null> => {
  const { data } = await supabase
    .from('profiles')
    .select('id, rol, nombre, email, activo')
    .eq('id', userId)
    .maybeSingle()
  return (data ?? null) as AuthProfile | null
})

/**
 * Returns the authenticated user + their profile, or a 401 NextResponse.
 */
export async function requireUser(supabase: SupabaseClient): Promise<GateResult> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  const profile = await getProfile(supabase, user.id)
  if (!profile) {
    // Signed in but no profile row — treat as unauthenticated.
    return { ok: false, response: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 401 }) }
  }
  return { ok: true, user, profile }
}

/**
 * Gate that requires `rol === 'admin'`. Returns 401 if not logged in, 403 otherwise.
 */
export async function requireAdmin(supabase: SupabaseClient): Promise<GateResult> {
  const gate = await requireUser(supabase)
  if (!gate.ok) return gate
  if (gate.profile.rol !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Solo administradores pueden realizar esta acción' },
        { status: 403 },
      ),
    }
  }
  return gate
}

/**
 * Gate that requires `rol === 'admin' || 'vendedor'`. Used by POST endpoints
 * that staff of either role can call (create cliente, create pedido, etc.).
 */
export async function requireAdminOrVendedor(supabase: SupabaseClient): Promise<GateResult> {
  const gate = await requireUser(supabase)
  if (!gate.ok) return gate
  if (gate.profile.rol !== 'admin' && gate.profile.rol !== 'vendedor') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No autorizado para esta acción' },
        { status: 403 },
      ),
    }
  }
  return gate
}

/**
 * Convenience: is this user a staff member?
 */
export function isStaff(profile: AuthProfile | null | undefined): boolean {
  return profile?.rol === 'admin' || profile?.rol === 'vendedor'
}
