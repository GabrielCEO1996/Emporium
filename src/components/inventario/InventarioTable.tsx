'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  SlidersHorizontal,
  PackageX,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  BarChart3,
  DollarSign,
} from 'lucide-react'

interface InventarioRow {
  id: string
  stock_total: number
  stock_reservado: number
  stock_disponible: number
  precio_venta: number
  precio_costo: number
  updated_at: string
  last_movimiento_at?: string | null
  presentacion: {
    id: string
    nombre: string
    unidad: string
    codigo_barras?: string
  } | null
  producto: {
    id: string
    codigo?: string | null
    nombre: string
    imagen_url?: string
    categoria?: string
  } | null
}

type AjusteTipo = 'entrada' | 'salida' | 'ajuste'

interface AjusteState {
  row: InventarioRow
  tipo: AjusteTipo
  cantidad: string
  notas: string
  precio_venta: string
  precio_costo: string
  loading: boolean
  error: string
}

// Color coding per spec: green > 10, amber 1–10, red 0.
function stockColor(disponible: number): string {
  if (disponible <= 0) return 'text-red-700 bg-red-100'
  if (disponible <= 10) return 'text-amber-700 bg-amber-100'
  return 'text-green-700 bg-green-100'
}

function stockIcon(disponible: number) {
  if (disponible <= 0) return <PackageX className="h-3.5 w-3.5" />
  if (disponible <= 10) return <AlertTriangle className="h-3.5 w-3.5" />
  return <CheckCircle2 className="h-3.5 w-3.5" />
}

function formatDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(s))
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

function margenPct(precioVenta: number, precioCosto: number): number | null {
  if (!precioVenta || precioVenta <= 0) return null
  return ((precioVenta - precioCosto) / precioVenta) * 100
}

