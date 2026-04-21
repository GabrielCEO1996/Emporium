'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react'

interface StockItem {
  id: string
  nombre: string
  stock: number
  productos: { nombre: string } | null
}

interface Props {
  items: StockItem[]
}

export default function StockAlertBanner({ items }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  if (dismissed || items.length === 0) return null

  const sinStock = items.filter(i => i.stock === 0)
  const stockBajo = items.filter(i => i.stock > 0)

  return (
    <div className="mx-4 mt-3 lg:mx-6 rounded-xl border border-red-200 bg-red-50 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <div className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-semibold text-red-800 text-sm">
              {sinStock.length > 0
                ? `${sinStock.length} producto${sinStock.length > 1 ? 's' : ''} sin stock · `
                : ''}
              {stockBajo.length > 0
                ? `${stockBajo.length} producto${stockBajo.length > 1 ? 's' : ''} con stock bajo`
                : ''}
            </span>
            <span className="text-red-600 text-xs ml-1">— toca para ver</span>
          </div>
          <div className="ml-auto mr-2 text-red-400">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-300 hover:text-red-500 transition p-1 rounded flex-shrink-0"
          aria-label="Cerrar alerta"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-red-200 px-4 pb-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {items.map(item => (
              <Link
                key={item.id}
                href="/productos"
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 hover:bg-red-50 transition border border-red-100"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {item.productos?.nombre}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{item.nombre}</p>
                </div>
                <span className={`ml-3 flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                  item.stock === 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {item.stock === 0 ? 'Sin stock' : `${item.stock} uds`}
                </span>
              </Link>
            ))}
          </div>
          <Link
            href="/productos"
            className="mt-2 inline-flex text-xs font-semibold text-red-700 hover:underline"
          >
            Ir a Productos para reabastecer →
          </Link>
        </div>
      )}
    </div>
  )
}
