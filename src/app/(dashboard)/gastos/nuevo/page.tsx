import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Wallet } from 'lucide-react'
import NuevoGastoForm from './NuevoGastoForm'

export const dynamic = 'force-dynamic'

export default async function NuevoGastoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/dashboard')

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-6">
      <Link
        href="/gastos"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a Gastos
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nuevo gasto operativo</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Registro de egreso — se añadirá al libro contable.
          </p>
        </div>
      </div>

      <NuevoGastoForm />
    </div>
  )
}
