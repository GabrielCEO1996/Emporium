'use client'

import { useState } from 'react'
import { Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  facturaId: string
  clienteEmail?: string | null
  clienteId: string
}

export default function EnviarEmailButton({ facturaId, clienteEmail, clienteId }: Props) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!clienteEmail) {
    return (
      <a
        href={`/clientes/${clienteId}`}
        title="Agrega el email del cliente para usar esta función"
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-50 transition-colors"
      >
        <Mail className="h-4 w-4" />
        Email
      </a>
    )
  }

  const handleSend = async () => {
    if (loading) return
    setLoading(true)
    setStatus('idle')
    setErrorMsg('')

    try {
      const res = await fetch('/api/email/factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factura_id: facturaId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar')
      setStatus('ok')
      setTimeout(() => setStatus('idle'), 4000)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Error al enviar')
      setTimeout(() => setStatus('idle'), 5000)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'ok') {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white"
      >
        <CheckCircle className="h-4 w-4" />
        ¡Enviado!
      </button>
    )
  }

  if (status === 'error') {
    return (
      <button
        onClick={handleSend}
        title={errorMsg}
        className="flex items-center gap-2 rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        <AlertCircle className="h-4 w-4" />
        Error — reintentar
      </button>
    )
  }

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      title={`Enviar a ${clienteEmail}`}
      className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
      {loading ? 'Enviando...' : 'Enviar por Email'}
    </button>
  )
}
