import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NuevaCompraClient from '../NuevaCompraClient'

export default async function NuevaCompraPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/dashboard')

  const [{ data: presentaciones }, { data: proveedores }] = await Promise.all([
    supabase
      .from('presentaciones')
      .select('id, nombre, costo, stock, productos(nombre)')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('proveedores')
      .select('id, nombre, empresa')
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Registrar compra</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          La compra se guarda en borrador. El inventario se actualiza al marcarla como recibida.
        </p>
      </div>
      <NuevaCompraClient
        presentaciones={(presentaciones ?? []) as any}
        proveedores={proveedores ?? []}
      />
    </div>
  )
}
