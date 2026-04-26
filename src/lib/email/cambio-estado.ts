// ═══════════════════════════════════════════════════════════════════════════
// src/lib/email/cambio-estado.ts
//
// Notificaciones al cliente cuando una orden/pedido cambia de estado:
//   • aprobada       → "Tu orden EMP-X fue aprobada"
//   • pago_verificado → "Pago verificado · orden EMP-X aprobada"
//   • rechazada      → "Tu orden EMP-X no pudo ser procesada"
//   • despachado     → "Tu pedido EMP-X va en camino"   (Fase 6)
//
// Llamado por:
//   - /api/ordenes/[id]/aprobar
//   - /api/ordenes/[id]/rechazar
//   - /api/ordenes/[id]/confirmar-pago
//   - /api/pedidos/[id]/despachar  (resuelve orden via pedido.orden_id)
//   - /api/webhook/stripe (cuando webhook crea pedido tras pago Stripe OK)
//
// Nunca tira excepciones. Siempre devuelve { ok, sent, error? }. Los callers
// NO deben bloquear la respuesta al usuario si esto falla.
//
// TODO(emails-resend-domain): Mientras el dominio de Resend no esté
// verificado, los emails se mandan desde `onboarding@resend.dev` y solo
// llegan a los emails verificados como destinatarios de testing en la
// cuenta de Resend. Cuando el dominio esté verificado, cambiar `from`
// abajo a `notificaciones@<dominio-verificado>` y el envío llegará a
// cualquier destinatario.
// ═══════════════════════════════════════════════════════════════════════════

import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CambioEstadoTipo = 'aprobada' | 'pago_verificado' | 'rechazada' | 'despachado'

export interface CambioEstadoEmailResult {
  ok: boolean
  sent: boolean
  error?: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(n) || 0)
}

