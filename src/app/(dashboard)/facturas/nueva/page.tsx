'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  ReceiptText,
  User,
  Package,
  Loader2,
  ChevronDown,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cliente {
  id: string
  nombre: string
  rif?: string
  telefono?: string
  direccion?: string
}

interface Presentacion {
  id: string
  nombre: string
  precio: number
  stock: number
  unidad: string
  producto?: { nombre: string; categoria?: string }
}

interface LineItem {
  presentacion_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
}

// ─── Cliente search dropdown ──────────────────────────────────────────────────

function ClienteSelector({
  value,
  onChange,
}: {
  value: Cliente | null
  onChange: (c: Cliente | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Cliente[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const search = useCallback(
    async (q: string) => {
      if (q.length < 1) { setResults([]); return }
      setLoading(true)
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, rif, telefono, direccion')
        .ilike('nombre', `%${q}%`)
        .eq('activo', true)
        .limit(8)
      setResults(data ?? [])
      setLoading(false)
    },
    [supabase]
  )

  useEffect(() => {
    const t = setTimeout(() => search(query), 200)
    return () => clearTimeout(t)
  }, [query, search])

  if (value) {
    return (
      <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">{value.nombre.charAt(0)}</span>
          </div>
          <div>
            <p className="font-semibold text-slate-800">{value.nombre}</p>
            <p className="text-xs text-slate-500">
              {[value.rif, value.telefono].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-red-500 transition text-sm ml-4 flex-shrink-0"
        >
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar cliente por nombre..."
          className="w-full border border-slate-300 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>
      {open && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden max-h-60 overflow-y-auto">
            {results.map(c => (
              <button
                key={c.id}
                onClick={() => { onChange(c); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-teal-50 transition text-left border-b border-slate-50 last:border-0"
              >
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-slate-600 font-semibold text-xs">{c.nombre.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{c.nombre}</p>
                  {c.rif && <p className="text-xs text-slate-400">{c.rif}</p>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white rounded-xl shadow-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
          No se encontraron clientes
        </div>
      )}
    </div>
  )
}

// ─── Product search row ───────────────────────────────────────────────────────

function ProductoSearchRow({ onAdd }: { onAdd: (p: Presentacion) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Presentacion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const search = useCallback(
    async (q: string) => {
      if (q.length < 1) { setResults([]); return }
      setLoading(true)
      const { data } = await supabase
        .from('presentaciones')
        .select('id, nombre, precio, stock, unidad, productos(nombre, categoria)')
        .ilike('nombre', `%${q}%`)
        .eq('activo', true)
        .gt('stock', 0)
        .limit(10)
      setResults(
        (data ?? []).map((r: any) => ({
          ...r,
          producto: r.productos,
        }))
      )
      setLoading(false)
    },
    [supabase]
  )

  useEffect(() => {
    const t = setTimeout(() => search(query), 200)
    return () => clearTimeout(t)
  }, [query, search])

  return (
    <div className="relative">
      <div className="relative">
        <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar producto o presentación para agregar..."
          className="w-full border border-dashed border-slate-300 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 hover:bg-white transition"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden max-h-72 overflow-y-auto">
            {results.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  onAdd(p)
                  setQuery('')
                  setResults([])
                  setOpen(false)
                }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-teal-50 transition text-left border-b border-slate-50 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm">
                    {p.producto?.nombre} — <span className="text-slate-500">{p.nombre}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Stock: <span className={p.stock < 5 ? 'text-amber-600 font-semibold' : 'text-slate-500'}>{p.stock} {p.unidad}</span>
                  </p>
                </div>
                <div className="flex-shrink-0 ml-4 text-right">
                  <p className="font-semibold text-teal-700 text-sm">{formatCurrency(p.precio)}</p>
                  <span className="text-xs text-slate-400">por {p.unidad}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white rounded-xl shadow-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
          No se encontraron productos con stock disponible
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NuevaFacturaPage() {
  const router = useRouter()

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [descuentoGlobal, setDescuentoGlobal] = useState(0)
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Add product to items list ──────────────────────────────────────────────

  const addProducto = (p: Presentacion) => {
    // If already in list, increment quantity
    setItems(prev => {
      const exists = prev.findIndex(i => i.presentacion_id === p.id)
      if (exists >= 0) {
        return prev.map((item, idx) => {
          if (idx !== exists) return item
          const nuevaCantidad = item.cantidad + 1
          const base = nuevaCantidad * item.precio_unitario
          const descAmt = base * (item.descuento / 100)
          return { ...item, cantidad: nuevaCantidad, subtotal: base - descAmt }
        })
      }
      const desc = `${p.producto?.nombre ?? ''} — ${p.nombre}`.trim()
      return [
        ...prev,
        {
          presentacion_id: p.id,
          descripcion: desc,
          cantidad: 1,
          precio_unitario: p.precio,
          descuento: 0,
          subtotal: p.precio,
        },
      ]
    })
  }

  // ── Update a line item field ───────────────────────────────────────────────

  const updateItem = (idx: number, field: keyof LineItem, raw: string) => {
    setItems(prev =>
      prev.map((item, i) => {
        if (i !== idx) return item
        const updated = { ...item, [field]: field === 'descripcion' ? raw : Number(raw) }
        const base = updated.cantidad * updated.precio_unitario
        const discAmt = base * (updated.descuento / 100)
        updated.subtotal = base - discAmt
        return updated
      })
    )
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  // ── Totals ─────────────────────────────────────────────────────────────────

  const subtotal = items.reduce((a, i) => a + i.subtotal, 0)
  const total = Math.max(0, subtotal - descuentoGlobal)

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError('')
    if (!cliente) { setError('Debes seleccionar un cliente.'); return }
    if (items.length === 0) { setError('Agrega al menos un producto.'); return }
    if (items.some(i => i.cantidad <= 0)) { setError('Todas las cantidades deben ser mayores a 0.'); return }

    setLoading(true)

    const payload = {
      cliente_id: cliente.id,
      items: items.map(i => ({
        presentacion_id: i.presentacion_id,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        descuento: i.descuento,
        subtotal: i.subtotal,
      })),
      descuento: descuentoGlobal,
      fecha_vencimiento: fechaVencimiento || null,
      notas: notas || null,
    }

    try {
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al crear la factura.')
        setLoading(false)
        return
      }

      router.push(`/facturas/${data.id}`)
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-slate-50 pb-10">

      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-4 lg:px-8 py-5">
        <div className="flex items-center gap-3">
          <Link href="/facturas" className="text-slate-400 hover:text-slate-700 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
              <ReceiptText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Nueva Factura</h1>
              <p className="text-xs text-slate-500">Completa los datos para generar la factura</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6 space-y-5">

        {/* ── Paso 1: Cliente ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">1</span>
            </div>
            <h2 className="font-semibold text-slate-700">Cliente</h2>
            {cliente && (
              <span className="ml-auto text-xs text-emerald-600 font-medium">✓ Seleccionado</span>
            )}
          </div>
          <div className="p-5">
            <ClienteSelector value={cliente} onChange={setCliente} />
            <p className="text-xs text-slate-400 mt-2">
              ¿Cliente nuevo?{' '}
              <Link href="/clientes/nuevo" target="_blank" className="text-teal-600 hover:underline">
                Créalo aquí →
              </Link>
            </p>
          </div>
        </section>

        {/* ── Paso 2: Productos ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">2</span>
            </div>
            <h2 className="font-semibold text-slate-700">Productos</h2>
            {items.length > 0 && (
              <span className="ml-auto text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                {items.length} ítem{items.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="p-5 space-y-4">
            <ProductoSearchRow onAdd={addProducto} />

            {/* Items table */}
            {items.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Desktop header */}
                <div className="hidden md:grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <div className="col-span-5">Descripción</div>
                  <div className="col-span-2 text-center">Cant.</div>
                  <div className="col-span-2 text-right">Precio Unit.</div>
                  <div className="col-span-1 text-center">Desc. %</div>
                  <div className="col-span-1 text-right">Subtotal</div>
                  <div className="col-span-1" />
                </div>

                <div className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <div key={idx} className="px-4 py-3">
                      {/* Mobile layout */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <input
                            value={item.descripcion}
                            onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                            className="flex-1 text-sm font-medium text-slate-700 bg-transparent focus:outline-none focus:bg-slate-50 rounded px-1"
                          />
                          <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-slate-400">Cant.</label>
                            <input
                              type="number"
                              min={1}
                              value={item.cantidad}
                              onChange={e => updateItem(idx, 'cantidad', e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">Precio</label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.precio_unitario}
                              onChange={e => updateItem(idx, 'precio_unitario', e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">Desc. %</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={item.descuento}
                              onChange={e => updateItem(idx, 'descuento', e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-800">
                            Subtotal: {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <input
                            value={item.descripcion}
                            onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                            className="w-full text-sm text-slate-700 bg-transparent focus:outline-none focus:bg-slate-50 rounded px-1 py-0.5"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min={1}
                            value={item.cantidad}
                            onChange={e => updateItem(idx, 'cantidad', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="col-span-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.precio_unitario}
                            onChange={e => updateItem(idx, 'precio_unitario', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="col-span-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.descuento}
                            onChange={e => updateItem(idx, 'descuento', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <span className="text-sm font-semibold text-slate-700">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-red-300 hover:text-red-500 transition p-1 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Busca un producto arriba para agregarlo
              </div>
            )}
          </div>
        </section>

        {/* ── Paso 3: Totales y opciones ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">3</span>
            </div>
            <h2 className="font-semibold text-slate-700">Totales y Opciones</h2>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: config fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Descuento Global ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={descuentoGlobal}
                    onChange={e => setDescuentoGlobal(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Fecha de Vencimiento
                  </label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={e => setFechaVencimiento(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Notas / Observaciones
                  </label>
                  <textarea
                    rows={3}
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    placeholder="Condiciones de pago, instrucciones especiales..."
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>
              </div>

              {/* Right: totals summary */}
              <div>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-teal-600">
                    <p className="text-xs font-bold text-teal-200 uppercase tracking-wider">Resumen</p>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal ({items.length} ítem{items.length !== 1 ? 's' : ''})</span>
                      <span className="font-medium text-slate-700">{formatCurrency(subtotal)}</span>
                    </div>
                    {descuentoGlobal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Descuento</span>
                        <span className="font-medium text-red-600">− {formatCurrency(descuentoGlobal)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-3 flex justify-between">
                      <span className="font-bold text-slate-800 text-base">TOTAL</span>
                      <span className="font-bold text-teal-700 text-xl">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <Link
            href="/facturas"
            className="flex-1 sm:flex-none flex items-center justify-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition"
          >
            Cancelar
          </Link>
          <button
            onClick={handleSubmit}
            disabled={loading || !cliente || items.length === 0}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm transition shadow-sm',
              loading || !cliente || items.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/20'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando factura...
              </>
            ) : (
              <>
                <ReceiptText className="w-4 h-4" />
                Generar Factura
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
