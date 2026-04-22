import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

function fmt(n: number) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n ?? 0)
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

function buildHtml(factura: any, empresa: any): string {
  const emp = {
    nombre: empresa?.nombre ?? 'Emporium',
    rif: empresa?.rif ?? '',
    telefono: empresa?.telefono ?? '',
    email: empresa?.email ?? '',
    direccion: empresa?.direccion ?? '',
    mensaje_factura: empresa?.mensaje_factura ?? 'Gracias por su compra',
    logo_url: empresa?.logo_url ?? '',
  }

  const itemRows = (factura.items ?? []).map((item: any, i: number) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
      <td style="padding:10px 14px;color:#1e293b;font-size:13px">${item.descripcion}</td>
      <td style="padding:10px 14px;text-align:center;color:#475569;font-size:13px">${item.cantidad}</td>
      <td style="padding:10px 14px;text-align:right;color:#475569;font-size:13px">${fmt(item.precio_unitario)}</td>
      <td style="padding:10px 14px;text-align:right;color:#475569;font-size:13px">${item.descuento > 0 ? item.descuento + '%' : '—'}</td>
      <td style="padding:10px 14px;text-align:right;font-weight:600;color:#1e293b;font-size:13px">${fmt(item.subtotal)}</td>
    </tr>`).join('')

  const saldo = (factura.total ?? 0) - (factura.monto_pagado ?? 0)

  const discountRow = factura.descuento > 0
    ? `<tr><td style="padding:6px 14px;color:#64748b;font-size:13px">Descuento</td><td style="padding:6px 14px;text-align:right;color:#dc2626;font-weight:600;font-size:13px">− ${fmt(factura.descuento)}</td></tr>`
    : ''

  const estadoColors: Record<string, string> = {
    emitida: '#3B82F6', pagada: '#16a34a', anulada: '#dc2626', con_nota_credito: '#d97706',
  }
  const estadoLabels: Record<string, string> = {
    emitida: 'EMITIDA', pagada: 'PAGADA', anulada: 'ANULADA', con_nota_credito: 'CON NOTA CRÉDITO',
  }
  const estadoColor = estadoColors[factura.estado] ?? '#3B82F6'
  const estadoLabel = estadoLabels[factura.estado] ?? factura.estado.toUpperCase()

  const logoHtml = emp.logo_url
    ? `<img src="${emp.logo_url}" alt="${emp.nombre}" style="height:44px;width:auto;object-fit:contain;border-radius:6px" />`
    : `<div style="width:44px;height:44px;background:#3B82F6;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;font-family:sans-serif">${emp.nombre.charAt(0).toUpperCase()}</div>`

  const contactLines = [
    emp.rif ? `EIN: ${emp.rif}` : null,
    emp.telefono ? `📞 ${emp.telefono}` : null,
    emp.email ? `✉️ ${emp.email}` : null,
    emp.direccion ? `📍 ${emp.direccion}` : null,
  ].filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:#2563EB;border-radius:14px 14px 0 0;padding:28px 32px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle">
          ${logoHtml}
          <div style="margin-top:10px">
            <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:1px">${emp.nombre.toUpperCase()}</div>
            <div style="font-size:11px;color:#93c5fd;margin-top:2px;letter-spacing:0.5px">DISTRIBUCIÓN COMERCIAL</div>
            ${contactLines ? `<div style="font-size:11px;color:#bfdbfe;margin-top:8px">${contactLines}</div>` : ''}
          </div>
        </td>
        <td style="vertical-align:top;text-align:right">
          <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:2px;opacity:0.9">FACTURA</div>
          <div style="font-size:15px;font-weight:700;color:#93c5fd;margin-top:4px">${factura.numero}</div>
          <div style="margin-top:10px;display:inline-block;background:${estadoColor}22;border:1px solid ${estadoColor}55;border-radius:20px;padding:4px 12px">
            <span style="font-size:11px;font-weight:700;color:${estadoColor};letter-spacing:1px">${estadoLabel}</span>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ACCENT STRIPE -->
  <tr><td style="height:4px;background:#3B82F6"></td></tr>

  <!-- META INFO -->
  <tr><td style="background:#ffffff;padding:24px 32px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" style="vertical-align:top;padding-right:12px">
          <div style="font-size:10px;font-weight:700;color:#3B82F6;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #dbeafe;padding-bottom:6px;margin-bottom:10px">Información de Factura</div>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="font-size:12px;color:#94a3b8;padding-bottom:5px;padding-right:16px">Número</td><td style="font-size:12px;font-weight:700;color:#2563EB">${factura.numero}</td></tr>
            <tr><td style="font-size:12px;color:#94a3b8;padding-bottom:5px;padding-right:16px">Emisión</td><td style="font-size:12px;font-weight:600;color:#1e293b">${fmtDate(factura.fecha_emision)}</td></tr>
            ${factura.fecha_vencimiento ? `<tr><td style="font-size:12px;color:#94a3b8;padding-right:16px">Vencimiento</td><td style="font-size:12px;font-weight:600;color:#1e293b">${fmtDate(factura.fecha_vencimiento)}</td></tr>` : ''}
          </table>
        </td>
        <td width="50%" style="vertical-align:top;padding-left:12px;border-left:1px solid #f1f5f9">
          <div style="font-size:10px;font-weight:700;color:#3B82F6;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #dbeafe;padding-bottom:6px;margin-bottom:10px">Cliente</div>
          <div style="font-size:14px;font-weight:700;color:#2563EB;margin-bottom:4px">${factura.cliente?.nombre ?? '—'}</div>
          ${factura.cliente?.rif ? `<div style="font-size:12px;color:#64748b;margin-bottom:2px">RIF: ${factura.cliente.rif}</div>` : ''}
          ${factura.cliente?.telefono ? `<div style="font-size:12px;color:#64748b;margin-bottom:2px">${factura.cliente.telefono}</div>` : ''}
          ${factura.cliente?.direccion ? `<div style="font-size:12px;color:#64748b">${factura.cliente.direccion}${factura.cliente.ciudad ? ', ' + factura.cliente.ciudad : ''}</div>` : ''}
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ITEMS TABLE -->
  <tr><td style="background:#ffffff;padding:0 32px 24px">
    <div style="font-size:10px;font-weight:700;color:#2563EB;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">Detalle de Artículos</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#2563EB">
          <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.5px">Descripción</th>
          <th style="padding:9px 14px;text-align:center;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.5px">Cant.</th>
          <th style="padding:9px 14px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.5px">P. Unit.</th>
          <th style="padding:9px 14px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.5px">Desc.</th>
          <th style="padding:9px 14px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.5px">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#94a3b8;font-size:13px">Sin artículos</td></tr>'}
      </tbody>
    </table>
  </td></tr>

  <!-- TOTALS -->
  <tr><td style="background:#ffffff;padding:0 32px 28px">
    <table cellpadding="0" cellspacing="0" style="margin-left:auto;width:260px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <tr><td style="padding:8px 14px;color:#64748b;font-size:13px;background:#ffffff;border-bottom:1px solid #e2e8f0">Subtotal</td><td style="padding:8px 14px;text-align:right;font-weight:600;font-size:13px;color:#1e293b;background:#ffffff;border-bottom:1px solid #e2e8f0">${fmt(factura.subtotal)}</td></tr>
      ${discountRow}
      <tr style="background:#2563EB"><td style="padding:12px 14px;font-size:14px;font-weight:800;color:#ffffff">TOTAL</td><td style="padding:12px 14px;text-align:right;font-size:14px;font-weight:800;color:#93c5fd">${fmt(factura.total)}</td></tr>
      <tr style="background:#dbeafe"><td style="padding:8px 14px;font-size:13px;font-weight:600;color:#2563EB">Saldo pendiente</td><td style="padding:8px 14px;text-align:right;font-size:13px;font-weight:700;color:#2563EB">${fmt(saldo)}</td></tr>
    </table>
  </td></tr>

  ${factura.notas ? `
  <!-- NOTES -->
  <tr><td style="background:#ffffff;padding:0 32px 24px">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px">
      <div style="font-size:10px;font-weight:700;color:#3B82F6;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px">Observaciones</div>
      <div style="font-size:13px;color:#475569;line-height:1.5">${factura.notas}</div>
    </div>
  </td></tr>` : ''}

  <!-- FOOTER -->
  <tr><td style="background:#2563EB;border-radius:0 0 14px 14px;padding:14px 32px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:11px;color:#93c5fd">${emp.mensaje_factura}</td>
        <td style="text-align:right;font-size:11px;font-weight:700;color:#ffffff">${emp.nombre} · ${factura.numero}</td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Falta la clave RESEND_API_KEY en las variables de entorno del servidor.' },
        { status: 500 }
      )
    }

    const resend = new Resend(apiKey)
    const supabase = createClient()
    const { factura_id } = await request.json()

    if (!factura_id) {
      return NextResponse.json({ error: 'factura_id requerido' }, { status: 400 })
    }

    const [{ data: factura, error: fErr }, { data: empresa }] = await Promise.all([
      supabase
        .from('facturas')
        .select('*, cliente:clientes(*), vendedor:profiles(*), items:factura_items(*)')
        .eq('id', factura_id)
        .single(),
      supabase.from('empresa_config').select('*').limit(1).maybeSingle(),
    ])

    if (fErr || !factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const emailDestino = factura.cliente?.email
    if (!emailDestino) {
      return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 })
    }

    const nombreEmpresa = empresa?.nombre ?? 'Emporium'

    const html = buildHtml(factura, empresa)

    const { data, error: sendError } = await resend.emails.send({
      from: `${nombreEmpresa} <onboarding@resend.dev>`,
      to: emailDestino,
      subject: `Factura ${factura.numero} — ${nombreEmpresa}`,
      html,
    })

    if (sendError) {
      // Resend plan gratuito solo permite enviar al email de la cuenta Resend.
      // Para enviar a clientes externos se necesita un dominio verificado.
      const msg = sendError.message.toLowerCase().includes('testing')
        ? `Plan gratuito de Resend: solo puedes enviar al email de tu cuenta Resend. Para enviar a "${emailDestino}" necesitas verificar un dominio en resend.com.`
        : sendError.message
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err: any) {
    console.error('[POST /api/email/factura]', err)
    return NextResponse.json({ error: err?.message ?? 'Error interno del servidor' }, { status: 500 })
  }
}
