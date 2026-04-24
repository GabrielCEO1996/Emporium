'use client'

import { useState, useMemo, Fragment } from 'react'
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
  ChevronRight,
  ChevronDown,
  Clock,
  XCircle,
} from 'lucide-react'

interface InventarioRow {
  id: string
  stock_total: number
  stock_reservado: number
  stock_disponible: number
  precio_venta: number
  precio_costo: number
  numero_lote: string | null
  fecha_vencimiento: string | null
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
    tiene_vencimiento?: boolean
    stock_minimo?: number
    precio_venta_sugerido?: number
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

type FilterMode = 'todos' | 'stock_bajo' | 'vence_pronto' | 'vencidos'

// ── Date helpers ────────────────────────────────────────────────────────────
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const ms = new Date(dateStr).getTime() - Date.now()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function expirationBadge(dateStr: string | null | undefined) {
  const d = daysUntil(dateStr)
  if (d === null) return null
  if (d < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
        <XCircle className="h-3 w-3" /> Vencido
      </span>
    )
  }
  if (d < 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        <Clock className="h-3 w-3" /> Vence en {d}d
      </span>
    )
  }
  if (d <= 60) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        <Clock className="h-3 w-3" /> Vence en {d}d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
      <CheckCircle2 className="h-3 w-3" /> {d}d
    </span>
  )
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

// ── Grouping ────────────────────────────────────────────────────────────────
interface ProductoGroup {
  productoId: string
  producto: InventarioRow['producto']
  rows: InventarioRow[]
  stockTotal: number
  stockReservado: number
  stockDisponible: number   // counts only non-expired lots
  precioVenta: number       // last known (non-zero preferred)
  precioCosto: number
  stockMinimo: number
  tieneVencimiento: boolean
  hasExpired: boolean
  hasNearExpiry: boolean    // any lot within 30 days
  lastMovAt: string | null
}

function groupByProducto(rows: InventarioRow[]): ProductoGroup[] {
  const map = new Map<string, ProductoGroup>()
  for (const r of rows) {
    const prodId = r.producto?.id
    if (!prodId) continue
    let g = map.get(prodId)
    if (!g) {
      g = {
        productoId: prodId,
        producto: r.producto,
        rows: [],
        stockTotal: 0,
        stockReservado: 0,
        stockDisponible: 0,
        precioVenta: 0,
        precioCosto: 0,
        stockMinimo: r.producto?.stock_minimo ?? 0,
        tieneVencimiento: Boolean(r.producto?.tiene_vencimiento),
        hasExpired: false,
        hasNearExpiry: false,
        lastMovAt: null,
      }
      map.set(prodId, g)
    }
    g.rows.push(r)
    g.stockTotal += r.stock_total ?? 0
    g.stockReservado += r.stock_reservado ?? 0
    const days = daysUntil(r.fecha_vencimiento)
    const isExpired = days !== null && days < 0
    if (isExpired) g.hasExpired = true
    else g.stockDisponible += r.stock_disponible ?? 0
    if (days !== null && days >= 0 && days < 30) g.hasNearExpiry = true
    if ((r.precio_venta ?? 0) > 0) g.precioVenta = r.precio_venta
    if ((r.precio_costo ?? 0) > 0) g.precioCosto = r.precio_costo
    const last = r.last_movimiento_at ?? r.updated_at
    if (last && (!g.lastMovAt || new Date(last) > new Date(g.lastMovAt))) g.lastMovAt = last
  }
  // Fallback precio_venta — if no rows had one, use productos.precio_venta_sugerido
  for (const g of map.values()) {
    if (!g.precioVenta && g.producto?.precio_venta_sugerido) {
      g.precioVenta = g.producto.precio_venta_sugerido
    }
    // Sort lots by fecha_vencimiento ASC NULLS LAST, then by numero_lote
    g.rows.sort((a, b) => {
      const ad = a.fecha_vencimiento
      const bd = b.fecha_vencimiento
      if (ad && bd) return ad.localeCompare(bd)
      if (ad) return -1
      if (bd) return 1
      return (a.numero_lote ?? '').localeCompare(b.numero_lote ?? '')
    })
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.producto?.nombre ?? '').localeCompare(b.producto?.nombre ?? '')
  )
}

