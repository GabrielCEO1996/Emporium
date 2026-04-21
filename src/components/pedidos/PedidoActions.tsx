'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EstadoPedido } from '@/lib/types'
import { ESTADO_PEDIDO_LABELS } from '@/lib/utils'
import {
  Save,
  Receipt,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Truck,
  ChevronDown,
} from 'lucide-react'

interface Conductor {
  id: string
  nombre: string
  telefono?: string
}

interface PedidoActionsProps {
  pedidoId: string
  currentEstado: EstadoPedido
  currentConductorId: string | null
  conductores: Conductor[]
}

const ESTADO_OPTIONS: EstadoPedido[] = [
  'borrador',
  'confirmado',
  'en_ruta',
  'entregado',
  'cancelado',
  'facturado',
]

export default function PedidoActions({
  pedidoId,
  currentEstado,
  currentConductorId,
  conductores,
}: PedidoActionsProps) {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoPedido>(currentEstado)
  const [conductorId, setConductorId] = useState<string>(currentConductorId ?? '')
  const [saving, setSaving] = useState(false)
  const [generatingFactura, setGeneratingFactura] = useState(false)
  const [confirmingPedido, setConfirmingPedido] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado,
          conductor_id: conductorId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      showMessage('success', 'Pedido actualizado correctamente')
      router.refresh()
    } catch (err: any) {
      showMessage('error', err.message ?? 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmar = async () => {
    setConfirmingPedido(true)
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/confirmar`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al confirmar')
      showMessage('success', 'Pedido confirmado y stock descontado')
      setEstado('confirmado')
      router.refresh()
    } catch (err: any) {
      showMessage('error', err.message ?? 'Error desconocido')
    } finally {
      setConfirmingPedido(false)
    }
  }

  const handleGenerarFactura = async () => {
    setGeneratingFactura(true)
    try {
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedidoId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar factura')
      showMessage('success', 'Factura generada correctamente')
      router.push(`/facturas/${data.id}`)
    } catch (err: any) {
      showMessage('error', err.message ?? 'Error desconocido')
      setGeneratingFactura(false)
    }
  }

  const hasChanges = estado !== currentEstado || conductorId !== (currentConductorId ?? '')

  return (
    <div className="flex flex-col gap-3 sm:items-end">
      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Estado selector */}
        <div className="relative">
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoPedido)}
            className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {ESTADO_OPTIONS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_PEDIDO_LABELS[e]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* Conductor selector */}
        <div className="relative">
          <select
            value={conductorId}
            onChange={(e) => setConductorId(e.target.value)}
            className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Sin conductor</option>
            {conductores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <Truck className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar
        </button>

        {/* Confirm button (only for borrador) */}
        {currentEstado === 'borrador' && (
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={confirmingPedido}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirmingPedido ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirmar
          </button>
        )}

        {/* Generate invoice */}
        <button
          type="button"
          onClick={handleGenerarFactura}
          disabled={
            generatingFactura ||
            currentEstado === 'cancelado' ||
            currentEstado === 'borrador' ||
            currentEstado === 'facturado'
          }
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title={
            currentEstado === 'facturado'
              ? 'Ya facturado'
              : currentEstado === 'cancelado'
              ? 'Pedido cancelado'
              : currentEstado === 'borrador'
              ? 'Confirme el pedido primero'
              : 'Generar factura'
          }
        >
          {generatingFactura ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Receipt className="h-4 w-4" />
          )}
          Generar Factura
        </button>
      </div>
    </div>
  )
}
