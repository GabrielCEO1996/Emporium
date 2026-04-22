'use client'

import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'

interface Props {
  pedidoId: string
  clienteId: string
}

export default function GenerarFacturaButton({ pedidoId, clienteId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerar = async () => {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedidoId, cliente_id: clienteId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al generar factura')
      window.location.href = `/facturas/${data.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar factura')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <button
        onClick={handleGenerar}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        {loading ? 'Generando...' : 'Generar Factura'}
      </button>
      {error && <p className="text-xs text-red-600 max-w-[160px] text-right">{error}</p>}
    </div>
  )
}
