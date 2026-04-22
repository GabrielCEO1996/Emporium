import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, FileMinus } from 'lucide-react'

export const dynamic = 'force-dynamic'

const estadoColors: Record<string, string> = {
  emitida: 'bg-teal-100 text-teal-700',
  aplicada: 'bg-green-100 text-green-700',
  anulada: 'bg-red-100 text-red-700',
}

export default async function NotaCreditoDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: nc, error } = await supabase
    .from('notas_credito')
    .select(`*, clientes(*), facturas(id, numero, fecha_emision), nota_credito_items(*)`)
    .eq('id', params.id)
    .single()

  if (error || !nc) notFound()

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/notas-credito" className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{nc.numero}</h1>
          <p className="text-slate-500 text-sm">Nota de Crédito</p>
        </div>
        <span className={`ml-auto text-xs px-3 py-1 rounded-full font-medium ${estadoColors[nc.estado]}`}>
          {nc.estado}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Información</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Factura Referenciada</span>
              <Link href={`/facturas/${nc.facturas?.id}`} className="text-teal-600 hover:underline font-medium">
                {nc.facturas?.numero}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente</span>
              <span className="text-slate-800 font-medium">{nc.clientes?.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tipo</span>
              <span className="text-slate-700 capitalize">{nc.tipo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fecha Emisión</span>
              <span className="text-slate-700">{formatDate(nc.created_at)}</span>
            </div>
            {nc.motivo && (
              <div>
                <span className="text-slate-500">Motivo</span>
                <p className="text-slate-700 mt-1 bg-slate-50 rounded p-2">{nc.motivo}</p>
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Totales</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span>{formatCurrency(nc.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">IVA (16%)</span>
              <span>{formatCurrency(nc.impuesto)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-base">
              <span className="text-slate-700">Total NC</span>
              <span className="text-teal-600">{formatCurrency(nc.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      {nc.nota_credito_items?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Ítems de la Nota</h2>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Descripción</th>
                <th className="text-center px-5 py-3">Cantidad</th>
                <th className="text-right px-5 py-3">Precio Unit.</th>
                <th className="text-right px-5 py-3">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nc.nota_credito_items.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 text-sm text-slate-700">{item.descripcion}</td>
                  <td className="px-5 py-3 text-center text-sm text-slate-600">{item.cantidad}</td>
                  <td className="px-5 py-3 text-right text-sm text-slate-600">{formatCurrency(item.precio_unitario)}</td>
                  <td className="px-5 py-3 text-right text-sm font-medium text-slate-700">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
