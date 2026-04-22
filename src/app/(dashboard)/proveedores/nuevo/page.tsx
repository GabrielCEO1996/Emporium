import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProveedorForm from '../ProveedorForm'

export default async function NuevoProveedorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/dashboard')

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nuevo proveedor</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Agrega un proveedor a tu red</p>
      </div>
      <ProveedorForm mode="create" />
    </div>
  )
}
