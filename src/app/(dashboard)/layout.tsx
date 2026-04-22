import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import GlobalSearch from '@/components/layout/GlobalSearch'
import StockAlertBanner from '@/components/layout/StockAlertBanner'
import ThemeToggle from '@/components/ui/ThemeToggle'
import KeyboardShortcutsInit from '@/components/ui/KeyboardShortcutsInit'
import NotificationBell from '@/components/layout/NotificationBell'
import CommandPalette from '@/components/ui/CommandPalette'
import { Profile } from '@/lib/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: stockBajo }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('presentaciones')
      .select('id, nombre, stock, productos(nombre)')
      .lt('stock', 5)
      .eq('activo', true)
      .order('stock', { ascending: true })
      .limit(20),
  ])

  const stockAlertas = stockBajo?.length || 0

  // Redirect pending/client users away from the dashboard
  if ((profile as any)?.rol === 'pendiente') {
    redirect('/pendiente')
  }
  if ((profile as any)?.rol === 'cliente') {
    redirect('/tienda')
  }

  return (
    <div className="flex h-screen gradient-mesh overflow-hidden">
      <KeyboardShortcutsInit />
      <CommandPalette />
      <Sidebar profile={profile as Profile | null} stockAlertas={stockAlertas} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with search */}
        <header className="hidden lg:flex h-14 glass-card items-center justify-between px-6 flex-shrink-0 z-10">
          <div />
          <GlobalSearch />
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            {profile && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-bold">
                  {(profile as Profile).nombre?.charAt(0).toUpperCase()}
                </div>
                <div className="text-right hidden xl:block">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-tight">{(profile as Profile).nombre}</p>
                  <p className="text-xs text-slate-400 capitalize">{(profile as Profile).rol}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {/* Mobile search bar */}
          <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 px-4 pt-16 pb-3">
            <GlobalSearch mobile />
          </div>

          {/* Stock alert banner */}
          {stockBajo && stockBajo.length > 0 && (
            <StockAlertBanner items={stockBajo as any[]} />
          )}

          {children}
        </main>
      </div>
    </div>
  )
}
