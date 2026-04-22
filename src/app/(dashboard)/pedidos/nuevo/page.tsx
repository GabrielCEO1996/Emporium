'use client'

import Link from 'next/link'
import { ShoppingCart, ChevronRight } from 'lucide-react'
import NuevoPedidoForm from '@/components/pedidos/NuevoPedidoForm'
import { Suspense } from 'react'

export default function NuevoPedidoPage() {
  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link
            href="/pedidos"
            className="flex items-center gap-1.5 hover:text-teal-600 transition-colors"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Pedidos
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900 font-medium">Nuevo Pedido</span>
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Crear Nuevo Pedido</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Seleccione un cliente, agregue productos y confirme el pedido.
        </p>
      </div>

      <div className="p-6 max-w-5xl">
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        }>
          <NuevoPedidoForm />
        </Suspense>
      </div>
    </div>
  )
}
