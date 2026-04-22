'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface NCItem {
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export default function NuevaNotaCreditoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const facturaIdParam = searchParams.get('factura_id')

  const [facturaId, setFacturaId] = useState(facturaIdParam || '')
  const [facturaInfo, setFacturaInfo] = useState<any>(null)
  const [motivo, setMotivo] = useState('')
  const [tipo, setTipo] = useState('devolucion')
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState<NCItem[]>([{ descripcion: '', cantidad: 1, precio_unitario: 0, subtotal: 0 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (facturaId && facturaId.length > 10) {
      supabase
        .from('facturas')
        .select('id, numero, total, clientes(id, nombre)')
        .eq('id', facturaId)
        .single()
        .then(({ data }) => setFacturaInfo(data))
    }
  }, [facturaId])

  const updateItem = (i: number, field: keyof NCItem, value: string | number) => {
    setItems(prev => {
      const updated = [...prev]
      updated[i] = { ...updated[i], [field]: value }
      if (field === 'cantidad' || field === 'precio_unitario') {
        updated[i].subtotal = updated[i].cantidad * updated[i].precio_unitario
      }
      return updated
    })
  }

  const subtotal = items.reduce((a, i) => a + i.subtotal, 0)
  const total = subtotal

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!facturaInfo) { setError('Ingrese un ID de factura válido'); return }
    if (!motivo.trim()) { setError('El motivo es requerido'); return }
    if (items.some(i => !i.descripcion.trim())) { setError('Todos los ítems deben tener descripción'); return }

    setLoading(true)
    setError('')

    const res = await fetch('/api/notas-credito', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        factura_id: facturaId,
        cliente_id: facturaInfo.clientes?.id,
        motivo, tipo, notas, items,
      }),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error || 'Error al crear nota de crédito')
      setLoading(false)
      return
    }

    const nc = await res.json()
    router.push(`/notas-credito/${nc.id}`)
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/notas-credito" className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">Nueva Nota de Crédito</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Factura referencia */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">Factura Referenciada</h2>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ID o Número de Factura</label>
            <input
              value={facturaId}
              onChange={e => setFacturaId(e.target.value)}
              placeholder="Pegar el ID de la factura"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {facturaInfo && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-teal-800">{facturaInfo.numero}</p>
              <p className="text-teal-600">{facturaInfo.clientes?.nombre} — Total: {formatCurrency(facturaInfo.total)}</p>
            </div>
          )}
        </div>

        {/* Datos generales */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">Datos Generales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Tipo *</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="devolucion">Devolución</option>
                <option value="descuento">Descuento</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Notas</label>
              <input
                value={notas}
                onChange={e => setNotas(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Motivo *</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Describa el motivo de la nota de crédito..."
            />
          </div>
        </div>

        {/* Ítems */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Ítems</h2>
            <button
              type="button"
              onClick={() => setItems(p => [...p, { descripcion: '', cantidad: 1, precio_unitario: 0, subtotal: 0 }])}
              className="text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input
                  value={item.descripcion}
                  onChange={e => updateItem(i, 'descripcion', e.target.value)}
                  placeholder="Descripción"
                  className="col-span-5 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="number"
                  value={item.cantidad}
                  onChange={e => updateItem(i, 'cantidad', Number(e.target.value))}
                  min={1}
                  className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="number"
                  value={item.precio_unitario}
                  onChange={e => updateItem(i, 'precio_unitario', Number(e.target.value))}
                  min={0}
                  step="0.01"
                  className="col-span-3 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <div className="col-span-1 text-right text-sm font-medium text-slate-700">
                  {formatCurrency(item.subtotal)}
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="col-span-1 text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between font-bold text-slate-800 text-base"><span>Total NC</span><span>{formatCurrency(total)}</span></div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {loading ? 'Guardando...' : 'Emitir Nota de Crédito'}
        </button>
      </form>
    </div>
  )
}
