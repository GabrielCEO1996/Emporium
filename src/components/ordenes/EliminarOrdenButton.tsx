'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { showConfirm } from '@/components/ui/ConfirmDialog'
import { isTestingMode } from '@/lib/testing-mode'

// ─── EliminarOrdenButton ────────────────────────────────────────────────────
// Hard delete de una orden. Pegamos a DELETE /api/ordenes/[id] que también
// limpia orden_items por CASCADE. Solo visible en modo testing.
//
// En producción, la "salida" oficial de una orden es:
//   • aprobada  → se materializa como pedido (no se borra)
//   • rechazada → queda en DB con motivo_rechazo (audit trail)
//   • cancelada → idem
// Borrar duro elimina audit trail, por eso no se permite en prod.
// ────────────────────────────────────────────────────────────────────────────

interface Props {
  ordenId: string
  ordenNumero: string
}

export default function EliminarOrdenButton({ ordenId, ordenNumero }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (!isTestingMode()) return null

  const handleDelete = async () => {
    const ok = await showConfirm({
      title: `¿Eliminar la orden ${ordenNumero}?`,
      message: 'Esta acción no se puede deshacer. Solo disponible en modo prueba.',
      confirmLabel: 'Sí, eliminar',
      danger: true,
    })
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? 'Error al eliminar orden')
        return
      }
      toast.success(`Orden ${ordenNumero} eliminada`)
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
      title="Eliminar orden (solo modo prueba)"
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">Eliminar</span>
    </button>
  )
}
