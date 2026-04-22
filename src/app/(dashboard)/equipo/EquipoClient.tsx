'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Shield, ShoppingBag, Truck, Clock, UserCheck, UserX, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, Rol } from '@/lib/types'

const ROL_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  admin:     { label: 'Admin',     color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', icon: <Shield className="w-3 h-3" /> },
  vendedor:  { label: 'Vendedor',  color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',         icon: <ShoppingBag className="w-3 h-3" /> },
  conductor: { label: 'Conductor', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',     icon: <Truck className="w-3 h-3" /> },
  pendiente: { label: 'Pendiente', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',        icon: <Clock className="w-3 h-3" /> },
  cliente:   { label: 'Cliente',   color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',            icon: <Users className="w-3 h-3" /> },
}

interface Props {
  initialProfiles: Profile[]
  currentUserId: string
  isAdmin: boolean
}

export default function EquipoClient({ initialProfiles, currentUserId, isAdmin }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [saving, setSaving] = useState<string | null>(null)

  const update = async (id: string, patch: { rol?: Rol; activo?: boolean }) => {
    setSaving(id)
    const res = await fetch(`/api/equipo/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
      toast.success('Actualizado')
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Error al actualizar')
    }
    setSaving(null)
  }

  const pendientes = profiles.filter(p => p.rol === 'pendiente')
  const clientes = profiles.filter(p => p.rol === 'cliente')
  const activos = profiles.filter(p => p.rol !== 'pendiente' && p.rol !== 'cliente')

  return (
    <div className="space-y-6">
      {/* ── Pending approval ── */}
      {isAdmin && pendientes.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-amber-200 dark:border-amber-800">
            <Clock className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-sm text-amber-800 dark:text-amber-300">
              Aprobación pendiente
            </h2>
            <span className="ml-1 bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {pendientes.length}
            </span>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-800/50">
            {pendientes.map(p => {
              const busy = saving === p.id
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-sm flex-shrink-0">
                    {p.nombre?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.nombre}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      disabled={busy}
                      onClick={() => update(p.id, { rol: 'vendedor' as Rol, activo: true })}
                      title="Aprobar como vendedor"
                      className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Aprobar
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => update(p.id, { activo: false })}
                      title="Rechazar acceso"
                      className="flex items-center gap-1.5 text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Rechazar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Clientes registrados (solicitudes de acceso pendientes o solo portal) ── */}
      {isAdmin && clientes.length > 0 && (
        <div className="bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-sky-200 dark:border-sky-800">
            <Users className="w-4 h-4 text-sky-600" />
            <h2 className="font-semibold text-sm text-sky-800 dark:text-sky-300">
              Clientes registrados
            </h2>
            <span className="ml-1 bg-sky-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {clientes.length}
            </span>
          </div>
          <div className="divide-y divide-sky-100 dark:divide-sky-800/50">
            {clientes.map(p => {
              const busy = saving === p.id
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-sky-200 dark:bg-sky-800 flex items-center justify-center text-sky-700 dark:text-sky-300 font-bold text-sm flex-shrink-0">
                    {p.nombre?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.nombre}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      disabled={busy}
                      onClick={() => update(p.id, { rol: 'vendedor' as Rol, activo: true })}
                      title="Dar acceso como vendedor"
                      className="flex items-center gap-1.5 text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Dar acceso
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Active team ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-sm text-slate-800 dark:text-white">
            Equipo activo <span className="text-slate-400 font-normal">({activos.length})</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <th className="text-left px-5 py-3">Miembro</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Email</th>
                <th className="text-left px-5 py-3">Rol</th>
                <th className="text-center px-5 py-3">Acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {activos.map(p => {
                const rolCfg = ROL_CONFIG[p.rol] ?? ROL_CONFIG.vendedor
                const isSelf = p.id === currentUserId
                const busy = saving === p.id
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {p.nombre?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.nombre}</p>
                          {isSelf && <p className="text-xs text-teal-500">Tú</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                      {p.email}
                    </td>
                    <td className="px-5 py-3.5">
                      {isAdmin && !isSelf ? (
                        <select
                          value={p.rol}
                          disabled={busy}
                          onChange={e => update(p.id, { rol: e.target.value as Rol })}
                          className="text-xs font-semibold rounded-full px-2.5 py-1 border-0 focus:ring-2 focus:ring-teal-400 cursor-pointer disabled:opacity-50 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          <option value="admin">Admin</option>
                          <option value="vendedor">Vendedor</option>
                          <option value="conductor">Conductor</option>
                          <option value="cliente">Cliente</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${rolCfg.color}`}>
                          {rolCfg.icon}
                          {rolCfg.label}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {isAdmin && !isSelf ? (
                        <button
                          disabled={busy}
                          onClick={() => update(p.id, { activo: !p.activo })}
                          className="disabled:opacity-50 transition"
                          title={p.activo ? 'Revocar acceso' : 'Dar acceso'}
                        >
                          {p.activo
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto hover:text-red-400 transition" />
                            : <XCircle className="w-5 h-5 text-slate-300 mx-auto hover:text-emerald-400 transition" />
                          }
                        </button>
                      ) : (
                        p.activo
                          ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                          : <XCircle className="w-5 h-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
