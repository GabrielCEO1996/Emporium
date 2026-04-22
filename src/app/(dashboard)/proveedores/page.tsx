import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Truck } from 'lucide-react'
import ProveedoresClient from './ProveedoresClient'

export default async function ProveedoresPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (currentProfile?.rol !== 'admin') redirect('/dashboard')

  const { data: proveedores } = await supabase
    .from('proveedores')
    .select('*')
    .eq('activo', true)
    .order('nombre')

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Proveedores</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {proveedores?.length ?? 0} proveedor{(proveedores?.length ?? 0) !== 1 ? 'es' : ''} activo{(proveedores?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <ProveedoresClient initialData={proveedores ?? []} />
    </div>
  )
}
