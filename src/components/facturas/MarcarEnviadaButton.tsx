'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  facturaId: string
}

export default function MarcarEnviadaButton({ facturaId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleMarcarEnviada = async () => {
    if (!confirm('¿Marcar esta factura como enviada al cliente?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/facturas/${facturaId}/enviada`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al cambiar estado')
      }
      toast.success('Factura marcada como enviada')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleMarcarEnviada}
      disabled={loading}
      className="ripple flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      Marcar como Enviada
    </button>
  )
}
