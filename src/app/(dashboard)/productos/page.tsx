import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Producto } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import ProductosTable from './ProductosTable'

export const dynamic = 'force-dynamic'

export default async function ProductosPage() {
  const supabase = createClient()

  const { data: productos, error } = await supabase
    .from('productos')
    .select('*, presentaciones(*)')
    .order('nombre')

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-red-600">Error al cargar productos: {error.message}</p>
      </div>
    )
  }

  const typedProductos = (productos ?? []) as (Producto & { presentaciones: NonNullable<Producto['presentaciones']> })[]

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {typedProductos.length} producto{typedProductos.length !== 1 ? 's' : ''} registrado{typedProductos.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/productos/nuevo"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
        <StatCard
          label="Total Productos"
          value={typedProductos.length.toString()}
          color="blue"
        />
        <StatCard
          label="Activos"
          value={typedProductos.filter(p => p.activo).length.toString()}
          color="green"
        />
        <StatCard
          label="Sin Stock"
          value={typedProductos
            .filter(p => p.presentaciones?.every(pr => pr.stock === 0))
            .length.toString()}
          color="red"
        />
        <StatCard
          label="Stock Bajo"
          value={typedProductos
            .filter(p =>
              p.presentaciones?.some(
                pr => pr.stock > 0 && pr.stock <= pr.stock_minimo
              )
            )
            .length.toString()}
          color="yellow"
        />
      </div>

      {/* Table */}
      <div className="px-6 pb-8">
        <ProductosTable productos={typedProductos} />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'blue' | 'green' | 'red' | 'yellow' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
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
