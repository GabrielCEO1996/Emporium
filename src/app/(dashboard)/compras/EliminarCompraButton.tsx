'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { showConfirm } from '@/components/ui/ConfirmDialog'

export default function EliminarCompraButton({ compraId }: { compraId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    const ok = await showConfirm({
      title: '¿Eliminar esta compra?',
      message: 'El stock añadido se revertirá automáticamente, junto con la transacción contable.',
      confirmLabel: 'Sí, eliminar',
      danger: true,
    })
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/compras/${compraId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Error al eliminar')
        return
      }
      toast.success('Compra eliminada y stock revertido')
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
      className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
      title="Eliminar compra (revierte stock)"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  )
}
