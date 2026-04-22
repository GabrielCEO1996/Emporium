'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Star, Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ProveedorData {
  id?: string
  nombre?: string
  empresa?: string
  telefono?: string
  email?: string
  whatsapp?: string
  categoria?: string
  tiempo_entrega_dias?: number
  condiciones_pago?: string
  calificacion?: number
  notas?: string
  ultima_compra_fecha?: string
  ultima_compra_monto?: number
}

interface Props {
  initial?: ProveedorData
  mode: 'create' | 'edit'
}

const CATEGORIAS = ['Alimentos', 'Bebidas', 'Limpieza', 'Embalaje', 'Logística', 'Otro']
const CONDICIONES = ['contado', 'crédito 15 días', 'crédito 30 días', 'crédito 60 días', 'consignación']

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"

export default function ProveedorForm({ initial, mode }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? '',
    empresa: initial?.empresa ?? '',
    telefono: initial?.telefono ?? '',
    email: initial?.email ?? '',
    whatsapp: initial?.whatsapp ?? '',
    categoria: initial?.categoria ?? '',
    tiempo_entrega_dias: initial?.tiempo_entrega_dias ?? 1,
    condiciones_pago: initial?.condiciones_pago ?? 'contado',
    calificacion: initial?.calificacion ?? 5,
    notas: initial?.notas ?? '',
    ultima_compra_fecha: initial?.ultima_compra_fecha ?? '',
    ultima_compra_monto: initial?.ultima_compra_monto ?? '',
  })

  const set = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.nombre.trim()) errs.nombre = 'El nombre es requerido'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSaving(true)

    const payload = {
      ...form,
      tiempo_entrega_dias: Number(form.tiempo_entrega_dias),
      calificacion: Number(form.calificacion),
      ultima_compra_monto: form.ultima_compra_monto ? Number(form.ultima_compra_monto) : null,
      ultima_compra_fecha: form.ultima_compra_fecha || null,
    }

    try {
      const res = mode === 'create'
        ? await fetch('/api/proveedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/proveedores/${initial!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Error al guardar')
        return
      }
      toast.success(mode === 'create' ? 'Proveedor creado' : 'Proveedor actualizado')
      router.push('/proveedores')
      router.refresh()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/proveedores"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Información básica</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre del contacto *" error={errors.nombre}>
            <input
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Ej. Juan Pérez"
              className={inputCls}
            />
          </Field>
          <Field label="Empresa / Razón social">
            <input
              value={form.empresa}
              onChange={e => set('empresa', e.target.value)}
              placeholder="Ej. Distribuidora ABC C.A."
              className={inputCls}
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={form.telefono}
              onChange={e => set('telefono', e.target.value)}
              placeholder="+58 412 000 0000"
              className={inputCls}
            />
          </Field>
          <Field label="WhatsApp">
            <input
              value={form.whatsapp}
              onChange={e => set('whatsapp', e.target.value)}
              placeholder="+58412000000 (solo números)"
              className={inputCls}
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="contacto@empresa.com"
              className={inputCls}
            />
          </Field>
          <Field label="Categoría">
            <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className={inputCls}>
              <option value="">Sin categoría</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Condiciones comerciales</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Tiempo de entrega (días)">
            <input
              type="number"
              min={1}
              max={90}
              value={form.tiempo_entrega_dias}
              onChange={e => set('tiempo_entrega_dias', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Condiciones de pago">
            <select value={form.condiciones_pago} onChange={e => set('condiciones_pago', e.target.value)} className={inputCls}>
              {CONDICIONES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Calificación">
            <div className="flex items-center gap-2 py-2.5">
              {[1,2,3,4,5].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('calificacion', s)}
                  className="transition-transform hover:scale-110"
                >
                  <Star className={`w-6 h-6 ${s <= form.calificacion ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-600'}`} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Última compra (fecha)">
            <input
              type="date"
              value={form.ultima_compra_fecha}
              onChange={e => set('ultima_compra_fecha', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Monto última compra ($)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.ultima_compra_monto}
              onChange={e => set('ultima_compra_monto', e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
        <Field label="Notas internas">
          <textarea
            value={form.notas}
            onChange={e => set('notas', e.target.value)}
            rows={3}
            placeholder="Condiciones especiales, observaciones..."
            className={`${inputCls} resize-none`}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-3">
        <Link
          href="/proveedores"
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : mode === 'create' ? 'Crear proveedor' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
