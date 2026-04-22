import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserCog } from 'lucide-react'
import EquipoClient from './EquipoClient'
import type { Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function EquipoPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profiles }, { data: currentProfile }] = await Promise.all([
    supabase.from('profiles').select('*').order('nombre'),
    supabase.from('profiles').select('rol').eq('id', user.id).single(),
  ])

  const isAdmin = currentProfile?.rol === 'admin'

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="pt-2 lg:pt-0">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <UserCog className="w-6 h-6 text-teal-600" />
          Equipo
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          {(profiles ?? []).length} miembro{(profiles ?? []).length !== 1 ? 's' : ''} en tu organización
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {!profiles || profiles.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Sin miembros registrados</div>
        ) : (
          <EquipoClient
            initialProfiles={profiles as Profile[]}
            currentUserId={user.id}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </div>
  )
}
