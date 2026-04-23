import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export const ESTADO_PEDIDO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  confirmado: 'Confirmado',
  en_ruta: 'En Ruta',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  facturado: 'Facturado',
}

export const ESTADO_PEDIDO_COLORS: Record<string, string> = {
  borrador: 'bg-amber-100 text-amber-700',
  confirmado: 'bg-teal-100 text-teal-700',
  en_ruta: 'bg-yellow-100 text-yellow-700',
  entregado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
  facturado: 'bg-green-100 text-green-700',
}

export const ESTADO_FACTURA_LABELS: Record<string, string> = {
  emitida: 'Emitida',
  enviada: 'Enviada',
  pagada: 'Pagada',
  anulada: 'Anulada',
  con_nota_credito: 'Con N.C.',
}

export const ESTADO_FACTURA_COLORS: Record<string, string> = {
  emitida: 'bg-blue-100 text-blue-700',
  enviada: 'bg-purple-100 text-purple-700',
  pagada: 'bg-green-100 text-green-700',
  anulada: 'bg-red-100 text-red-700',
  con_nota_credito: 'bg-orange-100 text-orange-700',
}
