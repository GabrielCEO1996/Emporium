import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNuevaOrdenEmail } from '@/lib/email/nueva-orden'

// Disable caching — fresh data every call.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/email/nueva-orden { orden_id }
//
// Fires admin + customer notification emails for a freshly created orden.
// Auth: must be authenticated AND either own the orden OR be staff.
//
// ALL FAILURES RETURN 200 with ok:false so /api/tienda/pedido can call us
// fire-and-forget without any risk of blocking the order. The Stripe webhook
// calls the shared lib directly — this HTTP endpoint exists only for the
// client-side post-order trigger.
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    }

    const { orden_id } = await request.json().catch(() => ({}))
    if (!orden_id || typeof orden_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'orden_id requerido' }, { status: 400 })
    }

    // Ownership check: caller is the orden user OR staff.
    const { data: orden } = await supabase
      .from('ordenes')
      .select('id, user_id')
      .eq('id', orden_id)
      .maybeSingle()
    if (!orden) {
      return NextResponse.json({ ok: false, error: 'Orden no encontrada' }, { status: 404 })
    }

    let allowed = orden.user_id === user.id
    if (!allowed) {
      const { data: callerProfile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).maybeSingle()
      allowed = callerProfile?.rol === 'admin' || callerProfile?.rol === 'vendedor'
    }
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'No autorizado para esta orden' }, { status: 403 })
    }

    const result = await sendNuevaOrdenEmail(supabase, orden_id)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[email/nueva-orden] threw:', err)
    // NEVER fail the caller on email errors.
    return NextResponse.json({ ok: false, error: err?.message ?? 'unexpected error' })
  }
}
