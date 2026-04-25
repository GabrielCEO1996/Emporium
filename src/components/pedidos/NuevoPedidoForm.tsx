'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Cliente, Presentacion } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  User,
  Package,
  ClipboardList,
  Check,
  AlertCircle,
  Loader2,
  ShoppingCart,
  Zap,
  Banknote,
  CreditCard,
  Send,
  X,
  History,
  Tag,
  RotateCcw,
  TrendingUp,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceContext {
  precio_oficial: number
  precio_costo: number
  descuento_global_pct: number
  precio_con_descuento: number
  ultima_venta: {
    precio: number
    cantidad: number
    fecha: string
    dias_atras: number
    factura_id: string | null
  } | null
}

interface CartItem {
  presentacion: Presentacion & { producto?: { nombre: string; categoria?: string } }
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
  /** Pricing context fetched from /api/pricing/sugerido — populated async */
  pricing?: PriceContext
}

interface FormState {
  cliente: Cliente | null
  items: CartItem[]
  descuento_global: number
  notas: string
  direccion_entrega: string
  fecha_entrega_estimada: string
}

type MetodoPago = 'efectivo' | 'zelle' | 'cheque' | 'tarjeta'

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = [
    { n: 1, label: 'Cliente', icon: User },
    { n: 2, label: 'Productos', icon: Package },
    { n: 3, label: 'Resumen', icon: ClipboardList },
  ]
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, idx) => {
        const Icon = step.icon
        const done = current > step.n
        const active = current === step.n
        return (
          <div key={step.n} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  done
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : active
                    ? 'border-teal-600 bg-white text-teal-600'
                    : 'border-slate-200 bg-white text-slate-400'
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:block',
                  active ? 'text-teal-600' : done ? 'text-slate-600' : 'text-slate-400'
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-16 sm:w-24 mx-1 transition-colors',
                  current > step.n ? 'bg-teal-600' : 'bg-slate-200'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Select Client ────────────────────────────────────────────────────

function StepCliente({
  selected,
  onSelect,
}: {
  selected: Cliente | null
  onSelect: (c: Cliente) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([])
        return
      }
      setLoading(true)
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('activo', true)
        .or(`nombre.ilike.%${q}%,rif.ilike.%${q}%,telefono.ilike.%${q}%`)
        .order('nombre')
        .limit(10)
      setResults(data ?? [])
      setLoading(false)
    },
    [supabase]
  )

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Buscar cliente
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, RIF o teléfono..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c)
                setQuery(c.nombre)
                setResults([])
              }}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-teal-50 transition-colors',
                selected?.id === c.id && 'bg-teal-50'
              )}
            >
              <p className="text-sm font-medium text-slate-900">{c.nombre}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {[c.rif, c.telefono, c.ciudad].filter(Boolean).join(' · ')}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white font-bold text-sm shrink-0">
              {selected.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900">{selected.nombre}</p>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                {selected.rif && <span>RIF: {selected.rif}</span>}
                {selected.telefono && <span>{selected.telefono}</span>}
                {selected.ciudad && <span>{selected.ciudad}</span>}
              </div>
              {selected.direccion && (
                <p className="mt-1 text-xs text-slate-500 truncate">
                  {selected.direccion}
                </p>
              )}
            </div>
            <Check className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stock badge helper ──────────────────────────────────────────────────────

function stockBadgeClass(stock: number): string {
  if (stock <= 0)  return 'bg-red-100 text-red-700'
  if (stock <= 10) return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

// ─── Step 2: Add Products ─────────────────────────────────────────────────────

function StepProductos({
  items,
  clienteDescuentoPct,
  onAdd,
  onRemove,
  onChangeQty,
  onChangePrice,
  onRestaurarPrecio,
}: {
  items: CartItem[]
  clienteDescuentoPct: number
  onAdd: (p: Presentacion & { producto?: { nombre: string; categoria?: string } }) => void
  onRemove: (id: string) => void
  onChangeQty: (id: string, qty: number) => void
  onChangePrice: (id: string, precio: number) => void
  onRestaurarPrecio: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    (Presentacion & { producto?: { nombre: string; categoria?: string } })[]
  >([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const search = useCallback(
    async (q: string) => {
      setLoading(true)
      let dbQuery = supabase
        .from('presentaciones')
        .select(`
          *,
          producto:productos(id, codigo, nombre, categoria, tiene_vencimiento, precio_venta_sugerido),
          inventario(stock_total, stock_reservado, stock_disponible, precio_venta, fecha_vencimiento)
        `)
        .eq('activo', true)
        .order('nombre')
        .limit(12)

      if (q.trim()) {
        dbQuery = dbQuery.or(
          `nombre.ilike.%${q}%,codigo_barras.ilike.%${q}%`
        )
      }

      const { data } = await dbQuery
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const mapped = ((data as any[]) ?? []).map((pres: any) => {
        // Aggregate stock across non-expired lots (never expose lot info to the vendor).
        const invRows: any[] = Array.isArray(pres.inventario)
          ? pres.inventario
          : pres.inventario
            ? [pres.inventario]
            : []

        let stockFresh = 0
        let stockExpired = 0
        let precio = 0
        for (const r of invRows) {
          const isExpired = r.fecha_vencimiento
            ? new Date(r.fecha_vencimiento).getTime() < today.getTime()
            : false
          const disp = r.stock_disponible ?? Math.max(0, (r.stock_total ?? 0) - (r.stock_reservado ?? 0))
          if (isExpired) stockExpired += disp
          else stockFresh += disp
          if (!precio && (r.precio_venta ?? 0) > 0) precio = r.precio_venta
        }
        if (!precio) {
          precio = pres.producto?.precio_venta_sugerido || pres.precio || 0
        }

        // Fallback to legacy column if inventario is completely missing (products with no inventory row).
        const stock = invRows.length > 0 ? stockFresh : (pres.stock ?? 0)

        return {
          ...pres,
          stock,
          stock_expired: stockExpired,
          precio,
          all_expired: invRows.length > 0 && stockFresh <= 0 && stockExpired > 0,
        }
      })
      setResults(mapped)
      setLoading(false)
    },
    [supabase]
  )

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => {
    search('')
  }, [search])

  const inCart = (id: string) => items.find((i) => i.presentacion.id === id)

  return (
    <div className="space-y-4">
      {clienteDescuentoPct > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
          <Tag className="h-3.5 w-3.5 shrink-0" />
          <span>
            Este cliente tiene un <span className="font-bold">{clienteDescuentoPct.toFixed(clienteDescuentoPct % 1 === 0 ? 0 : 1)}% de descuento global</span>. Se aplica automáticamente a cada producto que agregues.
          </span>
        </div>
      )}
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto o presentación..."
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Product results */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Presentaciones disponibles
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
            {results.length === 0 && !loading && (
              <p className="p-4 text-center text-sm text-slate-400">
                {query ? 'Sin resultados' : 'Cargando...'}
              </p>
            )}
            {results.map((pres) => {
              const cartItem = inCart(pres.id)
              const allExpired = (pres as any).all_expired === true
              const sinStock = pres.stock <= 0
              const disabled = sinStock || allExpired
              return (
                <div
                  key={pres.id}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 gap-3',
                    disabled && 'opacity-50'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {pres.producto?.nombre ?? ''} — {pres.nombre}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-semibold text-teal-700">
                        {formatCurrency(pres.precio)}
                      </span>
                      {allExpired ? (
                        <span className="text-xs font-semibold rounded-full px-1.5 py-0.5 bg-slate-900 text-white">
                          ⚫ Vencido - No disponible
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'text-xs font-semibold rounded-full px-1.5 py-0.5',
                            stockBadgeClass(pres.stock)
                          )}
                        >
                          {sinStock ? 'Agotado' : `Stock: ${pres.stock} ${pres.unidad}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && onAdd(pres as any)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full transition-colors shrink-0',
                      cartItem
                        ? 'bg-green-100 text-green-700'
                        : disabled
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                    )}
                  >
                    {cartItem ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Cart */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Carrito ({items.length} ítem{items.length !== 1 ? 's' : ''})
          </p>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShoppingCart className="h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">Carrito vacío</p>
              </div>
            )}
            {items.map((item) => {
              const ctx = item.pricing
              const oficial = ctx?.precio_oficial ?? item.presentacion.precio ?? 0
              const costo = ctx?.precio_costo ?? 0
              const sugerido = ctx?.precio_con_descuento ?? oficial
              const ultima = ctx?.ultima_venta ?? null
              const precioFinal = item.precio_unitario
              const margenPct = precioFinal > 0 ? ((precioFinal - costo) / precioFinal) * 100 : 0
              const bajoCosto = costo > 0 && precioFinal < costo
              const descAplicado = oficial > 0 && precioFinal < oficial
                ? ((oficial - precioFinal) / oficial) * 100
                : 0
              return (
                <div key={item.presentacion.id} className="px-3 py-2.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {item.presentacion.producto?.nombre ?? ''} — {item.presentacion.nombre}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.presentacion.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* ── Pricing context (oficial / descuento / última venta) ── */}
                  <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5 space-y-0.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Precio oficial</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(oficial)}</span>
                    </div>
                    {ctx && ctx.descuento_global_pct > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-violet-600">
                          <Tag className="h-3 w-3" />
                          Con descuento ({ctx.descuento_global_pct.toFixed(ctx.descuento_global_pct % 1 === 0 ? 0 : 1)}%)
                        </span>
                        <span className="font-semibold text-violet-700">{formatCurrency(sugerido)}</span>
                      </div>
                    )}
                    {ultima && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-amber-600">
                          <History className="h-3 w-3" />
                          Última venta ({ultima.dias_atras === 0 ? 'hoy' : `hace ${ultima.dias_atras}d`})
                        </span>
                        <span className="font-semibold text-amber-700">{formatCurrency(ultima.precio)}</span>
                      </div>
                    )}
                  </div>

                  {/* Editable price per line */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-slate-500 shrink-0">Precio:</label>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1 text-xs text-slate-400">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.precio_unitario}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          if (!isNaN(v) && v >= 0) onChangePrice(item.presentacion.id, v)
                        }}
                        className={cn(
                          'w-full pl-5 pr-2 py-1 text-xs font-semibold border rounded focus:outline-none focus:ring-1',
                          bajoCosto
                            ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-500'
                            : margenPct >= 25
                            ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700 focus:ring-emerald-500'
                            : margenPct >= 10
                            ? 'border-amber-200 bg-amber-50/50 text-amber-700 focus:ring-amber-500'
                            : 'border-slate-200 focus:ring-teal-500'
                        )}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRestaurarPrecio(item.presentacion.id)}
                      title="Restaurar precio sugerido"
                      className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Margin + discount applied badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    {costo > 0 && (
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold',
                        bajoCosto ? 'bg-red-100 text-red-700' :
                        margenPct >= 25 ? 'bg-emerald-100 text-emerald-700' :
                        margenPct >= 10 ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      )}>
                        <TrendingUp className="h-2.5 w-2.5" />
                        {bajoCosto
                          ? `⚠ Bajo costo (${margenPct.toFixed(0)}%)`
                          : `Margen ${margenPct.toFixed(1)}%`}
                      </span>
                    )}
                    {descAplicado > 0.1 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-700">
                        <Tag className="h-2.5 w-2.5" />
                        -{descAplicado.toFixed(1)}% vs oficial
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onChangeQty(item.presentacion.id, Math.max(1, item.cantidad - 1))
                        }
                        className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={item.presentacion.stock}
                        value={item.cantidad}
                        onChange={(e) => {
                          const v = parseInt(e.target.value)
                          if (!isNaN(v) && v >= 1) {
                            onChangeQty(
                              item.presentacion.id,
                              Math.min(v, item.presentacion.stock)
                            )
                          }
                        }}
                        className="w-12 text-center text-sm border border-slate-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onChangeQty(
                            item.presentacion.id,
                            Math.min(item.presentacion.stock, item.cantidad + 1)
                          )
                        }
                        disabled={item.cantidad >= item.presentacion.stock}
                        className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                  {item.cantidad >= item.presentacion.stock && (
                    <p className="text-xs text-yellow-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Máximo disponible
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Running total */}
          {items.length > 0 && (
            <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 flex justify-between items-center">
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                Total parcial
              </span>
              <span className="text-lg font-bold text-teal-700">
                {formatCurrency(items.reduce((s, i) => s + i.subtotal, 0))}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Summary ──────────────────────────────────────────────────────────

function StepResumen({
  form,
  onChange,
}: {
  form: FormState
  onChange: (partial: Partial<FormState>) => void
}) {
  const subtotalItems = form.items.reduce((s, i) => s + i.subtotal, 0)
  const descuento = form.descuento_global
  const total = Math.max(0, subtotalItems - descuento)

  return (
    <div className="space-y-5">
      {/* Items table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Producto
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cant.
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                P. Unit.
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {form.items.map((item) => (
              <tr key={item.presentacion.id}>
                <td className="px-4 py-3 text-slate-900">
                  <p className="font-medium">
                    {item.presentacion.producto?.nombre ?? ''} — {item.presentacion.nombre}
                  </p>
                  <p className="text-xs text-slate-500">{item.presentacion.unidad}</p>
                </td>
                <td className="px-4 py-3 text-center text-slate-700">
                  {item.cantidad}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {formatCurrency(item.precio_unitario)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatCurrency(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals & extra fields */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Left: extra fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Descuento global (USD)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.descuento_global}
              onChange={(e) =>
                onChange({ descuento_global: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Fecha de entrega estimada
            </label>
            <input
              type="date"
              value={form.fecha_entrega_estimada}
              onChange={(e) => onChange({ fecha_entrega_estimada: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Dirección de entrega
            </label>
            <input
              type="text"
              value={form.direccion_entrega}
              onChange={(e) => onChange({ direccion_entrega: e.target.value })}
              placeholder={form.cliente?.direccion ?? 'Dirección de entrega...'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Notas (opcional)
            </label>
            <textarea
              rows={3}
              value={form.notas}
              onChange={(e) => onChange({ notas: e.target.value })}
              placeholder="Observaciones, instrucciones de entrega..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {/* Right: totals */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 h-fit">
          <h3 className="text-sm font-semibold text-slate-900">Resumen de totales</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotalItems)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Descuento</span>
                <span className="text-red-600">− {formatCurrency(descuento)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-900 text-base">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {form.cliente && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Cliente
              </p>
              <p className="text-sm font-medium text-slate-900">{form.cliente.nombre}</p>
              {form.cliente.rif && (
                <p className="text-xs text-slate-500">RIF: {form.cliente.rif}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Venta Directa Modal ──────────────────────────────────────────────────────

function VentaDirectaModal({
  open,
  total,
  onClose,
  onConfirm,
  submitting,
}: {
  open: boolean
  total: number
  onClose: () => void
  onConfirm: (metodo: MetodoPago, referencia: string) => void
  submitting: boolean
}) {
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [referencia, setReferencia] = useState('')

  if (!open) return null

  const METODOS: { key: MetodoPago; label: string; icon: any; color: string; requireRef: boolean }[] = [
    { key: 'efectivo', label: 'Efectivo', icon: Banknote,   color: 'emerald', requireRef: false },
    { key: 'zelle',    label: 'Zelle',    icon: Send,       color: 'blue',    requireRef: true  },
    { key: 'cheque',   label: 'Cheque',   icon: Send,       color: 'amber',   requireRef: true  },
    { key: 'tarjeta',  label: 'Tarjeta',  icon: CreditCard, color: 'purple',  requireRef: false },
  ]

  const needsRef = METODOS.find((m) => m.key === metodo)?.requireRef ?? false
  const canConfirm = !submitting && (!needsRef || referencia.trim().length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Zap className="h-4 w-4 text-green-600" />
            Venta Directa
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-center">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Total a cobrar</p>
            <p className="text-2xl font-bold text-green-700 mt-0.5">{formatCurrency(total)}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Método de pago
            </p>
            <div className="grid grid-cols-2 gap-2">
              {METODOS.map((m) => {
                const Icon = m.icon
                const selected = m.key === metodo
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMetodo(m.key)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors',
                      selected
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {needsRef && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Número de referencia <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Últimos 6 dígitos..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(metodo, referencia.trim() || '')}
            disabled={!canConfirm}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {submitting ? 'Procesando...' : 'Confirmar cobro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function NuevoPedidoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preClienteId = searchParams.get('cliente')

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [ventaDirectaOpen, setVentaDirectaOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    cliente: null,
    items: [],
    descuento_global: 0,
    notas: '',
    direccion_entrega: '',
    fecha_entrega_estimada: '',
  })

  // Pre-load client if ID is in query string
  useEffect(() => {
    if (!preClienteId) return
    const supabase = createClient()
    supabase
      .from('clientes')
      .select('*')
      .eq('id', preClienteId)
      .single()
      .then(({ data }) => {
        if (data) setForm((f) => ({ ...f, cliente: data as Cliente }))
      })
  }, [preClienteId])

  const updateForm = (partial: Partial<FormState>) =>
    setForm((f) => ({ ...f, ...partial }))

  // ── Fetch pricing context for a set of presentaciones for the current cliente.
  //    Populates each cart item's `pricing` + applies the smart-default price.
  //    Preference order: última venta → descuento global → precio oficial.
  const hydratePricing = useCallback(async (
    clienteId: string,
    presIds: string[],
    /** If true, overwrite precio_unitario on the affected items with the suggested price. */
    applyDefault: boolean
  ) => {
    if (!clienteId || presIds.length === 0) return
    try {
      const res = await fetch('/api/pricing/sugerido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId, presentacion_ids: presIds }),
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'error')
      const ctx: Record<string, PriceContext> = data?.context ?? {}
      setForm((f) => ({
        ...f,
        items: f.items.map((i) => {
          const c = ctx[i.presentacion.id]
          if (!c) return i
          if (!applyDefault) return { ...i, pricing: c }
          const suggested = c.ultima_venta?.precio ?? c.precio_con_descuento
          const precio = suggested > 0 ? suggested : i.precio_unitario
          return {
            ...i,
            pricing: c,
            precio_unitario: precio,
            subtotal: precio * i.cantidad - i.descuento,
          }
        }),
      }))
    } catch (err) {
      console.warn('[pricing/sugerido]', err)
    }
  }, [])

  // When cliente changes, re-hydrate pricing for all existing items AND apply defaults
  // so the displayed prices match the new cliente's policy.
  useEffect(() => {
    const clienteId = form.cliente?.id
    if (!clienteId) return
    const presIds = form.items.map((i) => i.presentacion.id)
    if (presIds.length === 0) return
    hydratePricing(clienteId, presIds, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cliente?.id])

  // Cart handlers
  const addItem = (
    pres: Presentacion & { producto?: { nombre: string; categoria?: string } }
  ) => {
    setForm((f) => {
      const existing = f.items.find((i) => i.presentacion.id === pres.id)
      if (existing) return f
      const newItem: CartItem = {
        presentacion: pres,
        cantidad: 1,
        precio_unitario: pres.precio,
        descuento: 0,
        subtotal: pres.precio,
      }
      return { ...f, items: [...f.items, newItem] }
    })
    // Fetch smart price in the background if we have a cliente selected.
    if (form.cliente?.id) {
      hydratePricing(form.cliente.id, [pres.id], true)
    }
  }

  const removeItem = (id: string) =>
    setForm((f) => ({ ...f, items: f.items.filter((i) => i.presentacion.id !== id) }))

  const changeQty = (id: string, qty: number) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((i) =>
        i.presentacion.id === id
          ? { ...i, cantidad: qty, subtotal: i.precio_unitario * qty - i.descuento }
          : i
      ),
    }))

  const changePrice = (id: string, precio: number) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((i) =>
        i.presentacion.id === id
          ? { ...i, precio_unitario: precio, subtotal: precio * i.cantidad - i.descuento }
          : i
      ),
    }))

  // Restaurar precio sugerido (última venta o precio con descuento o oficial).
  const restaurarPrecio = (id: string) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((i) => {
        if (i.presentacion.id !== id) return i
        const ctx = i.pricing
        const suggested = ctx?.ultima_venta?.precio ?? ctx?.precio_con_descuento ?? ctx?.precio_oficial ?? i.presentacion.precio
        const precio = suggested > 0 ? suggested : i.precio_unitario
        return { ...i, precio_unitario: precio, subtotal: precio * i.cantidad - i.descuento }
      }),
    }))

  // Computed totals
  const subtotalItems = form.items.reduce((s, i) => s + i.subtotal, 0)
  const total = Math.max(0, subtotalItems - form.descuento_global)

  // Validation per step
  const canProceed = () => {
    if (step === 1) return !!form.cliente
    if (step === 2) return form.items.length > 0
    return true
  }

  const canVentaDirecta = !!form.cliente && form.items.length > 0

  // Standard "Guardar Borrador" flow
  const handleSubmit = async () => {
    if (!form.cliente) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        cliente_id: form.cliente.id,
        items: form.items.map((i) => ({
          presentacion_id: i.presentacion.id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          descuento: i.descuento,
          subtotal: i.subtotal,
        })),
        subtotal: subtotalItems,
        descuento: form.descuento_global,
        impuesto: 0,
        total,
        notas: form.notas || null,
        direccion_entrega: form.direccion_entrega || form.cliente.direccion || null,
        fecha_entrega_estimada: form.fecha_entrega_estimada || null,
      }

      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear el pedido')
      router.push(`/pedidos/${data.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Error desconocido')
      setSubmitting(false)
    }
  }

  // Venta Directa flow
  const handleVentaDirecta = async (metodo_pago: MetodoPago, numero_referencia: string) => {
    if (!form.cliente || form.items.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        cliente_id: form.cliente.id,
        items: form.items.map((i) => ({
          presentacion_id: i.presentacion.id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          descuento: i.descuento,
          subtotal: i.subtotal,
        })),
        subtotal: subtotalItems,
        descuento: form.descuento_global,
        impuesto: 0,
        total,
        notas: form.notas || null,
        direccion_entrega: form.direccion_entrega || form.cliente.direccion || null,
        metodo_pago,
        numero_referencia: numero_referencia || null,
      }

      const res = await fetch('/api/pedidos/venta-directa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error en venta directa')

      setVentaDirectaOpen(false)
      router.push(`/facturas/${data.factura_id}`)
    } catch (err: any) {
      setError(err.message ?? 'Error desconocido')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex justify-center">
        <StepIndicator current={step} />
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <StepCliente
            selected={form.cliente}
            onSelect={(c) => updateForm({ cliente: c })}
          />
        )}
        {step === 2 && (
          <StepProductos
            items={form.items}
            clienteDescuentoPct={Number((form.cliente as any)?.descuento_porcentaje ?? 0)}
            onAdd={addItem}
            onRemove={removeItem}
            onChangeQty={changeQty}
            onChangePrice={changePrice}
            onRestaurarPrecio={restaurarPrecio}
          />
        )}
        {step === 3 && (
          <StepResumen form={form} onChange={updateForm} />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Venta Directa — always visible once client + items chosen */}
          {canVentaDirecta && (
            <button
              type="button"
              onClick={() => setVentaDirectaOpen(true)}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-green-700 transition-colors disabled:opacity-50 ring-2 ring-green-200"
              title="Cobrar y facturar ya"
            >
              <Zap className="h-4 w-4" />
              Venta Directa
              <span className="text-green-100 text-xs">⚡</span>
            </button>
          )}

          {step < 3 && (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || form.items.length === 0 || !form.cliente}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {submitting ? 'Guardando...' : 'Guardar Borrador'}
            </button>
          )}
        </div>
      </div>

      {/* Venta Directa modal */}
      <VentaDirectaModal
        open={ventaDirectaOpen}
        total={total}
        onClose={() => !submitting && setVentaDirectaOpen(false)}
        onConfirm={handleVentaDirecta}
        submitting={submitting}
      />
    </div>
  )
}
