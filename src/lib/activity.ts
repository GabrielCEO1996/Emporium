// ═══════════════════════════════════════════════════════════════════════════
// src/lib/activity.ts
//
// Fire-and-forget activity logging helper. Never throws — a failure here
// must never block the main transaction it is instrumenting.
//
//   logActivity(supabase, {
//     user_id, action, resource, resource_id,
//     estado_anterior?, estado_nuevo?, details?,
//   })
//
// Requires `major_fix.sql` to have been applied (adds estado_anterior /
// estado_nuevo columns).
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export interface LogActivityParams {
  user_id: string | null
  action: string
  resource: string
  resource_id: string | null
  estado_anterior?: string | null
  estado_nuevo?: string | null
  details?: Record<string, unknown> | null
  ip_address?: string | null
}

export async function logActivity(
  supabase: SupabaseClient,
  params: LogActivityParams
): Promise<void> {
  try {
    const {
      user_id,
      action,
      resource,
      resource_id,
      estado_anterior = null,
      estado_nuevo = null,
      details = null,
      ip_address = null,
    } = params

    const { error } = await supabase.from('activity_logs').insert({
      user_id,
      action,
      resource,
      resource_id,
      estado_anterior,
      estado_nuevo,
      details,
      ip_address,
    })
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[logActivity] insert failed (non-fatal):', error.message)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[logActivity] threw (non-fatal):', err)
  }
}
