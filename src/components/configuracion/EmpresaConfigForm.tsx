'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Building2, FileText, MapPin, Phone, Mail, MessageSquare,
  Save, Loader2, Upload, X, CheckCircle, Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmpresaConfig {
  id?: string
  nombre?: string
  rif?: string
  direccion?: string
  telefono?: string
  email?: string
  logo_url?: string
  mensaje_factura?: string
}

interface Props {
  initial: EmpresaConfig
  isAdmin: boolean
}

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-colors disabled:bg-slate-50 disabled:text-slate-500'
const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

export default function EmpresaConfigForm({ initial, isAdmin }: Props) {
  const [form, setForm] = useState<EmpresaConfig>(initial)
  const [loading, setLoading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const set = (key: keyof EmpresaConfig, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('La imagen no puede superar 2 MB'); return }

    setUploadingLogo(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()
      const path = `logo-${Date.now()}.${ext}`
      const { data, error: uploadError } = await supabase.storage
        .from('empresa')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('empresa').getPublicUrl(data.path)
      setForm(prev => ({ ...prev, logo_url: publicUrl }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir imagen')
    } finally {
      setUploadingLogo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    setLoading(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/empresa-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      setForm(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <X className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Configuración guardada correctamente
        </div>
      )}

      {/* Logo */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <ImageIcon className="h-4 w-4 text-teal-600" />
            Logo de la Empresa
          </h2>
        </div>
        <div className="p-6 flex items-start gap-6">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-10 w-10 text-slate-300" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-600 mb-3">
              Sube el logo de tu empresa (JPG, PNG, WebP · máx. 2 MB). Se usará en los PDF de facturas.
            </p>
            <div className="flex gap-3">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!isAdmin || uploadingLogo}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadingLogo ? 'Subiendo...' : 'Subir logo'}
              </button>
              {form.logo_url && isAdmin && (
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, logo_url: '' }))}
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Quitar
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Datos de la empresa */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Building2 className="h-4 w-4 text-teal-600" />
            Datos de la Empresa
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nombre de la empresa</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={form.nombre ?? ''}
                onChange={e => set('nombre', e.target.value)}
                disabled={!isAdmin}
                placeholder="Mi Empresa S.A."
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>RIF</label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={form.rif ?? ''}
                onChange={e => set('rif', e.target.value)}
                disabled={!isAdmin}
                placeholder="J-12345678-9"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Teléfono</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                value={form.telefono ?? ''}
                onChange={e => set('telefono', e.target.value)}
                disabled={!isAdmin}
                placeholder="+58 212 000 0000"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={form.email ?? ''}
                onChange={e => set('email', e.target.value)}
                disabled={!isAdmin}
                placeholder="contacto@empresa.com"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Dirección</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={form.direccion ?? ''}
                onChange={e => set('direccion', e.target.value)}
                disabled={!isAdmin}
                placeholder="Av. Principal, Edificio X, Piso 2"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Mensaje de pie de factura</label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={form.mensaje_factura ?? ''}
                onChange={e => set('mensaje_factura', e.target.value)}
                disabled={!isAdmin}
                placeholder="Gracias por su compra"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
          </div>
        </div>
      </section>

      {isAdmin && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {loading ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      )}

      {!isAdmin && (
        <p className="text-center text-sm text-slate-400">
          Solo los administradores pueden editar la configuración de la empresa.
        </p>
      )}
    </form>
  )
}
