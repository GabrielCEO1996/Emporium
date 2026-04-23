'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, List, Package2 } from 'lucide-react'
import { Producto, Presentacion, Inventario } from '@/lib/types'
import { cn } from '@/lib/utils'
import ProductosTable from './ProductosTable'

type ProductoWithPresentaciones = Producto & { presentaciones: Presentacion[] }

interface Props {
  productos: ProductoWithPresentaciones[]
}

function getInv(pr: Presentacion): Inventario | null {
  if (!pr.inventario) return null
  return Array.isArray(pr.inventario) ? pr.inventario[0] ?? null : pr.inventario
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
        <div className="aspect-square w-full rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 flex items-center justify-center mb-3 overflow-hidden">
          {p.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
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

export default function ProductosGrid({ productos }: Props) {
  const [view, setView] = useState<'grid' | 'list'>('list')

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              view === 'list'
                ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            <List className="w-3.5 h-3.5" />
            Lista
          </button>
          <button
            onClick={() => setView('grid')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              view === 'grid'
                ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Grid
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <ProductosTable productos={productos} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {productos.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <Package2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-400">Sin productos registrados</p>
            </div>
          ) : (
            productos.map((p) => <ProductCard key={p.id} p={p} />)
          )}
        </div>
      )}
    </div>
  )
}
