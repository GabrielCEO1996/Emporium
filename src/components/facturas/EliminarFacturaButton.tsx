'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'

interface Props {
  facturaId: string
  facturaNumero: string
  isAdmin: boolean
}

export default function EliminarFacturaButton({ facturaId, facturaNumero, isAdmin }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isAdmin) return null

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/facturas/${facturaId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar')
      router.push('/facturas')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
        Eliminar
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">¿Eliminar factura?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Se eliminará permanentemente la factura <strong>{facturaNumero}</strong> y todos sus artículos. Esta acción no se puede deshacer.
                </p>
                {error && (
                  <p className="mt-3 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                  </p>
                )}
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {loading ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                  <button
                    onClick={() => { setShowConfirm(false); setError(null) }}
                    disabled={loading}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
