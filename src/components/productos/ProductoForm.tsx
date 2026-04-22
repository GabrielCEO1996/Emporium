'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Package, AlertCircle, Upload, X as XIcon, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Producto, Presentacion } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

interface PresentacionDraft {
  id?: string
  nombre: string
  precio: string
  costo: string
  stock: string
  stock_minimo: string
  unidad: string
  codigo_barras: string
  activo: boolean
}

interface ProductoFormProps {
  initialData?: Producto & { presentaciones?: Presentacion[] }
  mode: 'crear' | 'editar'
}

const UNIDADES = ['Unidad', 'Caja', 'Paquete', 'Bolsa', 'Litro', 'Kilogramo', 'Gramo', 'Docena', 'Par', 'Otro']
const CATEGORIAS = ['Alimentos', 'Bebidas', 'Limpieza', 'Higiene', 'Papelería', 'Electrónica', 'Ropa', 'Herramientas', 'Otro']

function emptyPresentacion(): PresentacionDraft {
  return {
    nombre: '',
    precio: '',
    costo: '',
    stock: '0',
    stock_minimo: '0',
    unidad: 'Unidad',
    codigo_barras: '',
    activo: true,
  }
}

function toDraft(p: Presentacion): PresentacionDraft {
  return {
    id: p.id,
    nombre: p.nombre,
    precio: p.precio.toString(),
    costo: p.costo.toString(),
    stock: p.stock.toString(),
    stock_minimo: p.stock_minimo.toString(),
    unidad: p.unidad,
    codigo_barras: p.codigo_barras ?? '',
    activo: p.activo,
  }
}

export default function ProductoForm({ initialData, mode }: ProductoFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nombre, setNombre] = useState(initialData?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initialData?.descripcion ?? '')
  const [categoria, setCategoria] = useState(initialData?.categoria ?? '')
  const [activo, setActivo] = useState(initialData?.activo ?? true)
  const [imagenUrl, setImagenUrl] = useState(initialData?.imagen_url ?? '')
  const [presentaciones, setPresentaciones] = useState<PresentacionDraft[]>(
    initialData?.presentaciones?.map(toDraft) ?? [emptyPresentacion()]
  )

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setError('La imagen no puede superar 3 MB'); return }

    setUploadingImg(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error: upErr } = await supabase.storage
        .from('productos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(data.path)
      setImagenUrl(publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir imagen')
    } finally {
      setUploadingImg(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const addPresentacion = () => setPresentaciones(prev => [...prev, emptyPresentacion()])

  const removePresentacion = (index: number) => {
    setPresentaciones(prev => prev.filter((_, i) => i !== index))
  }

  const updatePresentacion = (index: number, field: keyof PresentacionDraft, value: string | boolean) => {
    setPresentaciones(prev =>
      prev.map((p, i) => i === index ? { ...p, [field]: value } : p)
    )
  }

  const validate = (): string | null => {
    if (!nombre.trim()) return 'El nombre del producto es requerido.'
    if (presentaciones.length === 0) return 'Debe agregar al menos una presentación.'
    for (let i = 0; i < presentaciones.length; i++) {
      const p = presentaciones[i]
      if (!p.nombre.trim()) return `La presentación ${i + 1} requiere un nombre.`
      if (!p.precio || isNaN(Number(p.precio)) || Number(p.precio) < 0)
        return `La presentación "${p.nombre || i + 1}" tiene un precio inválido.`
      if (!p.costo || isNaN(Number(p.costo)) || Number(p.costo) < 0)
        return `La presentación "${p.nombre || i + 1}" tiene un costo inválido.`
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)

    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      categoria: categoria || null,
      activo,
      imagen_url: imagenUrl || null,
      presentaciones: presentaciones.map(p => ({
        ...(p.id ? { id: p.id } : {}),
        nombre: p.nombre.trim(),
        precio: parseFloat(p.precio),
        costo: parseFloat(p.costo),
        stock: parseInt(p.stock) || 0,
        stock_minimo: parseInt(p.stock_minimo) || 0,
        unidad: p.unidad,
        codigo_barras: p.codigo_barras.trim() || null,
        activo: p.activo,
      })),
    }

    try {
      const url = mode === 'editar' && initialData
        ? `/api/productos/${initialData.id}`
        : '/api/productos'
      const method = mode === 'editar' ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al guardar el producto')
      }

      router.push('/productos')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Producto info */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
          <Package className="h-5 w-5 text-teal-600" />
          <h2 className="text-base font-semibold text-slate-900">Información del Producto</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Agua Mineral"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Categoría</label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Sin categoría</option>
              {CATEGORIAS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-6">
            <button
              type="button"
              role="switch"
              aria-checked={activo}
              onClick={() => setActivo(v => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2',
                activo ? 'bg-teal-600' : 'bg-slate-300'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  activo ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
            <span className="text-sm font-medium text-slate-700">
              {activo ? 'Producto activo' : 'Producto inactivo'}
            </span>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Descripción</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Descripción opcional del producto..."
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Imagen */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Foto del producto</label>
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden">
                {imagenUrl ? (
                  <img src={imagenUrl} alt="Producto" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingImg}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {uploadingImg
                    ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />Subiendo...</>
                    : <><Upload className="h-4 w-4" />Subir foto</>}
                </button>
                {imagenUrl && (
                  <button
                    type="button"
                    onClick={() => setImagenUrl('')}
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                  >
                    <XIcon className="h-4 w-4" />Quitar foto
                  </button>
                )}
                <p className="text-xs text-slate-400">JPG, PNG, WebP · máx. 3 MB</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Presentaciones */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Presentaciones</h2>
            <p className="text-xs text-slate-500 mt-0.5">Tamaños o variantes del producto con su precio, costo y stock.</p>
          </div>
          <button
            type="button"
            onClick={addPresentacion}
            className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {presentaciones.map((p, idx) => (
            <div key={idx} className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Presentación {idx + 1}
                  {p.id && <span className="ml-2 text-xs font-normal text-slate-400">(existente)</span>}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.activo}
                    onClick={() => updatePresentacion(idx, 'activo', !p.activo)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      p.activo ? 'bg-teal-600' : 'bg-slate-300'
                    )}
                  >
                    <span className={cn(
                      'inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform',
                      p.activo ? 'translate-x-5' : 'translate-x-1'
                    )} />
                  </button>
                  <span className="text-xs text-slate-500">{p.activo ? 'Activa' : 'Inactiva'}</span>
                  {presentaciones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePresentacion(idx)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <div className="col-span-2 sm:col-span-1 lg:col-span-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={p.nombre}
                    onChange={e => updatePresentacion(idx, 'nombre', e.target.value)}
                    placeholder="Ej: 500ml, Caja x12"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Precio (USD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.precio}
                    onChange={e => updatePresentacion(idx, 'precio', e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Costo (USD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.costo}
                    onChange={e => updatePresentacion(idx, 'costo', e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Unidad</label>
                  <select
                    value={p.unidad}
                    onChange={e => updatePresentacion(idx, 'unidad', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    {UNIDADES.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Stock actual</label>
                  <input
                    type="number"
                    min="0"
                    value={p.stock}
                    onChange={e => updatePresentacion(idx, 'stock', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Stock mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={p.stock_minimo}
                    onChange={e => updatePresentacion(idx, 'stock_minimo', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Código de barras</label>
                  <input
                    type="text"
                    value={p.codigo_barras}
                    onChange={e => updatePresentacion(idx, 'codigo_barras', e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {loading && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
          {loading
            ? 'Guardando...'
            : mode === 'crear'
            ? 'Crear Producto'
            : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}
