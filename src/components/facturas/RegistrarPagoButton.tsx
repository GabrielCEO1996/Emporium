'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Loader2, X, Banknote, Smartphone, Building2, Globe, FileCheck } from 'lucide-react'

type Metodo = 'efectivo' | 'zelle' | 'cheque' | 'credito' | 'stripe'

const METODOS: { value: Metodo; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'efectivo', label: 'Efectivo', icon: <Banknote className="h-4 w-4" />, color: 'bg-green-600' },
  { value: 'zelle',    label: 'Zelle',    icon: <Smartphone className="h-4 w-4" />, color: 'bg-purple-600' },
  { value: 'stripe',   label: 'Tarjeta',  icon: <Globe className="h-4 w-4" />, color: 'bg-indigo-600' },
  { value: 'cheque',   label: 'Cheque',   icon: <FileCheck className="h-4 w-4" />, color: 'bg-amber-600' },
  { value: 'credito',  label: 'Crédito',  icon: <Building2 className="h-4 w-4" />, color: 'bg-teal-600' },
]

export default function RegistrarPagoButton({ facturaId, total }: { facturaId: string; total: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [metodo, setMetodo] = useState<Metodo>('efectivo')
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetModal = () => { setMetodo('efectivo'); setReferencia(''); setNotas(''); setError(''); setOpen(false) }

  const handleSubmit = async () => {
    if (metodo === 'zelle' && !referencia.trim()) {
      setError('Ingresa el número de confirmación del Zelle')
      return
    }
    if (metodo === 'cheque' && !referencia.trim()) {
      setError('Ingresa el número de cheque')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factura_id: facturaId, metodo, referencia, notas }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al registrar pago')
      resetModal()
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
      >
        <CreditCard className="h-4 w-4" />
        Registrar Pago
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Registrar pago</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monto a cobrar: <span className="font-semibold text-slate-800">
                    {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(total)}
                  </span>
                </p>
              </div>
              <button onClick={resetModal} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMetodo(m.value)}
                      className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                        metodo === m.value
                          ? `${m.color} border-transparent text-white shadow-md`
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Referencia (required for zelle) */}
              {metodo === 'zelle' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Número de confirmación *
                  </label>
                  <input
                    type="text"
                    value={referencia}
                    onChange={e => setReferencia(e.target.value)}
                    placeholder="Ej: ABC123XYZ"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              )}

              {/* Referencia (required for cheque) */}
              {metodo === 'cheque' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Número de cheque *
                  </label>
                  <input
                    type="text"
                    value={referencia}
                    onChange={e => setReferencia(e.target.value)}
                    placeholder="Ej: 1024"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              )}

              {/* Referencia optional for stripe */}
              {metodo === 'stripe' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Intent ID (opcional)</label>
                  <input
                    type="text"
                    value={referencia}
                    onChange={e => setReferencia(e.target.value)}
                    placeholder="pi_xxxxxxxxxxxxxxxx"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {/* Credito notice */}
              {metodo === 'credito' && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-700">
                  El monto se registrará como crédito utilizado del cliente y deberá ser cobrado según las condiciones de crédito acordadas.
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas (opcional)</label>
                <input
                  type="text"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Observaciones del pago..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                onClick={resetModal}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
