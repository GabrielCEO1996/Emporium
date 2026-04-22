'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, X, Loader2, AlertTriangle } from 'lucide-react'

interface Props {
  facturaId: string
  facturaNumero: string
  estadoActual: string
  isAdmin: boolean
}

export default function AnularFacturaButton({ facturaId, facturaNumero, estadoActual, isAdmin }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  // Pagadas solo se anulan, no eliminan. Anuladas y emitidas ya tienen flujo propio.
  if (!isAdmin) return null
  if (estadoActual === 'anulada') return null

  const handleAnular = async () => {
    if (!motivo.trim()) {
      toast.error('El motivo de anulación es obligatorio')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/facturas/${facturaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'anulada',
          notas: `ANULADA — ${motivo.trim()}`,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Error al anular')
        return
      }
      toast.success(`Factura ${facturaNumero} anulada`)
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
      >
        <Ban className="h-4 w-4" />
        {estadoActual === 'pagada' ? 'Anular Factura' : 'Anular'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && setOpen(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <button
              onClick={() => !loading && setOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Anular Factura {facturaNumero}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {estadoActual === 'pagada'
                    ? 'Esta factura está pagada. Se anulará dejando el historial contable intacto.'
                    : 'Esta acción no se puede deshacer.'}
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Motivo de anulación <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={3}
                placeholder="Ej: Error en los datos del cliente, duplicada, solicitud del cliente..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => !loading && setOpen(false)}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleAnular}
                disabled={loading || !motivo.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                {loading ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
