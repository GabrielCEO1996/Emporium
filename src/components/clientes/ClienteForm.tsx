'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Cliente } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  User,
  FileText,
  Mail,
  Phone,
  MapPin,
  Building2,
  Map,
  CreditCard,
  Clock,
  StickyNote,
  Loader2,
  Save,
  X,
} from 'lucide-react'

interface ClienteFormProps {
  cliente?: Cliente
  isEditing?: boolean
}

interface FormData {
  nombre: string
  rif: string
  email: string
  telefono: string
  whatsapp: string
  direccion: string
  ciudad: string
  zona: string
  limite_credito: string
  dias_credito: string
  notas: string
  activo: boolean
}

interface FormErrors {
  nombre?: string
  email?: string
  limite_credito?: string
  dias_credito?: string
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors'

const labelClass = 'block text-sm font-medium text-slate-700 mb-1'

export default function ClienteForm({ cliente, isEditing = false }: ClienteFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    nombre: cliente?.nombre || '',
    rif: cliente?.rif || '',
    email: cliente?.email || '',
    telefono: cliente?.telefono || '',
    whatsapp: (cliente as any)?.whatsapp || '',
    direccion: cliente?.direccion || '',
    ciudad: cliente?.ciudad || '',
    zona: cliente?.zona || '',
    limite_credito: cliente?.limite_credito?.toString() || '0',
    dias_credito: cliente?.dias_credito?.toString() || '0',
    notas: cliente?.notas || '',
    activo: cliente?.activo !== undefined ? cliente.activo : true,
  })

  function validate(): boolean {
    const newErrors: FormErrors = {}

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido'
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El correo electrónico no es válido'
    }

    if (formData.limite_credito && isNaN(Number(formData.limite_credito))) {
      newErrors.limite_credito = 'Debe ser un número válido'
    }

    if (formData.dias_credito && isNaN(Number(formData.dias_credito))) {
      newErrors.dias_credito = 'Debe ser un número válido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setServerError(null)

    try {
      const payload = {
        ...formData,
        limite_credito: Number(formData.limite_credito) || 0,
        dias_credito: Number(formData.dias_credito) || 0,
      }

      const url = isEditing ? `/api/clientes/${cliente!.id}` : '/api/clientes'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        setServerError(data.error || 'Ocurrió un error al guardar el cliente')
        return
      }

      router.push(`/clientes/${data.id}`)
      router.refresh()
    } catch {
      setServerError('Error de conexión. Por favor intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Informacion Principal */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <User className="h-4 w-4 text-blue-600" />
            Información Principal
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          {/* Nombre */}
          <div className="sm:col-span-2">
            <label htmlFor="nombre" className={labelClass}>
              Nombre / Razón Social <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="nombre"
                name="nombre"
                type="text"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Nombre completo o razón social"
                className={cn(inputClass, 'pl-9', errors.nombre && 'border-red-400 focus:border-red-400 focus:ring-red-400/20')}
              />
            </div>
            {errors.nombre && (
              <p className="mt-1 text-xs text-red-600">{errors.nombre}</p>
            )}
          </div>

          {/* RIF */}
          <div>
            <label htmlFor="rif" className={labelClass}>
              RIF
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="rif"
                name="rif"
                type="text"
                value={formData.rif}
                onChange={handleChange}
                placeholder="J-12345678-9"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className={labelClass}>
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="correo@empresa.com"
                className={cn(inputClass, 'pl-9', errors.email && 'border-red-400 focus:border-red-400 focus:ring-red-400/20')}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email}</p>
            )}
          </div>

          {/* Telefono */}
          <div>
            <label htmlFor="telefono" className={labelClass}>
              Teléfono
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="telefono"
                name="telefono"
                type="tel"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="0412-1234567"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label htmlFor="whatsapp" className={labelClass}>
              WhatsApp
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-green-500" />
              <input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                value={formData.whatsapp}
                onChange={handleChange}
                placeholder="58412-1234567"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">Con código de país, ej: 584121234567</p>
          </div>

          {/* Activo */}
          <div className="flex items-center gap-3 pt-6">
            <input
              id="activo"
              name="activo"
              type="checkbox"
              checked={formData.activo}
              onChange={handleChange}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="activo" className="text-sm font-medium text-slate-700">
              Cliente activo
            </label>
          </div>
        </div>
      </div>

      {/* Ubicacion */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <MapPin className="h-4 w-4 text-blue-600" />
            Ubicación
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          {/* Direccion */}
          <div className="sm:col-span-2">
            <label htmlFor="direccion" className={labelClass}>
              Dirección
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="direccion"
                name="direccion"
                type="text"
                value={formData.direccion}
                onChange={handleChange}
                placeholder="Av. Principal, Edificio Centro, Piso 3"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>

          {/* Ciudad */}
          <div>
            <label htmlFor="ciudad" className={labelClass}>
              Ciudad
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="ciudad"
                name="ciudad"
                type="text"
                value={formData.ciudad}
                onChange={handleChange}
                placeholder="Caracas"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>

          {/* Zona */}
          <div>
            <label htmlFor="zona" className={labelClass}>
              Zona / Sector
            </label>
            <div className="relative">
              <Map className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="zona"
                name="zona"
                type="text"
                value={formData.zona}
                onChange={handleChange}
                placeholder="Este"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Condiciones de Credito */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <CreditCard className="h-4 w-4 text-blue-600" />
            Condiciones de Crédito
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          {/* Limite de Credito */}
          <div>
            <label htmlFor="limite_credito" className={labelClass}>
              Límite de Crédito (USD)
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="limite_credito"
                name="limite_credito"
                type="number"
                min="0"
                step="0.01"
                value={formData.limite_credito}
                onChange={handleChange}
                placeholder="0.00"
                className={cn(inputClass, 'pl-9', errors.limite_credito && 'border-red-400 focus:border-red-400 focus:ring-red-400/20')}
              />
            </div>
            {errors.limite_credito && (
              <p className="mt-1 text-xs text-red-600">{errors.limite_credito}</p>
            )}
          </div>

          {/* Dias de Credito */}
          <div>
            <label htmlFor="dias_credito" className={labelClass}>
              Días de Crédito
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="dias_credito"
                name="dias_credito"
                type="number"
                min="0"
                step="1"
                value={formData.dias_credito}
                onChange={handleChange}
                placeholder="30"
                className={cn(inputClass, 'pl-9', errors.dias_credito && 'border-red-400 focus:border-red-400 focus:ring-red-400/20')}
              />
            </div>
            {errors.dias_credito && (
              <p className="mt-1 text-xs text-red-600">{errors.dias_credito}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <StickyNote className="h-4 w-4 text-blue-600" />
            Notas Adicionales
          </h2>
        </div>
        <div className="p-6">
          <label htmlFor="notas" className={labelClass}>
            Notas
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={4}
            value={formData.notas}
            onChange={handleChange}
            placeholder="Observaciones, instrucciones especiales de entrega, etc."
            className={cn(inputClass, 'resize-none')}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {loading ? 'Guardando...' : isEditing ? 'Actualizar Cliente' : 'Crear Cliente'}
        </button>
      </div>
    </form>
  )
}
