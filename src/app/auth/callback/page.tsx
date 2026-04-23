"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleCallback = async () => {
      const hash = window.location.hash
      if (hash.includes('type=recovery')) {
        router.push('/auth/reset-password')
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', session.user.id).single()
      const rol = profile?.rol
      if (rol === 'admin' || rol === 'vendedor') router.push('/dashboard')
      else router.push('/tienda')
    }
    handleCallback()
  }, [])

  return <div className="min-h-screen flex items-center justify-center bg-gray-900"><p className="text-white text-xl">Iniciando sesión...</p></div>
}
