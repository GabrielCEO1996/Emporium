import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wallet, Plus, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import GastosClient from './GastosClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function GastosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/dashboard')

  const { data: gastos, error } = await supabase
    .from('gastos_operativos')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(200)

  const totalMes = (() => {
    if (!gastos) return 0
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = now.getMonth()
    return gastos
      .filter((g: any) => {
        const d = new Date(g.fecha)
        return d.getFullYear() === yyyy && d.getMonth() === mm
      })
      .reduce((s: number, g: any) => s + Number(g.monto ?? 0), 0)
  })()

  const totalAnio = (() => {
    if (!gastos) return 0
    const yyyy = new Date().getFullYear()
    return gastos
      .filter((g: any) => new Date(g.fecha).getFullYear() === yyyy)
      .reduce((s: number, g: any) => s + Number(g.monto ?? 0), 0)
  })()

  const totalTodos = (gastos ?? []).reduce((s: number, g: any) => s + Number(g.monto ?? 0), 0)

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gastos operativos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Egresos de operación — sueldos, servicios, marketing, etc.
              <span className="block text-xs text-slate-400">
                No incluye compras de inventario (esas son costos).
              </span>
            </p>
          </div>
        </div>
        <Link
          href="/gastos/nuevo"
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
        >
          <Plus className="w-4 h-4" /> Nuevo gasto
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Error al cargar gastos: {error.message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <p className="text-xs text-slate-500 font-medium">Gasto operativo del mes</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(totalMes)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Mes en curso</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <p className="text-xs text-slate-500 font-medium">Gasto operativo del año</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(totalAnio)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Acumulado año en curso</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <p className="text-xs text-slate-500 font-medium">Registros totales</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{(gastos ?? []).length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Total acumulado: {formatCurrency(totalTodos)}</p>
        </div>
      </div>

      <GastosClient gastos={(gastos ?? []) as any[]} />
    </div>
  )
}
