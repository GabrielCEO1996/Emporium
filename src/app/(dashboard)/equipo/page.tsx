'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserCog, Shield, ShoppingBag, Truck, CheckCircle2, XCircle } from 'lucide-react'
import AnimatedPage from '@/components/ui/AnimatedPage'
import { toast } from 'sonner'
import type { Profile, Rol } from '@/lib/types'

const ROL_CONFIG: Record<Rol, { label: string; color: string; icon: React.ReactNode }> = {
  admin:     { label: 'Admin',     color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',  icon: <Shield className="w-3 h-3" /> },
  vendedor:  { label: 'Vendedor',  color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',          icon: <ShoppingBag className="w-3 h-3" /> },
  conductor: { label: 'Conductor', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',      icon: <Truck className="w-3 h-3" /> },
}

export default function EquipoPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: all }, { data: me }] = await Promise.all([
        supabase.from('profiles').select('*').order('nombre'),
        user ? supabase.from('profiles').select('*').eq('id', user.id).single() : Promise.resolve({ data: null }),
      ])
      setProfiles(all ?? [])
      setCurrentUser(me)
      setLoading(false)
    }
    init()
  }, [])

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

  const isAdmin = currentUser?.rol === 'admin'

  return (
    <AnimatedPage className="p-4 lg:p-8 space-y-6">
      <div className="pt-2 lg:pt-0">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <UserCog className="w-6 h-6 text-teal-600" />
          Equipo
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          {profiles.length} miembro{profiles.length !== 1 ? 's' : ''} en tu organización
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Cargando...</div>
        ) : profiles.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Sin miembros registrados</div>
        ) : (
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
                {profiles.map(p => {
                  const rolCfg = ROL_CONFIG[p.rol]
                  const isSelf = p.id === currentUser?.id
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
        )}
      </div>
    </AnimatedPage>
  )
}