export default function InventarioTable({
  inventario,
  categorias,
  initialFilter = 'todos',
}: {
  inventario: InventarioRow[]
  categorias: string[]
  initialFilter?: FilterMode
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  const [filtro, setFiltro] = useState<FilterMode>(initialFilter)
  const [ajuste, setAjuste] = useState<AjusteState | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const grupos = useMemo(() => groupByProducto(inventario), [inventario])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return grupos.filter((g) => {
      const matchSearch =
        !q ||
        g.producto?.nombre.toLowerCase().includes(q) ||
        g.producto?.codigo?.toLowerCase().includes(q) ||
        g.rows.some(
          (r) =>
            r.presentacion?.nombre.toLowerCase().includes(q) ||
            r.presentacion?.codigo_barras?.toLowerCase().includes(q) ||
            r.numero_lote?.toLowerCase().includes(q)
        )
      const matchCategoria = !categoria || g.producto?.categoria === categoria

      let matchFiltro = true
      if (filtro === 'stock_bajo') {
        matchFiltro = g.stockMinimo > 0 && g.stockTotal < g.stockMinimo
      } else if (filtro === 'vence_pronto') {
        matchFiltro = g.hasNearExpiry
      } else if (filtro === 'vencidos') {
        matchFiltro = g.hasExpired
      }

      return matchSearch && matchCategoria && matchFiltro
    })
  }, [grupos, search, categoria, filtro])

  const toggleExpanded = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }))

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
                {grupos.length} productos · {inventario.length} lotes en total
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
              placeholder="Buscar por SKU, producto, presentación o lote..."
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
            {([
              ['todos', 'Todos'],
              ['stock_bajo', 'Stock bajo ⚠️'],
              ['vence_pronto', 'Vence pronto 🔴'],
              ['vencidos', 'Vencidos ⚫'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFiltro(val)}
                className={`px-3 py-2 transition-colors ${
                  filtro === val ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
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
                  <th className="w-8" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Producto</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Disponible</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Precio venta</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Último mov.</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      No se encontraron registros
                    </td>
                  </tr>
                ) : (
                  filtered.map((g) => {
                    const isExpanded = !!expanded[g.productoId]
                    const isStockBajo = g.stockMinimo > 0 && g.stockTotal < g.stockMinimo
                    return (
                      <Fragment key={g.productoId}>
                        <tr
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => toggleExpanded(g.productoId)}
                        >
                          <td className="px-2 py-3 text-slate-400">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-slate-500">{g.producto?.codigo ?? '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {g.producto?.imagen_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={g.producto.imagen_url}
                                  alt={g.producto.nombre}
                                  className="h-9 w-9 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                                />
                              ) : (
                                <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  <PackageX className="h-4 w-4 text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 truncate">{g.producto?.nombre ?? '—'}</p>
                                <p className="text-xs text-slate-500 truncate">
                                  {g.rows.length} {g.rows.length === 1 ? 'lote' : 'lotes'}
                                  {g.producto?.categoria ? ` · ${g.producto.categoria}` : ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-800">{g.stockTotal}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-medium text-green-700">{g.stockDisponible}</span>
                            {g.stockReservado > 0 && (
                              <span className="text-xs text-amber-600 ml-1">(−{g.stockReservado} res.)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900">
                            {formatMoney(g.precioVenta)}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-400">
                            {formatDate(g.lastMovAt)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-wrap justify-center gap-1">
                              {isStockBajo && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                  <AlertTriangle className="h-3 w-3" /> Stock bajo
                                </span>
                              )}
                              {g.hasExpired && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                                  <XCircle className="h-3 w-3" /> Vencido
                                </span>
                              )}
                              {!g.hasExpired && g.hasNearExpiry && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                  <Clock className="h-3 w-3" /> Vence pronto
                                </span>
                              )}
                              {!isStockBajo && !g.hasExpired && !g.hasNearExpiry && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                  <CheckCircle2 className="h-3 w-3" /> OK
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/40">
                            <td colSpan={8} className="p-0">
                              <div className="px-6 py-4">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-500">
                                      <th className="text-left py-2 font-semibold">Presentación</th>
                                      <th className="text-left py-2 font-semibold">N° Lote</th>
                                      <th className="text-left py-2 font-semibold">Vencimiento</th>
                                      <th className="text-center py-2 font-semibold">Total</th>
                                      <th className="text-center py-2 font-semibold">Reservado</th>
                                      <th className="text-center py-2 font-semibold">Disponible</th>
                                      <th className="text-right py-2 font-semibold">Costo</th>
                                      <th className="text-right py-2 font-semibold">Venta</th>
                                      <th className="text-right py-2 font-semibold">Margen</th>
                                      <th className="py-2" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {g.rows.map((row) => {
                                      const m = margenPct(row.precio_venta ?? 0, row.precio_costo ?? 0)
                                      const days = daysUntil(row.fecha_vencimiento)
                                      const isExpired = days !== null && days < 0
                                      return (
                                        <tr key={row.id} className={isExpired ? 'opacity-70' : ''}>
                                          <td className="py-2 text-slate-700">
                                            {row.presentacion?.nombre ?? '—'}
                                            {row.presentacion?.unidad ? (
                                              <span className="text-slate-400"> · {row.presentacion.unidad}</span>
                                            ) : null}
                                          </td>
                                          <td className="py-2">
                                            {row.numero_lote ? (
                                              <span className="font-mono text-slate-700">{row.numero_lote}</span>
                                            ) : (
                                              <span className="text-slate-400">—</span>
                                            )}
                                          </td>
                                          <td className="py-2">
                                            {row.fecha_vencimiento ? (
                                              <div className="flex items-center gap-2">
                                                <span className="text-slate-700">{formatDate(row.fecha_vencimiento)}</span>
                                                {expirationBadge(row.fecha_vencimiento)}
                                              </div>
                                            ) : (
                                              <span className="text-slate-400">—</span>
                                            )}
                                          </td>
                                          <td className="py-2 text-center text-slate-700">{row.stock_total}</td>
                                          <td className="py-2 text-center text-amber-600">{row.stock_reservado}</td>
                                          <td className="py-2 text-center font-semibold text-green-700">
                                            {row.stock_disponible}
                                          </td>
                                          <td className="py-2 text-right font-mono text-slate-600">
                                            {formatMoney(row.precio_costo ?? 0)}
                                          </td>
                                          <td className="py-2 text-right font-mono text-slate-900">
                                            {formatMoney(row.precio_venta ?? 0)}
                                          </td>
                                          <td className="py-2 text-right">
                                            {m === null ? (
                                              <span className="text-slate-400">—</span>
                                            ) : (
                                              <span
                                                className={
                                                  m >= 30 ? 'text-green-700' : m >= 10 ? 'text-amber-600' : 'text-red-600'
                                                }
                                              >
                                                {m.toFixed(1)}%
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 text-right">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                openAjuste(row)
                                              }}
                                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-colors"
                                            >
                                              Ajuste
                                            </button>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
                  {ajuste.row.numero_lote ? ` · ${ajuste.row.numero_lote}` : ''}
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
                  <p
                    className={`font-semibold ${
                      ajuste.row.stock_disponible <= 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
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
