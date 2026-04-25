import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAdminOrVendedor } from '@/lib/auth'

// Disable all caching — pricing context must be fresh per-request.
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/pricing/sugerido
 *
 * Given a cliente_id and an array of presentacion_ids, return the full
 * pricing context Mache needs for each line:
 *   • precio_oficial  (presentacion.precio_venta, best-effort from inventario)
 *   • precio_costo    (presentacion.costo)
 *   • descuento_global_pct (cliente.descuento_porcentaje)
 *   • precio_con_descuento = precio_oficial × (1 - pct/100)
 *   • ultima_venta { precio, cantidad, fecha, dias_atras } — from historial_precios_cliente
 *
 * The result is keyed by presentacion_id so the frontend can render it
 * inline in the cart.
 *
 * Access: admin OR vendedor.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const gate = await requireAdminOrVendedor(supabase)
    if (!gate.ok) return gate.response

    const body = await request.json().catch(() => ({} as any))
    const cliente_id: string | null = body?.cliente_id ?? null
    const presentacion_ids: string[] = Array.isArray(body?.presentacion_ids) ? body.presentacion_ids : []

    if (!cliente_id) {
      return NextResponse.json({ error: 'cliente_id es requerido' }, { status: 400 })
    }
    if (presentacion_ids.length === 0) {
      return NextResponse.json({ context: {} })
    }

    // 1) Cliente for global discount.
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nombre, descuento_porcentaje')
      .eq('id', cliente_id)
      .maybeSingle()
    const descuentoGlobalPct = Math.max(0, Math.min(100,
      Number((cliente as any)?.descuento_porcentaje ?? 0)
    ))

    // 2) Presentaciones — fetch precio + costo + producto_id.
    const { data: presRows } = await supabase
      .from('presentaciones')
      .select('id, producto_id, precio, costo')
      .in('id', presentacion_ids)

    // 3) Última venta a este cliente por cada presentación.
    //    We fetch the whole set for this cliente+presentaciones and reduce
    //    client-side to "most recent per presentacion_id" — avoids N queries.
    const { data: histRows } = await supabase
      .from('historial_precios_cliente')
      .select('presentacion_id, precio_vendido, cantidad, fecha, factura_id')
      .eq('cliente_id', cliente_id)
      .in('presentacion_id', presentacion_ids)
      .order('fecha', { ascending: false })
      .limit(500)

    const latestByPres: Record<string, {
      precio: number; cantidad: number; fecha: string; dias_atras: number; factura_id: string | null
    }> = {}
    const today = new Date()
    for (const h of (histRows ?? []) as any[]) {
      if (!h.presentacion_id) continue
      if (latestByPres[h.presentacion_id]) continue // we ordered fecha DESC, first wins
      const f = new Date(h.fecha)
      const dias = Math.max(0, Math.floor((today.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)))
      latestByPres[h.presentacion_id] = {
        precio: Number(h.precio_vendido ?? 0),
        cantidad: Number(h.cantidad ?? 0),
        fecha: h.fecha,
        dias_atras: dias,
        factura_id: h.factura_id ?? null,
      }
    }

    // 4) Assemble per-presentacion context.
    const context: Record<string, any> = {}
    for (const p of (presRows ?? []) as any[]) {
      const precioOficial = Number(p.precio ?? 0)
      const precioCosto = Number(p.costo ?? 0)
      const precioConDescuento = precioOficial * (1 - descuentoGlobalPct / 100)
      context[p.id] = {
        presentacion_id: p.id,
        producto_id: p.producto_id,
        precio_oficial: precioOficial,
        precio_costo: precioCosto,
        descuento_global_pct: descuentoGlobalPct,
        precio_con_descuento: precioConDescuento,
        ultima_venta: latestByPres[p.id] ?? null,
      }
    }

    return NextResponse.json({
      cliente: {
        id: cliente?.id ?? cliente_id,
        nombre: (cliente as any)?.nombre ?? null,
        descuento_porcentaje: descuentoGlobalPct,
      },
      context,
    })
  } catch (err: any) {
    console.error('[POST /api/pricing/sugerido]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
