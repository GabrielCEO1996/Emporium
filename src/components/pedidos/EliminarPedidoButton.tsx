'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { showConfirm } from '@/components/ui/ConfirmDialog'
import { isTestingMode } from '@/lib/testing-mode'

interface Props {
  pedidoId: string
  pedidoNumero: string
}

export default function EliminarPedidoButton({ pedidoId, pedidoNumero }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Solo visible en modo testing. En producción se anula con nota de
  // crédito, no se borra duro.
  if (!isTestingMode()) return null

  const handleDelete = async () => {
    const ok = await showConfirm({
      title: `¿Eliminar el pedido #${pedidoNumero}?`,
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, eliminar',
      danger: true,
    })
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Error al eliminar pedido')
        return
      }
      toast.success(`Pedido #${pedidoNumero} eliminado`)
      router.refresh()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Eliminar pedido borrador"
      className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  )
}
