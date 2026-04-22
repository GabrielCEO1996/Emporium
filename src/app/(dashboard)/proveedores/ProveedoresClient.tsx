'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search, Plus, Pencil, Trash2, Phone, Mail,
  MessageCircle, Star, Clock, BadgeCheck, XCircle
} from 'lucide-react'

interface Proveedor {
  id: string
  nombre: string
  empresa?: string
  telefono?: string
  email?: string
  whatsapp?: string
  categoria?: string
  tiempo_entrega_dias: number
  condiciones_pago: string
  calificacion: number
  notas?: string
  ultima_compra_fecha?: string
  ultima_compra_monto?: number
  activo: boolean
  created_at: string
}

interface Props { initialData: Proveedor[] }

const CATEGORIAS = ['Todos', 'Alimentos', 'Bebidas', 'Limpieza', 'Embalaje', 'Logística', 'Otro']

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-3 h-3 ${s <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-600'}`} />
      ))}
    </div>
  )
}

export default function ProveedoresClient({ initialData }: Props) {
  const [proveedores, setProveedores] = useState<Proveedor[]>(initialData)
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('Todos')
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()

  const filtered = proveedores.filter(p => {
    const q = query.toLowerCase()
    const matchQuery = !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.empresa ?? '').toLowerCase().includes(q) ||
      (p.categoria ?? '').toLowerCase().includes(q)
    const matchCat = catFilter === 'Todos' || p.categoria === catFilter
    return matchQuery && matchCat
  })

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Desactivar a "${nombre}"?`)) return
    setDeleting(id)
    const res = await fetch(`/api/proveedores/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setProveedores(prev => prev.filter(p => p.id !== id))
      toast.success('Proveedor desactivado')
    } else {
      toast.error('Error al desactivar')
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar proveedor, empresa..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIAS.map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                catFilter === c
                  ? 'bg-teal-600 text-white'
                  : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-teal-400'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <Link
          href="/proveedores/nuevo"
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Nuevo
        </Link>
      </div>

      {/* Count */}
      <p className="text-xs text-slate-400">
        {filtered.length} proveedor{filtered.length !== 1 ? 'es' : ''}
        {query || catFilter !== 'Todos' ? ' (filtrados)' : ''}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No hay proveedores{query ? ' con ese criterio' : ''}.</p>
          <Link href="/proveedores/nuevo" className="mt-3 inline-block text-teal-600 text-sm font-medium hover:underline">
            Agregar el primero
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              {/* Header */}
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-slate-800 dark:text-white text-sm truncate">{p.nombre}</h3>
                      {p.activo
                        ? <BadgeCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        : <XCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                    </div>
                    {p.empresa && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.empresa}</p>}
                  </div>
                  <StarRating value={p.calificacion} />
                </div>
                {p.categoria && (
                  <span className="mt-2 inline-block text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full font-medium">
                    {p.categoria}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="px-5 pb-3 space-y-1.5">
                {p.telefono && (
                  <a href={`tel:${p.telefono}`} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-teal-600 transition-colors">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {p.telefono}
                  </a>
                )}
                {p.email && (
                  <a href={`mailto:${p.email}`} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-teal-600 transition-colors truncate">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" /> {p.email}
                  </a>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  {p.tiempo_entrega_dias}d · {p.condiciones_pago}
                </div>
              </div>

              {/* Actions */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                {p.whatsapp && (
                  <a
                    href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-all"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                <Link
                  href={`/proveedores/${p.id}/editar`}
                  className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 py-2 px-3 rounded-lg transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => handleDelete(p.id, p.nombre)}
                  disabled={deleting === p.id}
                  className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 py-2 px-3 rounded-lg transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