function escHtml(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface BuildArgs {
  tipo: CambioEstadoTipo
  /** Handle visible al cliente — preferimos transaccion_id (EMP-XXXX) si
   *  existe; si no, fallback a orden.numero (ORD-XXXX). */
  handle: string
  orden: { numero: string; total: number; tipo_pago: string | null }
  pedidoNumero: string | null
  cliente: { nombre: string | null; email: string | null }
  empresaNombre: string
  motivo: string | null
  siteUrl: string
}

function buildEmail(a: BuildArgs): { subject: string; html: string } {
  const { tipo, handle, orden, pedidoNumero, cliente, empresaNombre, motivo, siteUrl } = a
  const portalUrl = siteUrl ? `${siteUrl}/tienda/mis-pedidos` : ''

  // ── DESPACHADO ────────────────────────────────────────────────────────
  if (tipo === 'despachado') {
    const subject = `🚚 Tu pedido ${handle} va en camino · ${empresaNombre}`
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <tr><td style="background:#4F46E5;border-radius:14px 14px 0 0;padding:24px 28px;text-align:center">
    <div style="font-size:12px;letter-spacing:1px;color:#C7D2FE;text-transform:uppercase">Pedido despachado</div>
    <div style="font-size:24px;font-weight:800;color:#ffffff;margin-top:4px">${escHtml(handle)}</div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:24px 28px">
    <div style="font-size:15px;color:#1e293b;margin-bottom:10px">Hola ${escHtml(cliente.nombre ?? '')},</div>
    <div style="font-size:14px;color:#475569;line-height:1.6">
      Tu pedido <strong>${escHtml(handle)}</strong> ya está en camino. En breve te llegará.
    </div>
    <div style="font-size:13px;color:#64748b;margin-top:14px;padding:10px 12px;background:#eef2ff;border-radius:8px;border-left:3px solid #4F46E5;line-height:1.5">
      Si necesitás coordinar la entrega o tenés alguna consulta, respondé este correo.
    </div>
  </td></tr>

  ${portalUrl ? `
  <tr><td style="background:#ffffff;padding:0 28px 24px;text-align:center">
    <a href="${escHtml(portalUrl)}" style="display:inline-block;background:#4F46E5;color:#ffffff;padding:12px 28px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none">Ver mis pedidos →</a>
  </td></tr>` : ''}

  <tr><td style="background:#4F46E5;border-radius:0 0 14px 14px;padding:14px 28px;font-size:11px;color:#C7D2FE;text-align:center">
    ${escHtml(empresaNombre)} · Gracias por tu compra
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
    return { subject, html }
  }

  if (tipo === 'rechazada') {
    const subject = `Tu orden ${handle} no pudo ser procesada · ${empresaNombre}`
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <tr><td style="background:#dc2626;border-radius:14px 14px 0 0;padding:24px 28px;text-align:center">
    <div style="font-size:12px;letter-spacing:1px;color:#fecaca;text-transform:uppercase">Orden no procesada</div>
    <div style="font-size:24px;font-weight:800;color:#ffffff;margin-top:4px">${escHtml(handle)}</div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:24px 28px">
    <div style="font-size:15px;color:#1e293b;margin-bottom:10px">Hola ${escHtml(cliente.nombre ?? '')},</div>
    <div style="font-size:14px;color:#475569;line-height:1.6">
      Lamentamos informarte que tu orden <strong>${escHtml(handle)}</strong>
      por <strong>${fmt(orden.total)}</strong> no pudo ser procesada.
    </div>
    ${motivo ? `
    <div style="margin-top:16px;padding:12px 14px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:6px">
      <div style="font-size:11px;text-transform:uppercase;color:#991b1b;font-weight:700;margin-bottom:4px">Motivo</div>
      <div style="font-size:13px;color:#7f1d1d;line-height:1.5">${escHtml(motivo)}</div>
    </div>` : ''}
    <div style="font-size:13px;color:#64748b;margin-top:18px;line-height:1.5">
      El inventario quedó liberado. Si querés volver a intentarlo o hablar con nosotros,
      escribinos por WhatsApp o respondé este correo.
    </div>
  </td></tr>

  <tr><td style="background:#dc2626;border-radius:0 0 14px 14px;padding:14px 28px;font-size:11px;color:#fecaca;text-align:center">
    ${escHtml(empresaNombre)} · Estamos para ayudarte
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
    return { subject, html }
  }

  // Both 'aprobada' and 'pago_verificado' share the same green template, with
  // a slightly different sub-heading + intro.
  const isPagoVerificado = tipo === 'pago_verificado'
  const subject = isPagoVerificado
    ? `✅ Pago verificado · Orden ${orden.numero} aprobada · ${empresaNombre}`
    : `✅ Tu orden ${handle} fue aprobada · ${empresaNombre}`

  const intro = isPagoVerificado
    ? `Verificamos tu pago${orden.tipo_pago ? ` (${escHtml(orden.tipo_pago)})` : ''} y aprobamos tu orden <strong>${escHtml(handle)}</strong> por <strong style="color:#0D9488">${fmt(orden.total)}</strong>. Procederemos con el despacho a la brevedad.`
    : `Buenas noticias: aprobamos tu orden <strong>${escHtml(handle)}</strong> por <strong style="color:#0D9488">${fmt(orden.total)}</strong>. Comenzamos a prepararla para el despacho.`

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <tr><td style="background:#0D9488;border-radius:14px 14px 0 0;padding:24px 28px;text-align:center">
    <div style="font-size:12px;letter-spacing:1px;color:#5EEAD4;text-transform:uppercase">${isPagoVerificado ? 'Pago verificado · Orden aprobada' : 'Orden aprobada'}</div>
    <div style="font-size:24px;font-weight:800;color:#ffffff;margin-top:4px">${escHtml(handle)}</div>
    ${pedidoNumero ? `<div style="font-size:13px;color:#CCFBF1;margin-top:4px">Pedido ${escHtml(pedidoNumero)}</div>` : ''}
  </td></tr>

  <tr><td style="background:#ffffff;padding:24px 28px">
    <div style="font-size:15px;color:#1e293b;margin-bottom:10px">Hola ${escHtml(cliente.nombre ?? '')},</div>
    <div style="font-size:14px;color:#475569;line-height:1.6">${intro}</div>
    <div style="font-size:13px;color:#64748b;margin-top:14px;padding:10px 12px;background:#f0fdfa;border-radius:8px;border-left:3px solid #0D9488;line-height:1.5">
      Te avisaremos cuando el pedido esté en camino. Si necesitás coordinar la
      entrega, respondé este correo.
    </div>
  </td></tr>

  ${portalUrl ? `
  <tr><td style="background:#ffffff;padding:0 28px 24px;text-align:center">
    <a href="${escHtml(portalUrl)}" style="display:inline-block;background:#0D9488;color:#ffffff;padding:12px 28px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none">Ver mis pedidos →</a>
  </td></tr>` : ''}

  <tr><td style="background:#0D9488;border-radius:0 0 14px 14px;padding:14px 28px;font-size:11px;color:#CCFBF1;text-align:center">
    ${escHtml(empresaNombre)} · Gracias por confiar en nosotros
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
  return { subject, html }
}

/**
 * Send a "state change" notification email to the orden's customer.
 * Swallows all errors. Returns { ok, sent, error? }.
 *
 * @param supabase  Server-side Supabase client
 * @param ordenId   ID of the orden (used to load cliente.email + datos)
 * @param tipo      'aprobada' | 'pago_verificado' | 'rechazada'
 * @param opts.pedidoNumero  Pedido number (optional, shown in subject for aprobada)
 * @param opts.motivo        Reason (only used for 'rechazada')
 */
export async function sendCambioEstadoEmail(
  supabase: SupabaseClient,
  ordenId: string,
  tipo: CambioEstadoTipo,
  opts: { pedidoNumero?: string | null; motivo?: string | null } = {},
): Promise<CambioEstadoEmailResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn('[sendCambioEstadoEmail] RESEND_API_KEY missing — skipping')
      return { ok: false, sent: false, error: 'RESEND_API_KEY missing' }
    }

    const { data: orden, error: ordenErr } = await supabase
      .from('ordenes')
      .select('id, numero, total, tipo_pago, cliente_id, transaccion_id')
      .eq('id', ordenId)
      .maybeSingle()

    if (ordenErr || !orden) {
      console.error('[sendCambioEstadoEmail] orden not found:', ordenId, ordenErr)
      return { ok: false, sent: false, error: 'orden_not_found' }
    }

    const [{ data: cliente }, empresaRes] = await Promise.all([
      supabase
        .from('clientes')
        .select('nombre, email')
        .eq('id', orden.cliente_id)
        .maybeSingle(),
      supabase
        .from('empresa_config')
        .select('nombre')
        .limit(1)
        .maybeSingle(),
    ])

    if (!cliente?.email) {
      // No email on file — nothing to send. Not an error.
      return { ok: true, sent: false }
    }

    const empresaNombre = (empresaRes?.data?.nombre as string) || 'Emporium'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

    // Handle visible al cliente — preferimos EMP-XXXX (transaccion_id)
    // sobre ORD-XXXX (numero). El cliente solo ve el handle maestro,
    // que es el mismo a través de orden / pedido / factura.
    const handle = (orden as any).transaccion_id || orden.numero

    const { subject, html } = buildEmail({
      tipo,
      handle,
      orden: {
        numero: orden.numero,
        total: Number(orden.total) || 0,
        tipo_pago: orden.tipo_pago ?? null,
      },
      pedidoNumero: opts.pedidoNumero ?? null,
      cliente: { nombre: cliente.nombre ?? null, email: cliente.email },
      empresaNombre,
      motivo: opts.motivo ?? null,
      siteUrl,
    })

    const resend = new Resend(apiKey)
    // TODO(emails-resend-domain): cambiar a `notificaciones@<dominio
    // verificado>` cuando se complete la verificación de dominio en Resend.
    // Mientras tanto, usar onboarding@resend.dev solo entrega a destinatarios
    // pre-verificados en la cuenta de Resend (modo testing).
    const from = `${empresaNombre} <onboarding@resend.dev>`

    const res = await resend.emails
      .send({ from, to: cliente.email, subject, html })
      .catch(err => ({ error: { message: err?.message ?? String(err) } } as any))

    if (res?.error) {
      console.error('[sendCambioEstadoEmail] send failed:', res.error)
      return { ok: false, sent: false, error: String(res.error?.message ?? 'send_failed') }
    }

    return { ok: true, sent: true }
  } catch (err: any) {
    console.error('[sendCambioEstadoEmail] threw:', err)
    return { ok: false, sent: false, error: err?.message ?? 'unexpected' }
  }
}
