'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Save, ArrowLeft, Package, CalendarClock } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

interface Presentacion {
  id: string
  nombre: string
  costo: number
  stock: number
  codigo?: string | null
  producto_id?: string | null
  tiene_vencimiento?: boolean
  productos: { nombre: string } | null
}

interface Proveedor {
  id: string
  nombre: string
  empresa?: string
}

interface Props {
  presentaciones: Presentacion[]
  proveedores: Proveedor[]
}

interface LineItem {
  presentacion_id: string
  cantidad: number
  precio_costo: number
  numero_lote: string          // empty → server auto-generates LOT-YYYY-NNNN
  fecha_vencimiento: string    // yyyy-mm-dd or ''
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400"

export default function NuevaCompraClient({ presentaciones, proveedores }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [proveedorId, setProveedorId] = useState('')
  const [fechaCompra, setFechaCompra] = useState(new Date().toISOString().split('T')[0])
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { presentacion_id: '', cantidad: 1, precio_costo: 0, numero_lote: '', fecha_vencimiento: '' },
  ])

  const addItem = () =>
    setItems(prev => [...prev, { presentacion_id: '', cantidad: 1, precio_costo: 0, numero_lote: '', fecha_vencimiento: '' }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i: number, key: keyof LineItem, value: string | number) =>
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [key]: value } as LineItem
      // Auto-fill cost when presentacion changes.
      if (key === 'presentacion_id') {
        const pres = presentaciones.find(p => p.id === value)
        if (pres) updated.precio_costo = pres.costo ?? 0
        // Reset lot data when switching product
        updated.numero_lote = ''
        updated.fecha_vencimiento = ''
      }
      return updated
    }))

  const total = items.reduce((s, i) => s + (i.cantidad || 0) * (i.precio_costo || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = items.filter(i => i.presentacion_id && i.cantidad > 0)
    if (validItems.length === 0) {
      toast.error('Agrega al menos un producto válido')
      return
    }

    // Require fecha_vencimiento for expiring products
    for (const it of validItems) {
      const pres = presentaciones.find(p => p.id === it.presentacion_id)
      if (pres?.tiene_vencimiento && !it.fecha_vencimiento) {
        toast.error(`Falta la fecha de vencimiento de ${pres.productos?.nombre ?? 'un producto'}`)
        return
      }
    }

    setSaving(true)
    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_id: proveedorId || null,
          fecha_compra: fechaCompra,
          notas,
          items: validItems.map(i => ({
            presentacion_id: i.presentacion_id,
            cantidad: i.cantidad,
            precio_costo: i.precio_costo,
            numero_lote: i.numero_lote.trim() || null,
            fecha_vencimiento: i.fecha_vencimiento || null,
          })),
        }),
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok) {
        toast.error(data?.error ?? 'Error al registrar compra')
        return
      }
      if (data?.id) {
        toast.success('Compra registrada en borrador. Márcala como recibida para actualizar el inventario.')
        router.push(`/compras/${data.id}`)
      } else {
        toast.error('Error al crear la compra: ' + (data?.error || 'sin id'))
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/compras" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>

      {/* Header fields */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
        <h2 className="font-semibold text-sm text-slate-800 dark:text-white mb-4">Datos de la compra</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Proveedor</label>
            <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} className={inputCls}>
              <option value="">Sin proveedor</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}{p.empresa ? ` — ${p.empresa}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Fecha de compra *</label>
            <input
              type="date"
              value={fechaCompra}
              onChange={e => setFechaCompra(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              className={inputCls}
            />
            <p className="mt-1 text-[10px] text-slate-400">Día en que se realizó la compra (puede ser pasado).</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Notas</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones..." className={inputCls} />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-500" />
            <h2 className="font-semibold text-sm text-slate-800 dark:text-white">Productos comprados</h2>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar producto
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {items.map((item, i) => {
            const pres = presentaciones.find(p => p.id === item.presentacion_id)
            const subtotal = (item.cantidad || 0) * (item.precio_costo || 0)
            const showLot = Boolean(pres?.tiene_vencimiento)
            return (
              <div key={i} className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Producto / Presentación
                    </label>
                    <select
                      value={item.presentacion_id}
                      onChange={e => updateItem(i, 'presentacion_id', e.target.value)}
                      className={inputCls}
                      required
                    >
                      <option value="">Seleccionar presentación...</option>
                      {presentaciones.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.codigo ? `[${p.codigo}] ` : ''}{p.productos?.nombre ?? '?'} · {p.nombre} (stock: {p.stock})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      value={item.cantidad}
                      onChange={e => updateItem(i, 'cantidad', Number(e.target.value))}
                      className={`${inputCls} text-right`}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Costo Unit. ($)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.precio_costo}
                      onChange={e => updateItem(i, 'precio_costo', Number(e.target.value))}
                      className={`${inputCls} text-right`}
                      required
                    />
                  </div>
                  <div className="sm:col-span-1 text-right">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">Subtotal</div>
                    <div className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(subtotal)}</div>
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-slate-300 hover:text-red-500 transition p-2 rounded"
                        aria-label="Eliminar item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {showLot && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/40 p-3">
                    <div className="flex items-center gap-2 mb-3 text-amber-800 dark:text-amber-200">
                      <CalendarClock className="w-4 h-4" />
                      <span className="text-xs font-semibold">Producto con vencimiento — requiere lote</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                          N° de Lote
                        </label>
                        <input
                          type="text"
                          value={item.numero_lote}
                          onChange={e => updateItem(i, 'numero_lote', e.target.value)}
                          placeholder="Automático (LOT-YYYY-0001) si se deja vacío"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                          Fecha de vencimiento *
                        </label>
                        <input
                          type="date"
                          value={item.fecha_vencimiento}
                          onChange={e => updateItem(i, 'fecha_vencimiento', e.target.value)}
                          min={fechaCompra}
                          required
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-6 py-4 border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
          <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Total de la compra</span>
          <span className="font-bold text-teal-700 dark:text-teal-400 text-base">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Link href="/compras" className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Registrando...' : 'Registrar compra'}
        </button>
      </div>
    </form>
  )
}
