import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Producto } from '@/lib/types'
import ProductosGrid from './ProductosGrid'

export const dynamic = 'force-dynamic'

export default async function ProductosPage() {
  const supabase = createClient()

  // Catalog + presentaciones + inventario (stock + pricing).
  const { data: productos, error } = await supabase
    .from('productos')
    .select(`
      id, codigo, nombre, descripcion, categoria, imagen_url, activo, created_at, updated_at,
      presentaciones(
        id, nombre, unidad, codigo_barras, stock_minimo, activo,
        inventario(stock_total, stock_reservado, stock_disponible, precio_venta, precio_costo)
      )
    `)
    .order('nombre')

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-red-600">Error al cargar productos: {error.message}</p>
      </div>
    )
  }

  const typedProductos = (productos ?? []) as (Producto & { presentaciones: NonNullable<Producto['presentaciones']> })[]

  // Stock aggregates pulled from inventario joined under each presentacion.
  const totalStock = (p: Producto) =>
    (p.presentaciones ?? []).reduce((sum, pr) => {
      const inv = Array.isArray(pr.inventario) ? pr.inventario[0] : pr.inventario
      return sum + (inv?.stock_disponible ?? inv?.stock_total ?? 0)
    }, 0)

  const stockBajo = (p: Producto) =>
    (p.presentaciones ?? []).some((pr) => {
      const inv = Array.isArray(pr.inventario) ? pr.inventario[0] : pr.inventario
      const disp = inv?.stock_disponible ?? inv?.stock_total ?? 0
      return disp > 0 && disp <= (pr.stock_minimo ?? 0)
    })

  const sinStock = typedProductos.filter((p) => totalStock(p) === 0).length
  const bajoStock = typedProductos.filter(stockBajo).length

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Catálogo de productos — el stock y los precios se gestionan desde{' '}
              <Link href="/inventario" className="text-teal-600 hover:underline">Inventario</Link>.
            </p>
          </div>
          <Link
            href="/productos/nuevo"
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
        <StatCard label="Total Productos" value={typedProductos.length.toString()} color="blue" />
        <StatCard label="Activos"         value={typedProductos.filter(p => p.activo).length.toString()} color="green" />
        <StatCard label="Sin Stock"       value={sinStock.toString()} color="red" />
        <StatCard label="Stock Bajo"      value={bajoStock.toString()} color="yellow" />
      </div>

      {/* Table / Grid */}
      <div className="px-6 pb-8">
        <ProductosGrid productos={typedProductos} />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'blue' | 'green' | 'red' | 'yellow' }) {
  const colors = {
    blue: 'bg-teal-50 text-teal-700 border-teal-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
