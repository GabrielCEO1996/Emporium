'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'

/**
 * Debounced filter bar for the clientes list.
 *
 * - Types as you go (300ms debounce) and syncs the URL via router.replace
 *   so the filter survives bookmarking / sharing.
 * - Activo dropdown updates immediately (no debounce needed for a select).
 * - "X" button in the input instantly clears the search term.
 * - Shown counter "Mostrando X de Y clientes" comes from the host page
 *   via the `total` + `showing` props.
 *
 * Input value is controlled locally so the user doesn't see cursor jumps
 * when the server round-trips after a debounce.
 */
export default function ClientesFilterBar({
  initialSearch,
  initialActivo,
  showing,
  total,
}: {
  initialSearch: string
  initialActivo: string
  showing: number
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const currentSearch = useSearchParams()

  const [query, setQuery] = useState(initialSearch)
  const [activo, setActivo] = useState(initialActivo)
  const [isPending, startTransition] = useTransition()

  // Sync URL when query or activo changes, with debounce for the text input.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(currentSearch?.toString() ?? '')
      if (query.trim()) params.set('search', query.trim())
      else params.delete('search')
      if (activo) params.set('activo', activo)
      else params.delete('activo')
      const next = params.toString()
      const href = next ? `${pathname}?${next}` : pathname
      // Skip the RSC round-trip if nothing actually changed.
      const prev = currentSearch?.toString() ?? ''
      if (next === prev) return
      startTransition(() => {
        router.replace(href, { scroll: false })
      })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activo])

  const showClearBtn = query.length > 0
  const showCounter = total > 0

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, RIF, ciudad, correo o teléfono..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-16 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          {isPending ? (
            <Loader2 className="absolute right-9 top-2.5 h-4 w-4 animate-spin text-slate-400" />
          ) : null}
          {showClearBtn && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={activo}
          onChange={(e) => setActivo(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        >
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        {(query || activo) && (
          <button
            type="button"
            onClick={() => { setQuery(''); setActivo('') }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
          >
            Limpiar
          </button>
        )}
      </div>
      {showCounter && (
        <p className="text-xs text-slate-500">
          Mostrando <span className="font-semibold text-slate-700">{showing}</span>{' '}
          de <span className="font-semibold text-slate-700">{total}</span> cliente{total === 1 ? '' : 's'}
          {query && (
            <span className="text-slate-400"> · filtrando por "<span className="italic">{query}</span>"</span>
          )}
        </p>
      )}
    </div>
  )
}
