import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ProveedorForm from '../../ProveedorForm'

interface Props { params: { id: string } }

export default async function EditarProveedorPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/dashboard')

  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!proveedor) notFound()

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Editar proveedor</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{proveedor.nombre}</p>
      </div>
      <ProveedorForm mode="edit" initial={proveedor} />
    </div>
  )
}
