'use client'

import { MessageCircle } from 'lucide-react'
import { Factura, Pedido } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface WhatsAppFacturaProps {
  tipo: 'factura'
  factura: Factura
}

interface WhatsAppPedidoProps {
  tipo: 'pedido'
  pedido: Pedido
}

type Props = WhatsAppFacturaProps | WhatsAppPedidoProps

function buildFacturaMessage(factura: Factura): string {
  const cliente = factura.cliente?.nombre ?? 'Cliente'
  const items = (factura.items ?? [])
    .map(i => `- ${i.descripcion} x${i.cantidad} — ${formatCurrency(i.precio_unitario)}`)
    .join('\n')

  return `Hola ${cliente} 👋\nAquí está tu factura de *Emporium*\n\n📋 Factura #${factura.numero}\n📅 Fecha: ${formatDate(factura.fecha_emision)}\n\n🛒 Productos:\n${items}\n\n💰 Total: ${formatCurrency(factura.total)}\n\n¡Gracias por tu compra! 🙏`
}

function buildPedidoMessage(pedido: Pedido): string {
  const cliente = pedido.cliente?.nombre ?? 'Cliente'
  const items = (pedido.items ?? [])
    .map(i => {
      const nombre = (i.presentacion as any)?.producto?.nombre ?? ''
      const presentacion = i.presentacion?.nombre ?? ''
      return `- ${nombre} ${presentacion} x${i.cantidad} — ${formatCurrency(i.precio_unitario)}`
    })
    .join('\n')

  return `Hola ${cliente} 👋\nAquí está tu pedido de *Emporium*\n\n📋 Pedido #${pedido.numero}\n📅 Fecha: ${formatDate(pedido.fecha_pedido)}\n\n🛒 Productos:\n${items}\n\n💰 Total: ${formatCurrency(pedido.total)}\n\n¡Gracias por tu compra! 🙏`
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

  if (!whatsapp) {
    return (
      <a
        href={`/clientes/${clienteId}`}
        title="Agrega el número de WhatsApp al cliente para usar esta función"
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </a>
    )
  }

  const message =
    props.tipo === 'factura'
      ? buildFacturaMessage(props.factura)
      : buildPedidoMessage(props.pedido)

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
