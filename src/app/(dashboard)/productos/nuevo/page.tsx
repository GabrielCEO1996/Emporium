import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import ProductoForm from '@/components/productos/ProductoForm'

export default function NuevoProductoPage() {
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
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nuevo Producto</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Completa la información y agrega las presentaciones disponibles.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-6">
        <ProductoForm mode="crear" />
      </div>
    </div>
  )
}
