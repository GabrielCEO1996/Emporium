import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Producto, Presentacion } from '@/lib/types'
import ProductoDetailClient from './ProductoDetailClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export default async function ProductoDetailPage({ params }: Props) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('productos')
    .select('*, presentaciones(*)')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    notFound()
  }

  const producto = data as Producto & { presentaciones: Presentacion[] }

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center gap-4">
          <Link
            href="/productos"
            className="flex items-center gap-1.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 truncate">{producto.nombre}</h1>
              {!producto.activo && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                  Inactivo
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {producto.categoria ?? 'Sin categoría'} ·{' '}
              {producto.presentaciones?.length ?? 0} presentación{(producto.presentaciones?.length ?? 0) !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-6">
        <ProductoDetailClient producto={producto} />
      </div>
    </div>
  )
}
