'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Wallet, CalendarDays, Trash2, Loader2, Filter, Search } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

type Categoria = 'operacion' | 'personal' | 'marketing' | 'servicios' | 'otro'

interface Gasto {
  id: string
  fecha: string
  categoria: Categoria
  concepto: string
  monto: number
  metodo_pago: string | null
  notas: string | null
  comprobante_url: string | null
  created_at: string
}

const CATEGORIA_LABEL: Record<Categoria, string> = {
  operacion: 'Operación',
  personal: 'Personal',
  marketing: 'Marketing',
  servicios: 'Servicios',
  otro: 'Otro',
}

const CATEGORIA_TONE: Record<Categoria, string> = {
  operacion: 'bg-sky-100 text-sky-700 border-sky-200',
  personal: 'bg-violet-100 text-violet-700 border-violet-200',
  marketing: 'bg-pink-100 text-pink-700 border-pink-200',
  servicios: 'bg-amber-100 text-amber-700 border-amber-200',
  otro: 'bg-slate-100 text-slate-700 border-slate-200',
}

export default function GastosClient({ gastos }: { gastos: Gasto[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState<Categoria | 'todas'>('todas')
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return gastos.filter((g) => {
      if (categoria !== 'todas' && g.categoria !== categoria) return false
      if (q) {
        const hay =
          g.concepto.toLowerCase().includes(q) ||
          (g.notas?.toLowerCase().includes(q) ?? false) ||
          (g.metodo_pago?.toLowerCase().includes(q) ?? false)
        if (!hay) return false
      }
      return true
    })
  }, [gastos, search, categoria])

  const filteredTotal = filtered.reduce((s, g) => s + Number(g.monto ?? 0), 0)

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto? Se eliminará también la transacción asociada.')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE', cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Error al eliminar')
      toast.success('Gasto eliminado')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-700 p-4">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por concepto, método o nota..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="sr-only">Categoría</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria | 'todas')}
            className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none dark:text-slate-200"
          >
            <option value="todas">Todas las categorías</option>
            {(Object.keys(CATEGORIA_LABEL) as Categoria[]).map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
            ))}
          </select>
        </label>

        <div className="ml-auto text-xs text-slate-500">
          Mostrando <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</span>
          {' '}·{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(filteredTotal)}</span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wallet className="w-12 h-12 text-slate-200 mb-3" />
          <p className="text-sm font-medium text-slate-500">
            {gastos.length === 0 ? 'Sin gastos registrados' : 'Sin resultados con los filtros actuales'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoría</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Concepto</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Método</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto</th>
                <th className="px-5 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtered.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(g.fecha)}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CATEGORIA_TONE[g.categoria]}`}>
                      {CATEGORIA_LABEL[g.categoria]}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-700 dark:text-slate-200">{g.concepto}</p>
                    {g.notas && (
                      <p className="text-xs text-slate-400 line-clamp-1 max-w-md">{g.notas}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {g.metodo_pago ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-slate-900 dark:text-white">
                    {formatCurrency(g.monto)}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleDelete(g.id)}
                      disabled={deleting === g.id}
                      className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                      title="Eliminar gasto"
                    >
                      {deleting === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
