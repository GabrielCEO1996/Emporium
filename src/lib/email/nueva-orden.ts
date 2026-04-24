// ═══════════════════════════════════════════════════════════════════════════
// src/lib/email/nueva-orden.ts
//
// Shared template + send logic for "new tienda order" notifications.
// Called by:
//   1. /api/email/nueva-orden (user-session-authenticated entrypoint)
//   2. /api/webhook/stripe     (server-to-server, after successful payment)
//
// Never throws. Returns { ok, admin_sent, cliente_sent, error? }. Callers
// must NOT block user-facing flows on failures here — email is a best-effort.
// ═══════════════════════════════════════════════════════════════════════════

import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface NuevaOrdenEmailResult {
  ok: boolean
  admin_sent: boolean
  cliente_sent: boolean
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

function paymentBadge(
  tipo: string | null,
  _confirmed: boolean,
  proofUrl: string | null,
  ref: string | null,
): string {
  if (!tipo) return ''
  const t = tipo.toLowerCase()
  const proofLink = proofUrl
    ? `<a href="${escHtml(proofUrl)}" target="_blank" style="color:#0D9488;font-weight:600;text-decoration:underline">Ver comprobante</a>`
    : ''
  if (t === 'stripe') {
    return `<div style="background:#dcfce7;border:1px solid #86efac;color:#166534;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600">✅ Pago confirmado por Stripe</div>`
  }
  if (t === 'zelle') {
    return `<div style="background:#fef3c7;border:1px solid #fcd34d;color:#92400e;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600">⏳ Zelle pendiente de verificación${ref ? ` · Ref: <code>${escHtml(ref)}</code>` : ''}${proofLink ? ` · ${proofLink}` : ''}</div>`
  }
  if (t === 'cheque') {
    return `<div style="background:#fef3c7;border:1px solid #fcd34d;color:#92400e;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600">⏳ Cheque pendiente de verificación${ref ? ` · Nº ${escHtml(ref)}` : ''}${proofLink ? ` · ${proofLink}` : ''}</div>`
  }
  if (t === 'efectivo') {
    return `<div style="background:#ccfbf1;border:1px solid #5eead4;color:#115e59;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600">💵 Pago en efectivo al recibir</div>`
  }
  if (t === 'credito') {
    return `<div style="background:#fde68a;border:1px solid #f59e0b;color:#78350f;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600">📝 Crédito autorizado</div>`
  }
  return `<div style="background:#f1f5f9;color:#475569;padding:10px 14px;border-radius:8px;font-size:13px">${escHtml(tipo)}</div>`
}

function itemsTableHtml(items: Array<{ descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }>): string {
  if (!items || items.length === 0) {
    return '<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8">Sin artículos</td></tr>'
  }
  return items.map((i, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}">
      <td style="padding:10px 14px;font-size:13px;color:#1e293b">${escHtml(i.descripcion)}</td>
      <td style="padding:10px 14px;font-size:13px;color:#475569;text-align:center">${i.cantidad}</td>
      <td style="padding:10px 14px;font-size:13px;color:#475569;text-align:right">${fmt(i.precio_unitario)}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1e293b;text-align:right">${fmt(i.subtotal)}</td>
    </tr>
  `).join('')
}

function buildAdminEmail(orden: any, cliente: any, items: any[], panelUrl: string) {
  const badge = paymentBadge(orden.tipo_pago, orden.pago_confirmado, orden.payment_proof_url, orden.numero_referencia)
  const subject = `🛒 Nuevo pedido ${orden.numero} · ${cliente?.nombre ?? 'Cliente'} · ${fmt(orden.total)}`
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 16px">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%">

  <tr><td style="background:#0D9488;border-radius:14px 14px 0 0;padding:22px 28px">
    <div style="font-size:11px;letter-spacing:1px;color:#5EEAD4;text-transform:uppercase">Nueva orden recibida</div>
    <div style="font-size:22px;font-weight:800;color:#ffffff;margin-top:4px">${escHtml(orden.numero)}</div>
    <div style="font-size:13px;color:#CCFBF1;margin-top:2px">Total ${fmt(orden.total)} · ${new Date(orden.created_at).toLocaleString('es-VE')}</div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:18px 28px 0">${badge}</td></tr>

  <tr><td style="background:#ffffff;padding:18px 28px">
    <div style="font-size:11px;text-transform:uppercase;color:#0D9488;font-weight:700;margin-bottom:6px">Cliente</div>
    <div style="font-size:15px;font-weight:700;color:#1e293b">${escHtml(cliente?.nombre ?? '—')}</div>
    ${cliente?.email ? `<div style="font-size:13px;color:#64748b">✉️ ${escHtml(cliente.email)}</div>` : ''}
    ${cliente?.telefono ? `<div style="font-size:13px;color:#64748b">📞 ${escHtml(cliente.telefono)}</div>` : ''}
    ${orden.direccion_entrega ? `<div style="font-size:13px;color:#64748b;margin-top:6px">📍 ${escHtml(orden.direccion_entrega)}</div>` : ''}
    ${orden.notas ? `<div style="font-size:13px;color:#64748b;margin-top:6px;padding:8px;background:#f8fafc;border-radius:6px"><strong>Notas:</strong> ${escHtml(orden.notas)}</div>` : ''}
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 28px 18px">
    <div style="font-size:11px;text-transform:uppercase;color:#0D9488;font-weight:700;margin-bottom:8px">Productos</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#0D9488;color:#ffffff">
          <th style="padding:10px 14px;font-size:11px;text-align:left">Descripción</th>
          <th style="padding:10px 14px;font-size:11px;text-align:center">Cant.</th>
          <th style="padding:10px 14px;font-size:11px;text-align:right">P. Unit.</th>
          <th style="padding:10px 14px;font-size:11px;text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsTableHtml(items)}</tbody>
    </table>
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 28px 24px">
    <table cellpadding="0" cellspacing="0" style="margin-left:auto">
      <tr>
        <td style="padding:8px 14px;font-size:13px;color:#64748b">Total</td>
        <td style="padding:8px 14px;font-size:18px;font-weight:800;color:#0D9488;text-align:right">${fmt(orden.total)}</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 28px 24px;text-align:center">
    <a href="${escHtml(panelUrl)}" style="display:inline-block;background:#0D9488;color:#ffffff;padding:12px 28px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none">Abrir panel de órdenes →</a>
  </td></tr>

  <tr><td style="background:#0D9488;border-radius:0 0 14px 14px;padding:14px 28px;font-size:11px;color:#CCFBF1;text-align:center">
    Emporium · Notificación automática de nueva orden
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
  return { subject, html }
}

function buildClienteEmail(orden: any, cliente: any, items: any[], empresaNombre: string) {
  const subject = `Recibimos tu orden ${orden.numero} · ${empresaNombre}`
  const nextSteps = (() => {
    const t = (orden.tipo_pago ?? '').toLowerCase()
    if (t === 'stripe' && orden.pago_confirmado) return 'Tu pago ha sido confirmado y tu orden está en proceso.'
    if (t === 'stripe') return 'Estamos confirmando tu pago con Stripe. Recibirás otra notificación al aprobarse.'
    if (t === 'zelle')  return 'Hemos recibido tu confirmación de Zelle. Verificaremos el pago y aprobaremos tu orden a la brevedad.'
    if (t === 'cheque') return 'Coordina con nuestro equipo la entrega del cheque. Tu orden quedará en espera hasta recibirlo.'
    if (t === 'efectivo') return 'Pagarás al recibir tu pedido. Nuestro equipo te contactará pronto para coordinar.'
    if (t === 'credito') return 'Tu orden quedó registrada contra tu línea de crédito. Será procesada en breve.'
    return 'Tu orden quedó registrada y será procesada en breve.'
  })()

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <tr><td style="background:#0D9488;border-radius:14px 14px 0 0;padding:24px 28px;text-align:center">
    <div style="font-size:12px;letter-spacing:1px;color:#5EEAD4;text-transform:uppercase">Orden recibida</div>
    <div style="font-size:24px;font-weight:800;color:#ffffff;margin-top:4px">${escHtml(orden.numero)}</div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:24px 28px">
    <div style="font-size:15px;color:#1e293b;margin-bottom:10px">Hola ${escHtml(cliente?.nombre ?? '')},</div>
    <div style="font-size:14px;color:#475569;line-height:1.5">
      ¡Gracias por tu compra en ${escHtml(empresaNombre)}! Hemos recibido tu orden
      <strong>${escHtml(orden.numero)}</strong> por un total de
      <strong style="color:#0D9488">${fmt(orden.total)}</strong>.
    </div>
    <div style="font-size:13px;color:#64748b;margin-top:12px;padding:10px 12px;background:#f8fafc;border-radius:8px;border-left:3px solid #0D9488">
      ${escHtml(nextSteps)}
    </div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 28px 18px">
    <div style="font-size:11px;text-transform:uppercase;color:#0D9488;font-weight:700;margin-bottom:8px">Detalle</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f1f5f9;color:#334155">
          <th style="padding:8px 12px;font-size:11px;text-align:left">Producto</th>
          <th style="padding:8px 12px;font-size:11px;text-align:center">Cant.</th>
          <th style="padding:8px 12px;font-size:11px;text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td style="padding:10px 12px;font-size:13px;color:#1e293b">${escHtml(i.descripcion)}</td>
            <td style="padding:10px 12px;font-size:13px;text-align:center;color:#475569">${i.cantidad}</td>
            <td style="padding:10px 12px;font-size:13px;text-align:right;font-weight:600;color:#1e293b">${fmt(i.subtotal)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </td></tr>

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
 * Send admin + customer notification emails for a new orden.
 * Swallows all errors — returns { ok: false } + logs, never throws.
 */
export async function sendNuevaOrdenEmail(
  supabase: SupabaseClient,
  orden_id: string,
): Promise<NuevaOrdenEmailResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn('[sendNuevaOrdenEmail] RESEND_API_KEY missing — skipping send')
      return { ok: false, admin_sent: false, cliente_sent: false, error: 'RESEND_API_KEY missing' }
    }

    const { data: orden, error: ordenErr } = await supabase
      .from('ordenes')
      .select(`
        id, numero, estado, total, notas, direccion_entrega, created_at,
        tipo_pago, numero_referencia, pago_confirmado,
        user_id, cliente_id,
        payment_proof_url
      `)
      .eq('id', orden_id)
      .maybeSingle()

    if (ordenErr || !orden) {
      console.error('[sendNuevaOrdenEmail] orden not found:', orden_id, ordenErr)
      return { ok: false, admin_sent: false, cliente_sent: false, error: 'orden_not_found' }
    }

    const [{ data: cliente }, { data: itemsRaw }, { data: empresa }] = await Promise.all([
      supabase
        .from('clientes')
        .select('nombre, email, telefono')
        .eq('id', orden.cliente_id)
        .maybeSingle(),
      supabase
        .from('orden_items')
        .select('cantidad, precio_unitario, subtotal, presentacion:presentaciones(nombre, producto:productos(nombre))')
        .eq('orden_id', orden.id),
      supabase
        .from('empresa_config')
        .select('nombre')
        .limit(1)
        .maybeSingle(),
    ])

    const items = (itemsRaw ?? []).map((i: any) => ({
      descripcion:
        [i.presentacion?.producto?.nombre, i.presentacion?.nombre].filter(Boolean).join(' — ') ||
        'Producto',
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      subtotal: Number(i.subtotal),
    }))

    const empresaNombre = (empresa?.nombre as string) || 'Emporium'
    const adminEmail = process.env.ADMIN_EMAIL || 'empoinc.25@gmail.com'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    const panelUrl = siteUrl ? `${siteUrl}/ordenes` : 'https://emporium.vercel.app/ordenes'

    const resend = new Resend(apiKey)
    const from = `${empresaNombre} <onboarding@resend.dev>`

    // Admin email — always sent.
    const adminMsg = buildAdminEmail(orden, cliente, items, panelUrl)
    const adminRes = await resend.emails
      .send({ from, to: adminEmail, subject: adminMsg.subject, html: adminMsg.html })
      .catch(err => ({ error: { message: err?.message ?? String(err) } } as any))
    const adminOk = !adminRes?.error
    if (!adminOk) console.error('[sendNuevaOrdenEmail] admin send failed:', adminRes.error)

    // Customer email — only if the cliente has an email.
    let clienteOk = false
    if (cliente?.email) {
      const clienteMsg = buildClienteEmail(orden, cliente, items, empresaNombre)
      const clienteRes = await resend.emails
        .send({ from, to: cliente.email, subject: clienteMsg.subject, html: clienteMsg.html })
        .catch(err => ({ error: { message: err?.message ?? String(err) } } as any))
      clienteOk = !clienteRes?.error
      if (!clienteOk) console.error('[sendNuevaOrdenEmail] cliente send failed:', clienteRes.error)
    }

    return {
      ok: adminOk || clienteOk,
      admin_sent: adminOk,
      cliente_sent: clienteOk,
    }
  } catch (err: any) {
    console.error('[sendNuevaOrdenEmail] threw:', err)
    return {
      ok: false,
      admin_sent: false,
      cliente_sent: false,
      error: err?.message ?? 'unexpected',
    }
  }
}
