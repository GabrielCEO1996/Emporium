'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { LayoutGrid, List, Package2, Search, Filter, ArrowUpDown } from 'lucide-react'
import { Producto, Presentacion, Inventario } from '@/lib/types'
import { cn } from '@/lib/utils'
import ProductosTable from './ProductosTable'

type ProductoWithPresentaciones = Producto & { presentaciones: Presentacion[] }

interface Props {
  productos: ProductoWithPresentaciones[]
}

// --- helpers shared between grid cards and sorters -------------------------
function getInv(pr: Presentacion): Inventario | null {
  if (!pr.inventario) return null
  return Array.isArray(pr.inventario) ? pr.inventario[0] ?? null : pr.inventario
}

function totalStock(p: ProductoWithPresentaciones): number {
  return (p.presentaciones ?? []).reduce((s, pr) => {
    const inv = getInv(pr)
    return s + (inv?.stock_disponible ?? inv?.stock_total ?? 0)
  }, 0)
}

/**
 * Sort key for "precio" — use the minimum precio_venta across presentations.
 * That matches the store's "desde X" convention (cheapest variant first).
 * Falls back to Infinity so price-less products sink to the bottom when
 * sorting ascending.
 */
function minPrecio(p: ProductoWithPresentaciones): number {
  const prices = (p.presentaciones ?? [])
    .map((pr) => getInv(pr)?.precio_venta)
    .filter((v): v is number => typeof v === 'number' && v > 0)
  if (prices.length === 0) return Infinity
  return Math.min(...prices)
}

function StockDot({ pres }: { pres: Presentacion[] }) {
  const total = pres.reduce((s, p) => {
    const inv = getInv(p)
    return s + (inv?.stock_disponible ?? inv?.stock_total ?? 0)
  }, 0)
  if (total === 0) return <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
  const low = pres.some((p) => {
    const inv = getInv(p)
    const disp = inv?.stock_disponible ?? inv?.stock_total ?? 0
    return disp > 0 && disp <= (p.stock_minimo ?? 0)
  })
  if (low) return <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
  return <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
}

