import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Suspense } from 'react'
import { Cliente } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import ClientesFilterBar from '@/components/clientes/ClientesFilterBar'
import {
  Users,
  Plus,
  Search,
  ChevronRight,
  UserCheck,
  UserX,
  Building2,
  Phone,
  FileText,
  ShoppingCart,
} from 'lucide-react'

interface PageProps {
  searchParams: { search?: string; activo?: string }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function escapeOrValue(v: string): string {
  // Supabase .or() strings use commas as OR separators — escape any commas
  // in the user input so ',' inside the term doesn't split the expression.
  // We also strip % which would be treated as a wildcard out of the user's
  // control.
  return v.replace(/[,%]/g, ' ').trim()
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const rawSearch = (searchParams.search ?? '').trim()
  const activoFilter = searchParams.activo ?? ''

  // We count the full catalog once for the "X de Y" counter.
  const totalCountQ = await supabase
    .from('clientes')
    .select('id', { count: 'exact', head: true })
  const totalClientes = totalCountQ.count ?? 0

  let query = supabase
    .from('clientes')
    .select('*')
    .order('nombre', { ascending: true })
    .limit(1000)

  if (rawSearch) {
    const s = escapeOrValue(rawSearch)
    if (s) {
      // Searches across nombre / rif / email / telefono / ciudad — PostgREST
      // `.or()` uses commas to separate the conditions.
      query = query.or(
        `nombre.ilike.%${s}%,rif.ilike.%${s}%,ciudad.ilike.%${s}%,email.ilike.%${s}%,telefono.ilike.%${s}%`
      )
    }
  }

  if (activoFilter === 'true') {
    query = query.eq('activo', true)
  } else if (activoFilter === 'false') {
    query = query.eq('activo', false)
  }

  const { data: clientes, error } = await query

  const totalActivos = clientes?.filter((c) => c.activo).length ?? 0
  const totalInactivos = clientes?.filter((c) => !c.activo).length ?? 0
  const showing = clientes?.length ?? 0

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Clientes</h1>
              <p className="text-sm text-slate-500">
                Gestión de cartera de clientes
              </p>
            </div>
          </div>
          <Link
            href="/clientes/nuevo"
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Clientes</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{clientes?.length ?? 0}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50">
                <Users className="h-5 w-5 text-teal-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Activos</p>
                <p className="mt-1 text-2xl font-bold text-green-700">{totalActivos}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Inactivos</p>
                <p className="mt-1 text-2xl font-bold text-slate-500">{totalInactivos}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <UserX className="h-5 w-5 text-slate-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters — debounced client component, URL-persisted */}
        <Suspense fallback={<div className="h-10" />}>
          <ClientesFilterBar
            initialSearch={rawSearch}
            initialActivo={activoFilter}
            showing={showing}
            total={totalClientes}
          />
        </Suspense>

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Error al cargar los clientes: {error.message}
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {!clientes || clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Users className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="mt-4 text-base font-medium text-slate-900">
                {rawSearch
                  ? `No se encontraron clientes con "${rawSearch}"`
                  : activoFilter
                  ? 'Sin resultados con el filtro actual'
                  : 'No hay clientes'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {rawSearch
                  ? 'Prueba con otro término o limpia los filtros.'
                  : activoFilter
                  ? `Estás filtrando por estado "${activoFilter === 'true' ? 'activo' : 'inactivo'}".`
                  : 'Comience agregando su primer cliente.'}
              </p>
              {(rawSearch || activoFilter) && (
                <Link
                  href="/clientes"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  Limpiar filtros
                </Link>
              )}
              {!rawSearch && !activoFilter && (
                <Link
                  href="/clientes/nuevo"
                  className="mt-5 flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Cliente
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Cliente
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        RIF
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Teléfono
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Ciudad
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Límite Crédito
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Estado
                      </th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientes.map((cliente: Cliente) => (
                      <tr
                        key={cliente.id}
                        className="group transition-colors hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-slate-900">{cliente.nombre}</p>
                              {(cliente as any).user_id && (
                                <span
                                  title="Este cliente se registró desde la app"
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20"
                                >
                                  App User 📱
                                </span>
                              )}
                            </div>
                            {cliente.email && (
                              <p className="text-xs text-slate-500">{cliente.email}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {cliente.rif ? (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              {cliente.rif}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {cliente.telefono ? (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {cliente.telefono}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {cliente.ciudad ? (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              {cliente.ciudad}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {formatCurrency(cliente.limite_credito ?? 0)}
                        </td>
                        <td className="px-5 py-4">
                          {cliente.activo ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/pedidos/nuevo?cliente=${cliente.id}`}
                              title="Crear pedido para este cliente"
                              className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
                            >
                              <ShoppingCart className="h-3 w-3" />
                              Pedido
                            </Link>
                            <Link
                              href={`/clientes/${cliente.id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              Ver
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="divide-y divide-slate-100 md:hidden">
                {clientes.map((cliente: Cliente) => (
                  <Link
                    key={cliente.id}
                    href={`/clientes/${cliente.id}`}
                    className="flex items-start justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900 truncate">{cliente.nombre}</p>
                        {(cliente as any).user_id && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                            App User 📱
                          </span>
                        )}
                        {cliente.activo ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Inactivo
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                        {cliente.rif && <span>{cliente.rif}</span>}
                        {cliente.telefono && <span>{cliente.telefono}</span>}
                        {cliente.ciudad && <span>{cliente.ciudad}</span>}
                      </div>
                    </div>
                    <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                  </Link>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                <p className="text-xs text-slate-500">
                  {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} encontrado{clientes.length !== 1 ? 's' : ''}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
