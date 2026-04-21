import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ClienteForm from '@/components/clientes/ClienteForm'
import { Users, ChevronRight } from 'lucide-react'

interface PageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export default async function EditarClientePage({ params }: PageProps) {
  const supabase = createClient()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !cliente) {
    notFound()
  }

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
          <Link
            href={`/clientes/${params.id}`}
            className="hover:text-blue-600 transition-colors font-medium text-slate-700 truncate max-w-xs"
          >
            {cliente.nombre}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900 font-medium">Editar</span>
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Editar Cliente</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Modifique los datos del cliente y guarde los cambios.
        </p>
      </div>

      <div className="p-6 max-w-4xl">
        <ClienteForm cliente={cliente} isEditing />
      </div>
    </div>
  )
}