function ProductCard({ p }: { p: ProductoWithPresentaciones }) {
  const initials = p.nombre.slice(0, 2).toUpperCase()

  return (
    <Link href={`/productos/${p.id}`}>
      <div className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 hover:shadow-md hover:border-teal-200 dark:hover:border-teal-700 transition-all cursor-pointer">
        <div className="relative aspect-square w-full rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 flex items-center justify-center mb-3 overflow-hidden">
          {p.imagen_url ? (
            <Image
              src={p.imagen_url}
              alt={p.nombre}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 200px"
              className="object-cover"
            />
          ) : (
            <div className="w-12 h-12 bg-teal-100 dark:bg-teal-800 rounded-xl flex items-center justify-center">
              <span className="text-lg font-bold text-teal-700 dark:text-teal-300">{initials}</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {p.codigo && (
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{p.codigo}</p>
          )}
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight line-clamp-2">
              {p.nombre}
            </p>
            <StockDot pres={p.presentaciones} />
          </div>

          {p.categoria && (
            <p className="text-xs text-slate-400 truncate">{p.categoria}</p>
          )}

          <p className="text-xs text-slate-400 pt-1">
            {p.presentaciones.length} presentación{p.presentaciones.length !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Filter + sort state
// ---------------------------------------------------------------------------
type SortKey =
  | 'nombre-asc'
  | 'nombre-desc'
  | 'precio-asc'
  | 'precio-desc'
  | 'stock-asc'
  | 'stock-desc'
  | 'fecha-desc'
  | 'fecha-asc'

type EstadoFilter = 'todos' | 'activos' | 'inactivos'

interface PersistedFilters {
  categoria: string
  estado: EstadoFilter
  sort: SortKey
}

const DEFAULT_FILTERS: PersistedFilters = {
  categoria: '', // empty = Todas
  estado: 'activos',
  sort: 'nombre-asc',
}

const STORAGE_KEY = 'emporium.productos.filters'

const SORT_LABEL: Record<SortKey, string> = {
  'nombre-asc': 'Nombre A → Z',
  'nombre-desc': 'Nombre Z → A',
  'precio-asc': 'Precio (menor a mayor)',
  'precio-desc': 'Precio (mayor a menor)',
  'stock-asc': 'Stock (menor a mayor)',
  'stock-desc': 'Stock (mayor a menor)',
  'fecha-desc': 'Fecha creación (reciente)',
  'fecha-asc': 'Fecha creación (antiguo)',
}

export default function ProductosGrid({ productos }: Props) {
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<PersistedFilters>(DEFAULT_FILTERS)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage once after mount (keeps SSR output stable).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PersistedFilters>
        setFilters((f) => ({ ...f, ...saved }))
      }
    } catch {
      /* ignore — bad JSON or SSR-only env */
    }
    setHydrated(true)
  }, [])

  // Persist every change AFTER hydration so we don't stomp saved prefs
  // with defaults on first render.
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
    } catch {
      /* ignore quota / private-browsing errors */
    }
  }, [filters, hydrated])

  // Derive the category dropdown options from the actual data so typos
  // never hide products.
  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const p of productos) {
      if (p.categoria) set.add(p.categoria)
    }
    return Array.from(set).sort()
  }, [productos])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()

    const matches = productos.filter((p) => {
      // category
      if (filters.categoria && p.categoria !== filters.categoria) return false
      // status
      if (filters.estado === 'activos' && !p.activo) return false
      if (filters.estado === 'inactivos' && p.activo) return false
      // search (SKU / nombre / categoria / descripcion)
      if (q) {
        const hay =
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo?.toLowerCase().includes(q) ?? false) ||
          (p.categoria?.toLowerCase().includes(q) ?? false) ||
          (p.descripcion?.toLowerCase().includes(q) ?? false)
        if (!hay) return false
      }
      return true
    })

    const sorted = [...matches]
    switch (filters.sort) {
      case 'nombre-asc':
        sorted.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        break
      case 'nombre-desc':
        sorted.sort((a, b) => b.nombre.localeCompare(a.nombre, 'es'))
        break
      case 'precio-asc':
        sorted.sort((a, b) => minPrecio(a) - minPrecio(b))
        break
      case 'precio-desc':
        sorted.sort((a, b) => minPrecio(b) - minPrecio(a))
        break
      case 'stock-asc':
        sorted.sort((a, b) => totalStock(a) - totalStock(b))
        break
      case 'stock-desc':
        sorted.sort((a, b) => totalStock(b) - totalStock(a))
        break
      case 'fecha-desc':
        sorted.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        break
      case 'fecha-asc':
        sorted.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
        break
    }
    return sorted
  }, [productos, filters, search])

  const total = productos.length
  const shown = filtered.length

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU, nombre o categoría..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Categoría filter */}
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="sr-only">Categoría</span>
          <select
            value={filters.categoria}
            onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value }))}
            className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none dark:text-slate-200"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        {/* Estado filter */}
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span className="sr-only">Estado</span>
          <select
            value={filters.estado}
            onChange={(e) =>
              setFilters((f) => ({ ...f, estado: e.target.value as EstadoFilter }))
            }
            className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none dark:text-slate-200"
          >
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </label>

        {/* Sort */}
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <span className="sr-only">Ordenar por</span>
          <select
            value={filters.sort}
            onChange={(e) =>
              setFilters((f) => ({ ...f, sort: e.target.value as SortKey }))
            }
            className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none dark:text-slate-200"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
        </label>

        {/* Spacer pushes view toggle to the right */}
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              view === 'list'
                ? 'bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-200'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            onClick={() => setView('grid')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              view === 'grid'
                ? 'bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-200'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
        </div>
      </div>

      {/* Count / active filters summary */}
      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          Mostrando <span className="font-semibold text-slate-700 dark:text-slate-300">{shown}</span>
          {' '}de{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-300">{total}</span>
          {' '}producto{total !== 1 ? 's' : ''}
        </span>
        {(filters.categoria || filters.estado !== 'activos' || filters.sort !== 'nombre-asc' || search) && (
          <button
            onClick={() => {
              setSearch('')
              setFilters(DEFAULT_FILTERS)
            }}
            className="font-medium text-teal-600 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {view === 'list' ? (
        <ProductosTable productos={filtered} totalCount={total} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <Package2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-400">
                {total === 0 ? 'Sin productos registrados' : 'Sin resultados con los filtros actuales'}
              </p>
            </div>
          ) : (
            filtered.map((p) => <ProductCard key={p.id} p={p} />)
          )}
        </div>
      )}
    </div>
  )
}
