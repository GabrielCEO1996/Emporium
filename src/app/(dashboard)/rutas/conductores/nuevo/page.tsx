'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NuevoConductorPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ nombre: '', telefono: '', placa_vehiculo: '', zona: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setLoading(true)
    const { error } = await supabase.from('conductores').insert({ ...form, activo: true })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/rutas')
  }

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="p-6 lg:p-8 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/rutas" className="text-slate-500 hover:text-slate-700"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold text-slate-800">Nuevo Conductor</h1>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        {[
          { label: 'Nombre *', key: 'nombre', placeholder: 'Nombre completo' },
          { label: 'Teléfono', key: 'telefono', placeholder: '0414-000-0000' },
          { label: 'Placa del Vehículo', key: 'placa_vehiculo', placeholder: 'ABC-123' },
          { label: 'Zona de Cobertura', key: 'zona', placeholder: 'Ej: Zona Norte' },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
            <input
              value={(form as any)[key]}
              onChange={e => f(key, e.target.value)}
              placeholder={placeholder}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        ))}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Guardando...' : 'Registrar Conductor'}
        </button>
      </form>
    </div>
  )
}
