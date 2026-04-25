import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const CATEGORIAS = ['operacion', 'personal', 'marketing', 'servicios', 'otro'] as const

// ── GET /api/gastos ─────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

      const url = new URL(req.url)
      const categoria = url.searchParams.get('categoria')
      const desde = url.searchParams.get('desde')
      const hasta = url.searchParams.get('hasta')

      let query = supabase
        .from('gastos_operativos')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(200)

      if (categoria) query = query.eq('categoria', categoria)
      if (desde) query = query.gte('fecha', desde)
      if (hasta) query = query.lte('fecha', hasta)

      const { data, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)

  } catch (err) {
    console.error('[GET /api/gastos]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}

// ── POST /api/gastos ────────────────────────────────────────────────────────
// Creates the gasto_operativo AND its matching ledger entry (transacciones,
// tipo='gasto') in one call. The two inserts aren't wrapped in a SQL
// transaction — if the ledger insert fails, we roll back the gasto manually
// so the accounting stays consistent.
export async function POST(req: Request) {
  try {
    const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

      const body = await req.json().catch(() => ({}))
      const {
        fecha,
        categoria,
        concepto,
        monto,
        metodo_pago,
        notas,
        comprobante_url,
      } = body ?? {}

      // ── Validation ────────────────────────────────────────────────────────────
      if (!categoria || !CATEGORIAS.includes(categoria)) {
        return NextResponse.json(
          { error: `Categoría inválida. Valores permitidos: ${CATEGORIAS.join(' | ')}` },
          { status: 400 }
        )
      }
      const conceptoTrim = typeof concepto === 'string' ? concepto.trim() : ''
      if (!conceptoTrim) {
        return NextResponse.json({ error: 'El concepto es obligatorio' }, { status: 400 })
      }
      const montoNum = Number(monto)
      if (!Number.isFinite(montoNum) || montoNum <= 0) {
        return NextResponse.json({ error: 'El monto debe ser un número positivo' }, { status: 400 })
      }

      const fechaStr = (typeof fecha === 'string' && fecha) ? fecha : new Date().toISOString().split('T')[0]

      // ── Insert gasto ──────────────────────────────────────────────────────────
      const { data: gasto, error: gErr } = await supabase
        .from('gastos_operativos')
        .insert({
          fecha: fechaStr,
          categoria,
          concepto: conceptoTrim,
          monto: montoNum,
          metodo_pago: typeof metodo_pago === 'string' && metodo_pago.trim() ? metodo_pago.trim() : null,
          notas: typeof notas === 'string' && notas.trim() ? notas.trim() : null,
          comprobante_url: typeof comprobante_url === 'string' && comprobante_url.trim() ? comprobante_url.trim() : null,
          creado_por: user.id,
        })
        .select()
        .single()

      if (gErr || !gasto) {
        return NextResponse.json({ error: gErr?.message ?? 'Error al crear gasto' }, { status: 500 })
      }

      // ── Mirror into transacciones (the accounting ledger) ────────────────────
      const { error: tErr } = await supabase.from('transacciones').insert({
        tipo: 'gasto',
        monto: montoNum,
        fecha: fechaStr,
        concepto: conceptoTrim,
        referencia_tipo: 'gasto_operativo',
        referencia_id: gasto.id,
        usuario_id: user.id,
        categoria_gasto: categoria,
      })

      if (tErr) {
        // Roll back the gasto so we never have an orphan row.
        await supabase.from('gastos_operativos').delete().eq('id', gasto.id)
        return NextResponse.json(
          { error: `Error al registrar en el libro contable: ${tErr.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json(gasto, { status: 201 })

  } catch (err) {
    console.error('[POST /api/gastos]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
