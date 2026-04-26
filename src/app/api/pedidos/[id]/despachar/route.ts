import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'

// Disable all caching for this route handler — always serve fresh data.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/pedidos/[id]/despachar — ADMIN ONLY
// Modelo nuevo (Fase 4): el pedido siempre vive en estado='aprobada'.
// Lo que cambia es estado_despacho: 'por_despachar' → 'despachado'.
// La factura ya se creó al aprobar/confirmar el pedido (Fase 3) — acá
// solo movemos el estado de despacho. Si por algún caso edge no hay
// factura, la creamos como fallback (mantiene compat con datos viejos).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (profile?.rol !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden despachar pedidos' }, { status: 403 })
      }

      const { data: pedido } = await supabase
        .from('pedidos')
        .select('id, numero, estado, estado_despacho, cliente_id, vendedor_id, subtotal, descuento, total')
        .eq('id', params.id)
        .single()

      if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
      if (pedido.estado !== 'aprobada') {
        return NextResponse.json(
          { error: `Solo se pueden despachar pedidos aprobados (estado actual: ${pedido.estado})` },
          { status: 400 }
        )
      }
      // Guard sobre estado_despacho — no despachar dos veces, no despachar
      // algo ya entregado. Permitimos despachar cuando aún no se setteó
      // estado_despacho (datos legacy sin migrar).
      const ed = (pedido as any).estado_despacho
      if (ed && ed !== 'por_despachar') {
        return NextResponse.json(
          { error: `Pedido ya está ${ed === 'despachado' ? 'despachado' : 'entregado'}` },
          { status: 409 }
        )
      }

      // Auto-create factura if not exists
      const { data: existingFactura } = await supabase
        .from('facturas')
        .select('id, numero')
        .eq('pedido_id', params.id)
        .maybeSingle()

      let facturaId:     string | null = existingFactura?.id     ?? null
      let facturaNumero: string | null = existingFactura?.numero ?? null

      if (!facturaId) {
        const { data: pedidoItems } = await supabase
          .from('pedido_items')
          .select('*, presentacion:presentaciones(nombre)')
          .eq('pedido_id', params.id)

        const facturaItemsData = (pedidoItems ?? []).map((pi: any) => ({
          presentacion_id: pi.presentacion_id,
          descripcion: pi.presentacion?.nombre ?? 'Artículo',
          cantidad: pi.cantidad,
          precio_unitario: pi.precio_unitario,
          descuento: pi.descuento ?? 0,
          subtotal: pi.subtotal,
        }))

        const { data: seqData } = await supabase.rpc('get_next_sequence', { seq_name: 'facturas' })

        const { data: nuevaFactura, error: facturaError } = await supabase
          .from('facturas')
          .insert({
            numero: seqData,
            pedido_id: params.id,
            cliente_id: pedido.cliente_id,
            vendedor_id: pedido.vendedor_id ?? null,
            estado: 'emitida',
            fecha_emision: new Date().toISOString().split('T')[0],
            subtotal: pedido.subtotal,
            descuento: pedido.descuento ?? 0,
            base_imponible: pedido.subtotal - (pedido.descuento ?? 0),
            tasa_impuesto: 0,
            impuesto: 0,
            total: pedido.total,
            monto_pagado: 0,
          })
          .select()
          .single()

        if (facturaError || !nuevaFactura) {
          return NextResponse.json({ error: facturaError?.message ?? 'Error al crear factura' }, { status: 500 })
        }

        if (facturaItemsData.length > 0) {
          await supabase.from('factura_items').insert(
            facturaItemsData.map((i) => ({ ...i, factura_id: nuevaFactura.id }))
          )
        }

        facturaId     = nuevaFactura.id
        facturaNumero = nuevaFactura.numero
      }

      // Modelo nuevo: cambiamos estado_despacho, no estado. Defensive
      // cascade — si la columna no existe (DB sin migrar Fase 4), seguimos
      // moviendo el estado viejo a 'despachada' para mantener compat.
      let updated: any = null
      let updErr: any = null
      {
        const r = await supabase
          .from('pedidos')
          .update({ estado_despacho: 'despachado', updated_at: new Date().toISOString() })
          .eq('id', params.id)
          .select()
          .single()
        updated = r.data
        updErr = r.error
      }
      if (updErr && /estado_despacho/i.test(updErr.message || '')) {
        console.warn('[pedidos/despachar] estado_despacho missing — falling back to legacy estado=despachada')
        const r = await supabase
          .from('pedidos')
          .update({ estado: 'despachada', updated_at: new Date().toISOString() })
          .eq('id', params.id)
          .select()
          .single()
        updated = r.data
        updErr = r.error
      }
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

      // Activity log — link pedido ↔ factura so /historial can render both as clickable.
      // Fire-and-forget; a log failure must never roll back the state change.
      void logActivity(supabase as any, {
        user_id: user.id,
        action: 'despachar_pedido',
        resource: 'pedidos',
        resource_id: params.id,
        estado_anterior: ed ?? pedido.estado,
        estado_nuevo: 'despachado',
        details: {
          pedido_id:      params.id,
          pedido_numero:  pedido.numero,
          factura_id:     facturaId,
          factura_numero: facturaNumero,
        },
      })

      return NextResponse.json({ ...updated, factura_id: facturaId, factura_numero: facturaNumero })

  } catch (err) {
    console.error('[POST /api/pedidos/[id]/despachar]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
