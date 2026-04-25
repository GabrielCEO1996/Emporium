'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { showConfirm } from '@/components/ui/ConfirmDialog'

interface Props {
  facturaId: string
  facturaNumero: string
  estadoActual: string
  isAdmin: boolean
}

export default function EliminarFacturaButton({ facturaId, facturaNumero, estadoActual, isAdmin }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Pagadas no se pueden eliminar directamente (deben anularse primero)
  if (!isAdmin) return null
  if (estadoActual === 'pagada') return null

  const handleDelete = async () => {
    const ok = await showConfirm({
      title: `¿Eliminar la factura ${facturaNumero}?`,
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, eliminar',
      danger: true,
    })
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/facturas/${facturaId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Error al eliminar')
        return
      }
      toast.success(`Factura ${facturaNumero} eliminada`)
      router.push('/facturas')
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
      title="Eliminar factura"
      className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {loading ? 'Eliminando...' : 'Eliminar'}
    </button>
  )
}
