import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { FileMinus, Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

const estadoColors: Record<string, string> = {
  emitida: 'bg-teal-100 text-teal-700',
  aplicada: 'bg-green-100 text-green-700',
  anulada: 'bg-red-100 text-red-700',
}

const tipoLabels: Record<string, string> = {
  devolucion: 'Devolución',
  descuento: 'Descuento',
  ajuste: 'Ajuste',
}

export default async function NotasCreditoPage() {
  const supabase = createClient()

  const { data: notas } = await supabase
    .from('notas_credito')
    .select(`*, clientes(nombre), facturas(numero)`)
    .order('created_at', { ascending: false })

  const totalEmitidas = notas?.filter(n => n.estado === 'emitida').reduce((a, n) => a + n.total, 0) || 0

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notas de Crédito</h1>
          <p className="text-slate-500 text-sm mt-1">Devoluciones y ajustes a facturas</p>
        </div>
        <Link
          href="/notas-credito/nueva"
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Nota
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Notas', value: notas?.length || 0 },
          { label: 'Emitidas', value: notas?.filter(n => n.estado === 'emitida').length || 0 },
          { label: 'Monto Emitido', value: formatCurrency(totalEmitidas) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <p className="text-2xl font-bold text-slate-800">{s.value}</p>
            <p className="text-sm text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Número</th>
                <th className="text-left px-5 py-3">Factura Ref.</th>
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-5 py-3">Tipo</th>
                <th className="text-left px-5 py-3">Fecha</th>
                <th className="text-left px-5 py-3">Estado</th>
                <th className="text-right px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notas && notas.length > 0 ? (
                notas.map((nc: any) => (
                  <tr key={nc.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <Link href={`/notas-credito/${nc.id}`} className="font-medium text-teal-600 hover:underline text-sm">
                        {nc.numero}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{nc.facturas?.numero || '-'}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{nc.clientes?.nombre}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                        {tipoLabels[nc.tipo] || nc.tipo}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(nc.created_at)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${estadoColors[nc.estado] || 'bg-gray-100 text-gray-600'}`}>
                        {nc.estado}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-700 text-sm">
                      {formatCurrency(nc.total)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <FileMinus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No hay notas de crédito</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
