import Link from 'next/link'
import ClienteForm from '@/components/clientes/ClienteForm'
import { Users, ChevronRight } from 'lucide-react'

export default function NuevoClientePage() {
  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href="/clientes" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
            <Users className="h-3.5 w-3.5" />
            Clientes
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900 font-medium">Nuevo Cliente</span>
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Crear Nuevo Cliente</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Complete los datos para registrar un nuevo cliente en el sistema.
        </p>
      </div>

      <div className="p-6 max-w-4xl">
        <ClienteForm />
      </div>
    </div>
  )
}
