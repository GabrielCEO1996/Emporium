import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/pedidos/venta-directa
//
// One-shot "Venta Directa" — creates a pedido + factura already paid,
// deducts inventory, records the ledger entry, and returns the factura
// id for immediate printing.
//
// Body:
//   {
//     cliente_id, items:[{presentacion_id, cantidad, precio_unitario, descuento, subtotal}],
//     subtotal, descuento, impuesto, total,
//     notas?, direccion_entrega?,
//     metodo_pago: 'efectivo' | 'zelle' | 'cheque' | 'tarjeta',
//     numero_referencia?: string|null,
//   }
//
// Access: admin OR vendedor (vendedores can take cash sales without approval)
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase
        .from('profiles').select('id, rol').eq('id', authUser.id).single()
      const rol = profile?.rol
      if (rol !== 'admin' && rol !== 'vendedor') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      const body = await request.json().catch(() => ({}))
      const {
        cliente_id,
        items,
        subtotal,
        descuento = 0,
        impuesto = 0,
        total,
        notas = null,
        direccion_entrega = null,
        metodo_pago,
        numero_referencia = null,
      } = body as any

      // ── Validation ────────────────────────────────────────────────────────
      if (!cliente_id) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
      if (!Array.isArray(items) || items.length === 0)
        return NextResponse.json({ error: 'Debe incluir al menos un producto' }, { status: 400 })
      if (typeof total !== 'number' || total < 0)
        return NextResponse.json({ error: 'total inválido' }, { status: 400 })

      const VALID_METODOS = ['efectivo', 'zelle', 'cheque', 'tarjeta'] as const
      if (!VALID_METODOS.includes(metodo_pago)) {
        return NextResponse.json(
          { error: `metodo_pago inválido. Valores: ${VALID_METODOS.join(', ')}` },
          { status: 400 }
        )
      }

      // ── 1. Stock check ────────────────────────────────────────────────────
      for (const it of items) {
        const { data: inv } = await supabase
          .from('inventario')
          .select('stock_disponible')
          .eq('presentacion_id', it.presentacion_id)
          .maybeSingle()
        const disponible = inv?.stock_disponible ?? 0
        if (disponible < it.cantidad) {
          return NextResponse.json(
            { error: `Stock insuficiente para un producto (disponible: ${disponible}, solicitado: ${it.cantidad})` },
            { status: 409 }
          )
        }
      }

      // ── 2. Sequence numbers ───────────────────────────────────────────────
      const { data: pedNum } = await supabase.rpc('get_next_sequence', { seq_name: 'pedidos' })
      const pedidoNumero = (pedNum as string) || `PED-${Date.now()}`

      const { data: facNum } = await supabase.rpc('get_next_sequence', { seq_name: 'facturas' })
      const facturaNumero = (facNum as string) || `FAC-${Date.now()}`

      // ── 3. Create pedido in 'entregada' state (skip middle states) ────────
      const vendedorId = rol === 'vendedor' ? authUser.id : (body.vendedor_id || authUser.id)

      const { data: pedido, error: pedidoErr } = await supabase
        .from('pedidos')
        .insert({
          numero: pedidoNumero,
          cliente_id,
          vendedor_id: vendedorId,
          estado: 'entregada',
          subtotal,
          descuento,
          impuesto,
          total,
          notas,
          direccion_entrega,
          fecha_entrega_real: new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

      if (pedidoErr || !pedido) {
        return NextResponse.json({ error: pedidoErr?.message ?? 'Error al crear pedido' }, { status: 500 })
      }

      // ── 4. pedido_items ───────────────────────────────────────────────────
      const pedidoItems = items.map((i: any) => ({
        pedido_id: pedido.id,
        presentacion_id: i.presentacion_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        descuento: i.descuento ?? 0,
        subtotal: i.subtotal,
      }))
      const { error: piErr } = await supabase.from('pedido_items').insert(pedidoItems)
      if (piErr) {
        await supabase.from('pedidos').delete().eq('id', pedido.id)
        return NextResponse.json({ error: piErr.message }, { status: 500 })
      }

      // ── 5. Create factura already 'pagada' ────────────────────────────────
      // Map frontend metodo_pago → DB tipo_pago. USA business accepts only:
      // zelle | cheque | stripe | credito | efectivo. 'transferencia' is legacy.
      // 'tarjeta' maps to 'stripe'. Everything else passes through unchanged.
      const dbTipoPago: string =
        metodo_pago === 'tarjeta' ? 'stripe' : metodo_pago

      const { data: factura, error: facturaErr } = await supabase
        .from('facturas')
        .insert({
          numero: facturaNumero,
          pedido_id: pedido.id,
          cliente_id,
          vendedor_id: vendedorId,
          estado: 'pagada',
          fecha_emision: new Date().toISOString().split('T')[0],
          subtotal,
          descuento,
          base_imponible: subtotal - descuento,
          tasa_impuesto: 0,
          impuesto,
          total,
          monto_pagado: total,
          notas: `Venta directa — ${metodo_pago.toUpperCase()}${numero_referencia ? ` / Ref: ${numero_referencia}` : ''}`,
        })
        .select()
        .single()

      if (facturaErr || !factura) {
        await supabase.from('pedido_items').delete().eq('pedido_id', pedido.id)
        await supabase.from('pedidos').delete().eq('id', pedido.id)
        return NextResponse.json({ error: facturaErr?.message ?? 'Error al crear factura' }, { status: 500 })
      }

      // Best-effort: record payment method on orden-style columns if they exist on facturas
      try {
        await supabase
          .from('facturas')
          .update({ tipo_pago: dbTipoPago, numero_referencia, pago_confirmado: true, pago_confirmado_at: new Date().toISOString() })
          .eq('id', factura.id)
      } catch { /* columns may not exist — ignore */ }

      // ── 6. factura_items ──────────────────────────────────────────────────
      const facturaItems = await Promise.all(items.map(async (i: any) => {
        const { data: pres } = await supabase
          .from('presentaciones').select('nombre').eq('id', i.presentacion_id).maybeSingle()
        return {
          factura_id: factura.id,
          presentacion_id: i.presentacion_id,
          descripcion: pres?.nombre ?? 'Artículo',
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          descuento: i.descuento ?? 0,
          subtotal: i.subtotal,
        }
      }))
      const { error: facItemsErr } = await supabase
        .from('factura_items')
        .insert(facturaItems)
      if (facItemsErr) {
        // Critical: factura exists but its items didn't land. Roll back the
        // factura + pedido + items so we don't leave an empty-line factura
        // visible in /facturas (which would also misrepresent revenue).
        // Order matters: factura_items (none yet, but defensive), factura,
        // pedido_items, pedido. RLS allows admin/vendedor for all.
        console.error('[venta-directa] factura_items insert failed, rolling back:', facItemsErr)
        await supabase.from('factura_items').delete().eq('factura_id', factura.id)
        await supabase.from('facturas').delete().eq('id', factura.id)
        await supabase.from('pedido_items').delete().eq('pedido_id', pedido.id)
        await supabase.from('pedidos').delete().eq('id', pedido.id)
        return NextResponse.json(
          { error: 'No se pudieron registrar los renglones de la factura. Operación revertida.' },
          { status: 500 }
        )
      }

      // ── 6b. Price memory (historial_precios_cliente) ──────────────────────
      // Record the exact sold price per producto so Mache can see "last sold
      // to this cliente at $X" next time. Non-fatal on failure.
      try {
        const presIds = Array.from(
          new Set(items.map((i: any) => i.presentacion_id).filter(Boolean))
        )
        if (presIds.length > 0) {
          const { data: presRows } = await supabase
            .from('presentaciones')
            .select('id, producto_id')
            .in('id', presIds)
          const productoByPres: Record<string, string> = {}
          for (const p of presRows ?? []) {
            productoByPres[(p as any).id] = (p as any).producto_id
          }
          const histRows = items
            .map((it: any) => {
              const producto_id = productoByPres[it.presentacion_id]
              if (!producto_id) return null
              return {
                cliente_id,
                producto_id,
                presentacion_id: it.presentacion_id,
                precio_vendido: it.precio_unitario,
                cantidad: it.cantidad,
                fecha: factura.fecha_emision,
                factura_id: factura.id,
                pedido_id: pedido.id,
              }
            })
            .filter(Boolean)
          if (histRows.length > 0) {
            const { error: hErr } = await supabase
              .from('historial_precios_cliente')
              .insert(histRows)
            if (hErr) console.warn('[venta-directa] historial non-fatal:', hErr.message)
          }
        }
      } catch (hErr) {
        console.warn('[venta-directa] historial non-fatal:', hErr)
      }

      // ── 7. Inventory deduction + movement log ─────────────────────────────
      await Promise.all(items.map(async (it: any) => {
        const { data: inv } = await supabase
          .from('inventario')
          .select('id, stock_total, producto_id')
          .eq('presentacion_id', it.presentacion_id)
          .maybeSingle()
        if (!inv) return

        const nuevoTotal = Math.max(0, (inv.stock_total ?? 0) - it.cantidad)

        await supabase.from('inventario')
          .update({ stock_total: nuevoTotal })
          .eq('id', inv.id)

        await supabase.from('presentaciones')
          .update({ stock: nuevoTotal, updated_at: new Date().toISOString() })
          .eq('id', it.presentacion_id)

        await supabase.from('inventario_movimientos').insert({
          producto_id: inv.producto_id,
          presentacion_id: it.presentacion_id,
          tipo: 'salida',
          cantidad: it.cantidad,
          stock_anterior: inv.stock_total ?? 0,
          stock_nuevo: nuevoTotal,
          referencia_tipo: 'venta_directa',
          referencia_id: pedido.id,
          usuario_id: authUser.id,
          notas: `Venta directa — factura ${factura.numero}`,
        })
      }))

      // ── 8. Ledger (ingreso) ───────────────────────────────────────────────
      try {
        await supabase.from('transacciones').insert({
          tipo: 'ingreso',
          monto: total,
          fecha: new Date().toISOString().split('T')[0],
          concepto: `Venta directa ${factura.numero} — ${metodo_pago}`,
          referencia_tipo: 'venta_directa',
          referencia_id: factura.id,
          usuario_id: authUser.id,
        })
      } catch (err) {
        console.error('[venta-directa] ledger non-fatal:', err)
      }

      // ── 9. Activity log ───────────────────────────────────────────────────
      void logActivity(supabase, {
        user_id: authUser.id,
        action: 'venta_directa',
        resource: 'facturas',
        resource_id: factura.id,
        estado_nuevo: 'pagada',
        details: {
          pedido_id: pedido.id,
          pedido_numero: pedido.numero,
          factura_numero: factura.numero,
          metodo_pago,
          numero_referencia,
          total,
          cliente_id,
        },
      })

      return NextResponse.json({
        success: true,
        pedido,
        factura,
        factura_id: factura.id,
      }, { status: 201 })

  } catch (err) {
    console.error('[POST /api/pedidos/venta-directa]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
