"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-md">
        <h1 className="text-white text-2xl font-bold mb-6">Nueva contraseña</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" placeholder="Nueva contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-700 text-white p-3 rounded-xl" required />
          <input type="password" placeholder="Confirmar contraseña" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full bg-gray-700 text-white p-3 rounded-xl" required />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold">
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
