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
      .select(`
        id, nombre,
        productos(id, codigo, nombre),
        inventario(stock_total, stock_disponible, precio_costo)
      `)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('proveedores')
      .select('id, nombre, empresa')
      .eq('activo', true)
      .order('nombre'),
  ])

  // Flatten nested inventario so the client can use `costo`/`stock` directly.
  const pres = (presentaciones ?? []).map((p: any) => {
    const inv = Array.isArray(p.inventario) ? p.inventario[0] : p.inventario
    return {
      id: p.id,
      nombre: p.nombre,
      codigo: p.productos?.codigo ?? null,
      costo: inv?.precio_costo ?? 0,
      stock: inv?.stock_disponible ?? inv?.stock_total ?? 0,
      productos: p.productos ? { nombre: p.productos.nombre } : null,
    }
  })

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Registrar compra</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          La compra se guarda en borrador. El inventario se actualiza al marcarla como recibida.
        </p>
      </div>
      <NuevaCompraClient
        presentaciones={pres as any}
        proveedores={proveedores ?? []}
      />
    </div>
  )
}
