'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Clock, LogOut, RefreshCw } from 'lucide-react'

export default function PendientePage() {
  const supabase = createClient()
  const router = useRouter()
  const [checking, setChecking] = useState(false)
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    // Load user name
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('profiles').select('nombre, rol').eq('id', user.id).single()
        .then(({ data }) => {
          if (!data) return
          setNombre(data.nombre ?? '')
          // If already approved, redirect to dashboard
          if (data.rol && data.rol !== 'pendiente') {
            router.push('/dashboard')
          }
        })
    })
  }, [])

  const checkStatus = async () => {
    setChecking(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    if (data?.rol && data.rol !== 'pendiente') {
      router.push('/dashboard')
    } else {
      setChecking(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-700">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Clock className="w-10 h-10 text-amber-500" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Cuenta pendiente de aprobación
        </h1>
        {nombre && (
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Hola, <span className="font-semibold text-slate-700 dark:text-slate-200">{nombre}</span></p>
        )}
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
          Tu cuenta fue creada correctamente. Un administrador revisará tu solicitud y te asignará el rol correspondiente. Recibirás acceso en breve.
        </p>

        <div className="space-y-3">
          <button
            onClick={checkStatus}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Verificando...' : 'Verificar estado'}
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium py-2.5 px-4 rounded-xl transition-all text-sm"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-6">
          ¿Problemas? Contacta al administrador del sistema.
        </p>
      </div>
    </div>
  )
}
