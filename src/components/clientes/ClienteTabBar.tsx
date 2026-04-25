'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  User,
  ShoppingCart,
  CreditCard,
  History,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'

/**
 * Icon registry — keeps the actual component references on the client
 * side. We MUST NOT accept a raw component reference as a prop from a
 * server component because functions can't be serialized across the RSC
 * boundary (manifests as React error #419 / "An error occurred in the
 * Server Components render").
 *
 * Server callers pass `iconName: 'user' | 'shoppingCart' | ...` instead.
 */
const ICONS: Record<string, LucideIcon> = {
  user: User,
  shoppingCart: ShoppingCart,
  creditCard: CreditCard,
  history: History,
  stickyNote: StickyNote,
}

export type TabIconName = keyof typeof ICONS

export interface TabDef {
  id: string
  label: string
  iconName: TabIconName
  count?: number
  tone?: 'default' | 'danger' | 'violet' | 'amber'
}

/**
 * Client-side tab navigator that preserves the current URL and swaps
 * `?tab=<id>`. Keeps the host page a server component — the active tab
 * is read from searchParams on the server. Each tab is a <Link>, so
 * browser back/forward work and copy-paste URLs round-trip correctly.
 */
export default function ClienteTabBar({
  tabs,
  activeTab,
}: {
  tabs: TabDef[]
  activeTab: string
}) {
  const pathname = usePathname()
  const search = useSearchParams()

  const buildHref = (id: string) => {
    const params = new URLSearchParams(search?.toString() ?? '')
    params.set('tab', id)
    return `${pathname}?${params.toString()}`
  }

  return (
    <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
      <nav
        className="-mb-px flex gap-1 overflow-x-auto px-3 sm:px-6 scrollbar-hide"
        aria-label="Tabs"
      >
        {tabs.map((t) => {
          const active = t.id === activeTab
          const Icon = ICONS[t.iconName] ?? User
          const badgeCls =
            t.tone === 'danger'  ? 'bg-red-100 text-red-700' :
            t.tone === 'violet'  ? 'bg-violet-100 text-violet-700' :
            t.tone === 'amber'   ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-600'
          return (
            <Link
              key={t.id}
              href={buildHref(t.id)}
              scroll={false}
              className={cn(
                'group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-3 text-sm font-medium transition-colors',
                active
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-500')} />
              <span>{t.label}</span>
              {typeof t.count === 'number' && t.count > 0 && (
                <span className={cn('ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold', badgeCls)}>
                  {t.count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
