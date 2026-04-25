import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Inbox, Clock, CheckCircle2, XCircle } from 'lucide-react'
import OrdenesClient from './OrdenesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  searchParams: { estado?: string }
}

export default async function OrdenesPage({ searchParams }: PageProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()

  const rol = profile?.rol
  if (rol !== 'admin' && rol !== 'vendedor') redirect('/dashboard')
  const isAdmin = rol === 'admin'

  const estadoFilter = searchParams.estado || 'pendiente'

  // Try with the new payment_proof_url + checkout_v2 columns first; fall back
  // to the old shape if the migration hasn't been applied yet. Two flags:
  //   • includeProof      → payment_proof_url (payment_proofs.sql)
  //   • includeV2Cols     → estado_pago, verificado_por, verificado_at (checkout_v2.sql)
  const buildQuery = (includeProof: boolean, includeV2Cols: boolean) => {
    const v2Cols = includeV2Cols ? ', estado_pago, verificado_por, verificado_at' : ''
    const selectCols = `
      id, numero, estado, total, notas, direccion_entrega,
      motivo_rechazo, created_at, updated_at, cliente_id,
      tipo_pago, numero_referencia, pago_confirmado${includeProof ? ', payment_proof_url' : ''}${v2Cols},
      cliente:clientes(id, nombre, rif, email, telefono),
      items:orden_items(
        id, cantidad, precio_unitario, subtotal,
        presentacion:presentaciones(id, nombre, producto:productos(id, nombre))
      ),
      pedido:pedidos!pedidos_orden_id_fkey(id, numero, estado)
    `
    let q = supabase.from('ordenes').select(selectCols).order('created_at', { ascending: false })
    if (estadoFilter && estadoFilter !== 'todas') q = q.eq('estado', estadoFilter)
    return q
  }

  // Cascade retries — each attempt drops a different set of optional columns
  // so we never get stuck when the error surfaces in a different order than
  // our regex expects. Try richest → leanest.
  let ordenesRes = await buildQuery(true, true)
  if (ordenesRes.error) {
    console.warn('[ordenes/page] full query failed:', ordenesRes.error.message)
    ordenesRes = await buildQuery(false, true)   // drop proof col
  }
  if (ordenesRes.error) {
    console.warn('[ordenes/page] (no-proof) failed:', ordenesRes.error.message)
    ordenesRes = await buildQuery(true, false)   // drop v2 cols
  }
  if (ordenesRes.error) {
    console.warn('[ordenes/page] (no-v2) failed:', ordenesRes.error.message)
    ordenesRes = await buildQuery(false, false)  // drop both
  }
  if (ordenesRes.error) {
    console.error('[ordenes/page] list query failed after all retries:', ordenesRes.error)
  }
  const ordenes = ordenesRes.data

  // Filtered counts — use COUNT queries with the same estado filter so the
  // tab badges and the list can never disagree (previously the count query
  // pulled ALL rows with no join, while the list used nested joins which
  // could silently drop rows — producing "Aprobadas: 1" + empty list).
  const [
    { count: pendientes },
    { count: aprobadas },
    { count: rechazadas },
    { count: totalCount },
  ] = await Promise.all([
    supabase.from('ordenes').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    supabase.from('ordenes').select('id', { count: 'exact', head: true }).eq('estado', 'aprobada'),
    supabase.from('ordenes').select('id', { count: 'exact', head: true }).eq('estado', 'rechazada'),
    supabase.from('ordenes').select('id', { count: 'exact', head: true }),
  ])

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Inbox className="w-6 h-6 text-teal-600" />
            Órdenes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Solicitudes de clientes desde la tienda, pendientes de aprobación.
          </p>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 text-sm">
        <TabLink href="/ordenes?estado=pendiente"  active={estadoFilter === 'pendiente'}
          icon={<Clock className="w-3.5 h-3.5" />} label="Pendientes" count={pendientes ?? 0} tone="amber" />
        <TabLink href="/ordenes?estado=aprobada"   active={estadoFilter === 'aprobada'}
          icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Aprobadas" count={aprobadas ?? 0} tone="emerald" />
        <TabLink href="/ordenes?estado=rechazada"  active={estadoFilter === 'rechazada'}
          icon={<XCircle className="w-3.5 h-3.5" />} label="Rechazadas" count={rechazadas ?? 0} tone="rose" />
        <TabLink href="/ordenes?estado=todas"      active={estadoFilter === 'todas'}
          icon={null} label="Todas" count={totalCount ?? 0} tone="slate" />
      </div>

      <OrdenesClient
        ordenes={(ordenes ?? []) as any[]}
        isAdmin={isAdmin}
      />
    </div>
  )
}

function TabLink({
  href, active, icon, label, count, tone,
}: {
  href: string; active: boolean; icon: React.ReactNode; label: string; count: number;
  tone: 'amber' | 'emerald' | 'rose' | 'slate'
}) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    rose: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30',
  }
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium transition
        ${active ? tones[tone] : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
    >
      {icon}
      {label}
      <span className={`ml-1 text-xs font-bold ${active ? 'opacity-80' : 'text-slate-400'}`}>
        {count}
      </span>
    </a>
  )
}
