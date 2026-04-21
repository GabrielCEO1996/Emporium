'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Package2,
  LayoutDashboard,
  ShoppingCart,
  Users,
  FileText,
  ReceiptText,
  FileMinus,
  History,
  Truck,
  LogOut,
  ChevronLeft,
  Menu,
  PackageSearch,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Profile } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/productos', label: 'Productos', icon: PackageSearch },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/facturas', label: 'Facturas', icon: ReceiptText },
  { href: '/notas-credito', label: 'Notas de Crédito', icon: FileMinus },
  { href: '/historial', label: 'Historial', icon: History },
  { href: '/rutas', label: 'Rutas de Entrega', icon: Truck },
]

interface SidebarProps {
  profile: Profile | null
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname.startsWith(item.href)
    const Icon = item.icon

    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn('flex items-center px-4 py-5', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-lg">Emporium</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Package2 className="w-5 h-5 text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex text-slate-400 hover:text-white transition p-1 rounded"
        >
          <ChevronLeft className={cn('w-5 h-5 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* User / Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        {!collapsed && profile && (
          <div className="mb-3 px-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sesión</p>
            <p className="text-sm text-white font-medium truncate">{profile.nombre}</p>
            <p className="text-xs text-slate-400 capitalize">{profile.rol}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 bg-slate-800 p-2 rounded-lg text-white shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-slate-900 border-r border-white/10 transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-slate-900 border-r border-white/10 transition-all duration-300 flex-shrink-0',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
