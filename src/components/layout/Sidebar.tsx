'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Package2,
  LayoutDashboard,
  ShoppingCart,
  Users,
  ReceiptText,
  FileMinus,
  History,
  Truck,
  LogOut,
  ChevronLeft,
  Menu,
  PackageSearch,
  X,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Profile } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortLabel?: string
}

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', shortLabel: 'Inicio', icon: LayoutDashboard },
  { href: '/productos', label: 'Productos', icon: PackageSearch },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/facturas', label: 'Facturas', icon: ReceiptText },
  { href: '/notas-credito', label: 'Notas de Crédito', shortLabel: 'N. Crédito', icon: FileMinus },
  { href: '/historial', label: 'Historial', icon: History },
  { href: '/rutas', label: 'Rutas de Entrega', shortLabel: 'Rutas', icon: Truck },
  { href: '/configuracion', label: 'Configuración', shortLabel: 'Config', icon: Settings },
]

// Rutas bloqueadas para vendedores
const adminOnlyHrefs = new Set(['/historial', '/configuracion'])

interface SidebarProps {
  profile: Profile | null
  stockAlertas?: number
}

export default function Sidebar({ profile, stockAlertas = 0 }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isAdmin = profile?.rol === 'admin'
  const navItems = isAdmin ? allNavItems : allNavItems.filter(i => !adminOnlyHrefs.has(i.href))
  const bottomNavItems = navItems.slice(0, 5)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    setMobileOpen(false)
  }

  const NavLink = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
    const isActive = pathname.startsWith(item.href)
    const Icon = item.icon

    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative',
          isActive
            ? 'bg-teal-600 text-white shadow-md shadow-teal-500/30'
            : 'text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-700'
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {item.href === '/productos' && stockAlertas > 0 && (
          <span className={cn(
            'flex-shrink-0 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center',
            isActive ? 'bg-white text-teal-600' : 'bg-red-500 text-white',
            collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'
          )}>
            {stockAlertas > 9 ? '9+' : stockAlertas}
          </span>
        )}
      </Link>
    )
  }

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        'flex items-center px-4 py-5 border-b border-slate-200 dark:border-slate-700',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30">
              <Package2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">Emporium</span>
              <p className="text-slate-500 dark:text-slate-400 text-xs">Distribución</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
            <Package2 className="w-5 h-5 text-white" />
          </div>
        )}
        {/* Desktop collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform duration-300', collapsed && 'rotate-180')} />
        </button>
        {/* Mobile close */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-slate-700 transition p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} onClick={onClose} />
        ))}
      </nav>

      {/* User / Logout */}
      <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
        {!collapsed && profile && (
          <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Sesión activa</p>
            <p className="text-sm text-slate-900 dark:text-white font-semibold truncate">{profile.nombre}</p>
            <p className="text-xs text-teal-600 dark:text-teal-400 capitalize">{profile.rol}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Mobile hamburger button ── */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 bg-teal-600 p-2.5 rounded-xl text-white shadow-lg active:scale-95 transition-transform"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile sidebar (slide-in) ── */}
      <aside
        className={cn(
          'lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transition-transform duration-300 ease-out shadow-2xl',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 flex-shrink-0',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile bottom navigation bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-2 py-1 safe-area-pb">
        {bottomNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-0 flex-1 relative',
                isActive ? 'text-teal-600' : 'text-slate-500'
              )}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {item.href === '/productos' && stockAlertas > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {stockAlertas > 9 ? '9+' : stockAlertas}
                  </span>
                )}
              </div>
              <span className="text-xs truncate w-full text-center">
                {item.shortLabel || item.label}
              </span>
              {isActive && (
                <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-teal-600 rounded-full" />
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
