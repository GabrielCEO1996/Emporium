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
        productos(id, codigo, nombre, tiene_vencimiento),
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
  // Sum stock across lots (for products with tiene_vencimiento the inventario join returns multiple rows).
  const pres = (presentaciones ?? []).map((p: any) => {
    const invRows: any[] = Array.isArray(p.inventario) ? p.inventario : p.inventario ? [p.inventario] : []
    const stock = invRows.reduce((s, r) => s + (r.stock_disponible ?? r.stock_total ?? 0), 0)
    // Last known precio_costo (any row with a non-zero cost wins; fallback to first row).
    const costoRow = invRows.find(r => (r.precio_costo ?? 0) > 0) ?? invRows[0]
    return {
      id: p.id,
      nombre: p.nombre,
      codigo: p.productos?.codigo ?? null,
      costo: costoRow?.precio_costo ?? 0,
      stock,
      producto_id: p.productos?.id ?? null,
      tiene_vencimiento: Boolean(p.productos?.tiene_vencimiento),
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
