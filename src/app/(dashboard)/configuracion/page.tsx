import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import EmpresaConfigForm from '@/components/configuracion/EmpresaConfigForm'
import { Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: empresaConfig }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('empresa_config').select('*').limit(1).maybeSingle(),
  ])

  const isAdmin = (profile as Profile | null)?.rol === 'admin'

  return (
    <div className="min-h-full bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Perfil de la empresa y datos para facturas
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-6">
        <EmpresaConfigForm initial={empresaConfig ?? {}} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
