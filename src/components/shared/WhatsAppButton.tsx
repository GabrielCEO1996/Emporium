'use client'

import { MessageCircle } from 'lucide-react'
import { Factura, Pedido } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface EmpresaInfo {
  nombre?: string
  telefono?: string
  email?: string
  direccion?: string
}

interface WhatsAppFacturaProps {
  tipo: 'factura'
  factura: Factura
  empresa?: EmpresaInfo
}

interface WhatsAppPedidoProps {
  tipo: 'pedido'
  pedido: Pedido
  empresa?: EmpresaInfo
}

type Props = WhatsAppFacturaProps | WhatsAppPedidoProps

const SEP = '━━━━━━━━━━━━━━━━━'

function empresaFooter(e?: EmpresaInfo): string {
  if (!e?.nombre) return ''
  const lines = [
    `\n${SEP}`,
    `🏢 *${e.nombre}*`,
    e.telefono ? `📞 ${e.telefono}` : null,
    e.email    ? `✉️ ${e.email}`    : null,
    e.direccion ? `📍 ${e.direccion}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}

function buildFacturaMessage(factura: Factura, empresa?: EmpresaInfo): string {
  const cliente = factura.cliente?.nombre ?? 'Estimado cliente'
  const nombEmpresa = empresa?.nombre ?? 'Emporium'

  const itemLines = (factura.items ?? [])
    .map(i => `  ▫️ ${i.descripcion} x${i.cantidad}  →  ${formatCurrency(i.subtotal)}`)
    .join('\n')

  const lines = [
    `Hola *${cliente}*! 👋`,
    '',
    `Te enviamos el detalle de tu factura de *${nombEmpresa}*.`,
    '',
    `${SEP}`,
    `📋 *FACTURA #${factura.numero}*`,
    `📅 Fecha: ${formatDate(factura.fecha_emision)}`,
    factura.fecha_vencimiento ? `⏰ Vence: ${formatDate(factura.fecha_vencimiento)}` : null,
    `${SEP}`,
    '',
    `🛒 *PRODUCTOS*`,
    itemLines || '  (sin artículos)',
    '',
    `${SEP}`,
  ]

  if (factura.descuento > 0) {
    lines.push(`  Subtotal:        ${formatCurrency(factura.subtotal)}`)
    lines.push(`  🏷️ Descuento:   -${formatCurrency(factura.descuento)}`)
  }

  lines.push(`💰 *TOTAL: ${formatCurrency(factura.total)}*`)
  lines.push(SEP)
  lines.push('')
  lines.push('¡Gracias por tu preferencia! 🙏')
  lines.push(empresaFooter(empresa))

  return lines.filter(l => l !== null).join('\n')
}

function buildPedidoMessage(pedido: Pedido, empresa?: EmpresaInfo): string {
  const cliente = pedido.cliente?.nombre ?? 'Estimado cliente'
  const nombEmpresa = empresa?.nombre ?? 'Emporium'

  const itemLines = (pedido.items ?? [])
    .map(i => {
      const nombre = (i.presentacion as any)?.producto?.nombre ?? ''
      const pres = i.presentacion?.nombre ?? ''
      return `  ▫️ ${nombre} ${pres} x${i.cantidad}  →  ${formatCurrency(i.subtotal)}`
    })
    .join('\n')

  const lines = [
    `Hola *${cliente}*! 👋`,
    '',
    `Aquí está el resumen de tu pedido en *${nombEmpresa}*.`,
    '',
    `${SEP}`,
    `🛍️ *PEDIDO #${pedido.numero}*`,
    `📅 Fecha: ${formatDate(pedido.fecha_pedido)}`,
    pedido.fecha_entrega_estimada ? `🚚 Entrega estimada: ${formatDate(pedido.fecha_entrega_estimada)}` : null,
    `${SEP}`,
    '',
    `🛒 *PRODUCTOS*`,
    itemLines || '  (sin artículos)',
    '',
    `${SEP}`,
  ]

  if (pedido.descuento > 0) {
    lines.push(`  Subtotal:        ${formatCurrency(pedido.subtotal)}`)
    lines.push(`  🏷️ Descuento:   -${formatCurrency(pedido.descuento)}`)
  }

  lines.push(`💰 *TOTAL: ${formatCurrency(pedido.total)}*`)
  lines.push(SEP)
  lines.push('')
  lines.push('¡Gracias por tu compra! 🙏')
  lines.push(empresaFooter(empresa))

  return lines.filter(l => l !== null).join('\n')
}

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export default function WhatsAppButton(props: Props) {
  const whatsapp =
    props.tipo === 'factura'
      ? props.factura.cliente?.whatsapp
      : props.pedido.cliente?.whatsapp

  const clienteId =
    props.tipo === 'factura'
      ? props.factura.cliente_id
      : props.pedido.cliente_id

  const empresa = 'empresa' in props ? props.empresa : undefined

  if (!whatsapp) {
    return (
      <a
        href={`/clientes/${clienteId}`}
        title="Agrega el número de WhatsApp al cliente para usar esta función"
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-50 transition-colors"
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </a>
    )
  }

  const message =
    props.tipo === 'factura'
      ? buildFacturaMessage(props.factura, empresa)
      : buildPedidoMessage(props.pedido, empresa)

  const url = `https://wa.me/${cleanPhone(whatsapp)}?text=${encodeURIComponent(message)}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg bg-green-500 hover:bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors"
    >
      <MessageCircle className="h-4 w-4" />
      Enviar por WhatsApp
    </a>
  )
}
