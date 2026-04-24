import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InventarioTable from '@/components/inventario/InventarioTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InventarioPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/dashboard')

  const { data: inventario, error } = await supabase
    .from('inventario')
    .select(`
      id, stock_total, stock_reservado, stock_disponible, precio_venta, precio_costo, updated_at,
      presentacion:presentaciones(id, nombre, unidad, codigo_barras),
      producto:productos(id, codigo, nombre, imagen_url, categoria)
    `)
    .order('updated_at', { ascending: false })

  if (error) {
    // Table likely doesn't exist yet — prompt to run the SQL migration
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center p-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 max-w-lg text-center">
          <p className="font-bold text-amber-800 text-lg mb-2">Tabla de inventario no encontrada</p>
          <p className="text-sm text-amber-700">
            Ejecuta el script <code className="bg-amber-100 px-1 rounded">supabase/inventario.sql</code> en
            el editor SQL de Supabase para crear las tablas de inventario.
          </p>
          <p className="text-xs text-amber-600 mt-3 font-mono">{error.message}</p>
        </div>
      </div>
    )
  }

  const rows = (inventario ?? []) as any[]
  const categorias = [...new Set(rows.map((r) => r.producto?.categoria).filter(Boolean))] as string[]

  // Pull the last movement per presentacion so the table can show "Último movimiento".
  const presentacionIds = rows
    .map((r) => r.presentacion?.id)
    .filter((id): id is string => !!id)

  let lastMov: Record<string, string> = {}
  if (presentacionIds.length > 0) {
    const { data: movs } = await supabase
      .from('inventario_movimientos')
      .select('presentacion_id, created_at')
      .in('presentacion_id', presentacionIds)
      .order('created_at', { ascending: false })

    for (const m of movs ?? []) {
      const pid = (m as any).presentacion_id as string
      if (!lastMov[pid]) lastMov[pid] = (m as any).created_at as string
    }
  }

  const rowsWithLastMov = rows.map((r) => ({
    ...r,
    last_movimiento_at: r.presentacion?.id ? lastMov[r.presentacion.id] ?? null : null,
  }))

  return <InventarioTable inventario={rowsWithLastMov} categorias={categorias} />
}