export default function InventarioTable({
  inventario,
  categorias,
}: {
  inventario: InventarioRow[]
  categorias: string[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  const [filtroStock, setFiltroStock] = useState<'todos' | 'agotado' | 'bajo' | 'ok'>('todos')
  const [ajuste, setAjuste] = useState<AjusteState | null>(null)

  const filtered = useMemo(() => {
    return inventario.filter((row) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        row.producto?.nombre.toLowerCase().includes(q) ||
        row.producto?.codigo?.toLowerCase().includes(q) ||
        row.presentacion?.nombre.toLowerCase().includes(q) ||
        row.presentacion?.codigo_barras?.toLowerCase().includes(q)

      const matchCategoria = !categoria || row.producto?.categoria === categoria

      const disp = row.stock_disponible ?? 0
      const matchStock =
        filtroStock === 'todos' ||
        (filtroStock === 'agotado' && disp <= 0) ||
        (filtroStock === 'bajo' && disp > 0 && disp <= 10) ||
        (filtroStock === 'ok' && disp > 10)

      return matchSearch && matchCategoria && matchStock
    })
  }, [inventario, search, categoria, filtroStock])

  const openAjuste = (row: InventarioRow) => {
    setAjuste({
      row,
      tipo: 'entrada',
      cantidad: '',
      notas: '',
      precio_venta: row.precio_venta?.toString() ?? '0',
      precio_costo: row.precio_costo?.toString() ?? '0',
      loading: false,
      error: '',
    })
  }

  const handleAjusteSubmit = async () => {
    if (!ajuste) return
    const cantidadNum = parseInt(ajuste.cantidad || '0', 10)
    if (isNaN(cantidadNum) || cantidadNum < 0) {
      setAjuste((a) => a && { ...a, error: 'Ingresa una cantidad válida' })
      return
    }
    const precioVentaNum = parseFloat(ajuste.precio_venta || '0')
    const precioCostoNum = parseFloat(ajuste.precio_costo || '0')

    setAjuste((a) => a && { ...a, loading: true, error: '' })

    try {
      const res = await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventario_id: ajuste.row.id,
          tipo: ajuste.tipo,
          cantidad: cantidadNum,
          notas: ajuste.notas || null,
          precio_venta: Number.isFinite(precioVentaNum) ? precioVentaNum : undefined,
          precio_costo: Number.isFinite(precioCostoNum) ? precioCostoNum : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      setAjuste(null)
      router.refresh()
    } catch (err: any) {
      setAjuste((a) => a && { ...a, loading: false, error: err.message })
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      {/* ── Header ── */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Inventario</h1>
              <p className="text-xs text-slate-500">
                {inventario.length} presentaciones · stock y precios
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por SKU, producto, presentación o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {categorias.length > 0 && (
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            {(['todos', 'agotado', 'bajo', 'ok'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroStock(f)}
                className={`px-3 py-2 transition-colors capitalize ${
                  filtroStock === f
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f === 'todos' ? 'Todos' : f === 'agotado' ? 'Agotado' : f === 'bajo' ? 'Stock bajo' : 'Normal'}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400">{filtered.length} resultados</span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="p-6">
        <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Producto / Presentación
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Reservado</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Disponible</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Costo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Venta</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Margen</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Último mov.</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                      No se encontraron registros
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const disp = row.stock_disponible ?? 0
                    const m = margenPct(row.precio_venta ?? 0, row.precio_costo ?? 0)
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        {/* SKU */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-slate-500">
                            {row.producto?.codigo ?? '—'}
                          </span>
                        </td>

                        {/* Product + Presentacion */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {row.producto?.imagen_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.producto.imagen_url}
                                alt={row.producto.nombre}
                                className="h-9 w-9 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <PackageX className="h-4 w-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">
                                {row.producto?.nombre ?? '—'}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {row.presentacion?.nombre ?? '—'}
                                {row.presentacion?.unidad ? ` · ${row.presentacion.unidad}` : ''}
                              </p>
                              {row.producto?.categoria && (
                                <span className="inline-block text-xs text-slate-400">
                                  {row.producto.categoria}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="font-medium text-slate-700">{row.stock_total}</span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${row.stock_reservado > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {row.stock_reservado}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${stockColor(disp)}`}
                          >
                            {stockIcon(disp)}
                            {disp <= 0 ? 'Agotado' : disp}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right text-xs text-slate-600 font-mono">
                          {formatMoney(row.precio_costo ?? 0)}
                        </td>

                        <td className="px-4 py-3 text-right text-xs font-semibold text-slate-900 font-mono">
                          {formatMoney(row.precio_venta ?? 0)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {m === null ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <span className={`text-xs font-semibold ${
                              m >= 30 ? 'text-green-700' :
                              m >= 10 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                              {m.toFixed(1)}%
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center text-xs text-slate-400">
                          {formatDate(row.last_movimiento_at ?? row.updated_at)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openAjuste(row)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-colors"
                          >
                            Ajuste manual
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Ajuste Modal ── */}
      {ajuste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-bold text-slate-900">Ajuste manual</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {ajuste.row.producto?.nombre} · {ajuste.row.presentacion?.nombre}
                </p>
              </div>
              <button
                onClick={() => setAjuste(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-slate-400 mb-0.5">Total</p>
                  <p className="font-semibold text-slate-800">{ajuste.row.stock_total}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">Reservado</p>
                  <p className="font-semibold text-amber-600">{ajuste.row.stock_reservado}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">Disponible</p>
                  <p className={`font-semibold ${ajuste.row.stock_disponible <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {ajuste.row.stock_disponible}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de movimiento</label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
                  {(['entrada', 'salida', 'ajuste'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setAjuste((a) => a && { ...a, tipo: t })}
                      className={`flex-1 py-2 text-center capitalize font-medium transition-colors ${
                        ajuste.tipo === t
                          ? t === 'entrada'
                            ? 'bg-green-600 text-white'
                            : t === 'salida'
                            ? 'bg-red-600 text-white'
                            : 'bg-teal-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'entrada' ? 'Entrada' : t === 'salida' ? 'Salida' : 'Ajuste directo'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {ajuste.tipo === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={ajuste.cantidad}
                  onChange={(e) => setAjuste((a) => a && { ...a, cantidad: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                {ajuste.tipo === 'ajuste' && ajuste.row.stock_reservado > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Mínimo {ajuste.row.stock_reservado} (unidades reservadas)
                  </p>
                )}
              </div>

              {/* Precios editables */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Precio costo
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ajuste.precio_costo}
                    onChange={(e) => setAjuste((a) => a && { ...a, precio_costo: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Precio venta
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ajuste.precio_venta}
                    onChange={(e) => setAjuste((a) => a && { ...a, precio_venta: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Motivo / notas</label>
                <textarea
                  value={ajuste.notas}
                  onChange={(e) => setAjuste((a) => a && { ...a, notas: e.target.value })}
                  placeholder="Conteo físico, merma, corrección de precio..."
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none"
                />
              </div>

              {ajuste.error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                  {ajuste.error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setAjuste(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAjusteSubmit}
                disabled={ajuste.loading}
                className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {ajuste.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar ajuste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
