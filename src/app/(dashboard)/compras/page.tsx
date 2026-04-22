import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, Plus, Trash2, CalendarDays, Truck } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import EliminarCompraButton from './EliminarCompraButton'

export const dynamic = 'force-dynamic'

export default async function ComprasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/dashboard')

  const { data: compras } = await supabase
    .from('compras')
    .select(`
      id, fecha, total, estado, notas, created_at,
      proveedor:proveedores(id, nombre, empresa),
      items:compra_items(id, cantidad, precio_costo,
        presentacion:presentaciones(id, nombre, productos(nombre))
      )
    `)
    .order('fecha', { ascending: false })
    .limit(100)

  const totalComprado = (compras ?? []).reduce((s, c) => s + (c.total ?? 0), 0)
  const totalItems = (compras ?? []).reduce((s, c) => s + (c.items?.length ?? 0), 0)

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Compras</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {(compras ?? []).length} compras registradas
            </p>
          </div>
        </div>
        <Link
          href="/compras/nueva"
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
        >
          <Plus className="w-4 h-4" /> Nueva compra
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <p className="text-xs text-slate-500 font-medium">Total invertido</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(totalComprado)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <p className="text-xs text-slate-500 font-medium">Compras realizadas</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{(compras ?? []).length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <p className="text-xs text-slate-500 font-medium">Líneas de productos</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalItems}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        {!compras || compras.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBag className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-500">Sin compras registradas</p>
            <Link href="/compras/nueva" className="mt-3 text-teal-600 text-sm hover:underline font-medium">
              Registrar primera compra
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Proveedor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Productos</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="px-5 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {compras.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(c.fecha)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {c.proveedor ? (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <div>
                            <p className="font-medium text-sm">{c.proveedor.nombre}</p>
                            {c.proveedor.empresa && <p className="text-xs text-slate-400">{c.proveedor.empresa}</p>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Sin proveedor</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(c.items ?? []).slice(0, 3).map((item: any) => (
                          <span key={item.id} className="text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full">
                            {item.presentacion?.productos?.nombre ?? '?'} ×{item.cantidad}
                          </span>
                        ))}
                        {(c.items ?? []).length > 3 && (
                          <span className="text-xs text-slate-400">+{(c.items ?? []).length - 3} más</span>
                        )}
                      </div>
                      {c.notas && <p className="text-xs text-slate-400 mt-1 truncate max-w-xs">{c.notas}</p>}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrency(c.total)}
                    </td>
                    <td className="px-5 py-4">
                      <EliminarCompraButton compraId={c.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
