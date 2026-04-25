'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

type Categoria = 'operacion' | 'personal' | 'marketing' | 'servicios' | 'otro'

const CATEGORIAS: { value: Categoria; label: string; help: string }[] = [
  { value: 'operacion', label: 'Operación', help: 'Alquiler, insumos, combustible, mantenimiento' },
  { value: 'personal', label: 'Personal', help: 'Sueldos, bonos, comisiones, beneficios' },
  { value: 'marketing', label: 'Marketing', help: 'Publicidad, redes sociales, diseño, campañas' },
  { value: 'servicios', label: 'Servicios', help: 'Luz, agua, internet, software, contadores' },
  { value: 'otro', label: 'Otro', help: 'Gastos varios no clasificados' },
]

const today = () => new Date().toISOString().split('T')[0]

export default function NuevoGastoForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [fecha, setFecha] = useState(today())
  const [categoria, setCategoria] = useState<Categoria>('operacion')
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState('')
  const [notas, setNotas] = useState('')

  const help = CATEGORIAS.find((c) => c.value === categoria)?.help ?? ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const montoNum = Number(monto)
    if (!concepto.trim()) return toast.error('El concepto es obligatorio')
    if (!Number.isFinite(montoNum) || montoNum <= 0) return toast.error('El monto debe ser un número positivo')

    setLoading(true)
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          categoria,
          concepto: concepto.trim(),
          monto: montoNum,
          metodo_pago: metodoPago.trim() || null,
          notas: notas.trim() || null,
        }),
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Error al guardar')
      toast.success('Gasto registrado')
      router.push('/gastos')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      {/* Fecha + Categoría */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Fecha *</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Categoría *</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {help && <p className="text-[11px] text-slate-400 mt-1">{help}</p>}
        </div>
      </div>

      {/* Concepto */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Concepto *</label>
        <input
          type="text"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Ej: Alquiler depósito, Pago nómina Enero, Campaña Instagram..."
          required
          maxLength={200}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {/* Monto + Método */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Monto *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Método de pago</label>
          <input
            type="text"
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            placeholder="Efectivo, Transferencia, Pago móvil..."
            maxLength={60}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Notas</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Detalles opcionales del gasto..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 resize-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push('/gastos')}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar gasto
        </button>
      </div>
    </form>
  )
}
