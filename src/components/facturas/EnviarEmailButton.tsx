'use client'

import { useState } from 'react'
import { Mail, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'

interface Props {
  facturaId: string
  clienteEmail?: string | null
  clienteId: string
}

export default function EnviarEmailButton({ facturaId, clienteEmail, clienteId }: Props) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
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
    setErrorMsg('')
    setSent(false)

    try {
      const res = await fetch('/api/email/factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factura_id: facturaId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar el email')
      setSent(true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al enviar el email')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <button
        onClick={() => setSent(false)}
        className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white"
      >
        <CheckCircle className="h-4 w-4" />
        ¡Enviado!
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleSend}
        disabled={loading}
        title={`Enviar a ${clienteEmail}`}
        className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 px-4 py-2 text-sm font-medium text-teal-700 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {loading ? 'Enviando...' : 'Enviar por Email'}
      </button>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 max-w-xs text-right">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="flex-shrink-0 text-red-400 hover:text-red-600">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}
