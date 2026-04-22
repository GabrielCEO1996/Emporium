'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface MarcarPagadaButtonProps {
  facturaId: string
}

export default function MarcarPagadaButton({ facturaId }: MarcarPagadaButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleMarcarPagada = async () => {
    if (!confirm('¿Confirmar que esta factura ha sido pagada completamente?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/facturas/${facturaId}/pagar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al marcar como pagada')
      }
      toast.success('Factura marcada como pagada')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleMarcarPagada}
      disabled={loading}
      className="ripple flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
      Marcar como Pagada
    </button>
  )
}
