import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── DELETE /api/gastos/[id] ────────────────────────────────────────────────
// Admin only. Deletes the gasto AND its mirror transaccion so reports stay
// in sync. Idempotent on the transaccion side (delete matches by reference).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

      const { data: gasto } = await supabase
        .from('gastos_operativos')
        .select('id')
        .eq('id', params.id)
        .maybeSingle()

      if (!gasto) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })

      // Remove ledger entry first so a failure here doesn't leave a dangling transaccion
      await supabase
        .from('transacciones')
        .delete()
        .eq('referencia_tipo', 'gasto_operativo')
        .eq('referencia_id', params.id)

      const { error } = await supabase.from('gastos_operativos').delete().eq('id', params.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[DELETE /api/gastos/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
