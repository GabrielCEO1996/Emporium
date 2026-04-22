'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Search, FileText, Users, ShoppingCart, Package,
  ArrowRight, Loader2, LayoutDashboard, BarChart2,
  Settings, ReceiptText, Hash, Plus
} from 'lucide-react'

interface Command {
  id: string
  group: string
  tipo: 'action' | 'producto' | 'cliente' | 'factura' | 'pedido'
  titulo: string
  subtitulo?: string
  href?: string
  icon: React.ReactNode
  shortcut?: string
}

const QUICK_ACTIONS: Command[] = [
  { id: 'new-pedido',   group: 'Acciones', tipo: 'action', titulo: 'Nuevo Pedido',   subtitulo: 'Ctrl+N',      href: '/pedidos/nuevo',   icon: <ShoppingCart className="w-4 h-4" />, shortcut: '⌘N' },
  { id: 'new-factura',  group: 'Acciones', tipo: 'action', titulo: 'Nueva Factura',  subtitulo: 'Crear factura manual', href: '/facturas/nueva', icon: <FileText className="w-4 h-4" /> },
  { id: 'new-cliente',  group: 'Acciones', tipo: 'action', titulo: 'Nuevo Cliente',  subtitulo: 'Registrar cliente', href: '/clientes/nuevo', icon: <Users className="w-4 h-4" /> },
  { id: 'new-producto', group: 'Acciones', tipo: 'action', titulo: 'Nuevo Producto', subtitulo: 'Agregar producto', href: '/productos/nuevo', icon: <Package className="w-4 h-4" /> },
]

const NAV_ACTIONS: Command[] = [
  { id: 'nav-dashboard',   group: 'Navegar', tipo: 'action', titulo: 'Dashboard',     href: '/dashboard',     icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'nav-pedidos',     group: 'Navegar', tipo: 'action', titulo: 'Pedidos',        href: '/pedidos',       icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'nav-facturas',    group: 'Navegar', tipo: 'action', titulo: 'Facturas',       href: '/facturas',      icon: <ReceiptText className="w-4 h-4" /> },
  { id: 'nav-clientes',    group: 'Navegar', tipo: 'action', titulo: 'Clientes',       href: '/clientes',      icon: <Users className="w-4 h-4" /> },
  { id: 'nav-productos',   group: 'Navegar', tipo: 'action', titulo: 'Productos',      href: '/productos',     icon: <Package className="w-4 h-4" /> },
  { id: 'nav-reportes',    group: 'Navegar', tipo: 'action', titulo: 'Reportes',       href: '/reportes',      icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'nav-equipo',      group: 'Navegar', tipo: 'action', titulo: 'Equipo',         href: '/equipo',        icon: <Users className="w-4 h-4" /> },
  { id: 'nav-config',      group: 'Navegar', tipo: 'action', titulo: 'Configuración',  href: '/configuracion', icon: <Settings className="w-4 h-4" /> },
]

const TIPO_COLORS: Record<string, string> = {
  action:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  producto: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  cliente:  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  factura:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  pedido:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}

const TIPO_LABELS: Record<string, string> = {
  producto: 'Producto',
  cliente:  'Cliente',
  factura:  'Factura',
  pedido:   'Pedido',
}

export default function CommandPalette() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Command[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => {
          if (!prev) { setQuery(''); setResults([]); setSelectedIdx(0) }
          return !prev
        })
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60)
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    const [{ data: productos }, { data: clientes }, { data: facturas }, { data: pedidos }] = await Promise.all([
      supabase.from('productos').select('id, nombre, categoria').ilike('nombre', `%${q}%`).eq('activo', true).limit(4),
      supabase.from('clientes').select('id, nombre, rif').ilike('nombre', `%${q}%`).eq('activo', true).limit(4),
      supabase.from('facturas').select('id, numero, total').ilike('numero', `%${q}%`).limit(3),
      supabase.from('pedidos').select('id, numero, estado').ilike('numero', `%${q}%`).limit(3),
    ])
    const r: Command[] = [
      ...(productos ?? []).map(p => ({ id: `p-${p.id}`, group: 'Productos', tipo: 'producto' as const, titulo: p.nombre, subtitulo: p.categoria ?? undefined, href: `/productos/${p.id}`, icon: <Package className="w-4 h-4" /> })),
      ...(clientes  ?? []).map(c => ({ id: `c-${c.id}`, group: 'Clientes',  tipo: 'cliente'  as const, titulo: c.nombre, subtitulo: c.rif ?? undefined, href: `/clientes/${c.id}`, icon: <Users className="w-4 h-4" /> })),
      ...(facturas  ?? []).map(f => ({ id: `f-${f.id}`, group: 'Facturas',  tipo: 'factura'  as const, titulo: f.numero, subtitulo: `$${(f.total ?? 0).toFixed(2)}`, href: `/facturas/${f.id}`, icon: <FileText className="w-4 h-4" /> })),
      ...(pedidos   ?? []).map(p => ({ id: `d-${p.id}`, group: 'Pedidos',   tipo: 'pedido'   as const, titulo: p.numero, subtitulo: p.estado, href: `/pedidos/${p.id}`, icon: <ShoppingCart className="w-4 h-4" /> })),
    ]
    setResults(r)
    setSelectedIdx(0)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const t = setTimeout(() => search(query), 200)
    return () => clearTimeout(t)
  }, [query, search])

  // Flat display list for keyboard nav
  const flat: Command[] = query.trim() ? results : [...QUICK_ACTIONS, ...NAV_ACTIONS]

  // Groups for rendering
  const grouped: { label: string; items: Command[] }[] = query.trim()
    ? Object.entries(
        results.reduce((acc, r) => { (acc[r.group] ??= []).push(r); return acc }, {} as Record<string, Command[]>)
      ).map(([label, items]) => ({ label, items }))
    : [
        { label: 'Acciones Rápidas', items: QUICK_ACTIONS },
        { label: 'Navegar a',        items: NAV_ACTIONS },
      ]

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, flat.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      const cmd = flat[selectedIdx]
      if (cmd?.href) { router.push(cmd.href); setOpen(false) }
    }
  }

  const run = (cmd: Command) => {
    if (cmd.href) router.push(cmd.href)
    setOpen(false)
  }

  // Compute flat index for a command in grouped structure
  let runningIdx = 0
  const groupsWithIdx = grouped.map(g => {
    const start = runningIdx
    runningIdx += g.items.length
    return { ...g, start }
  })

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="palette-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl shadow-2xl shadow-black/20"
            onClick={e => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
              <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
                onKeyDown={handleKey}
                placeholder="Buscar o ejecutar un comando..."
                className="flex-1 bg-transparent text-[15px] text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
              />
              {loading
                ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
                : <kbd className="hidden sm:flex h-5 items-center gap-0.5 rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-1.5 text-[10px] font-medium text-slate-400">ESC</kbd>
              }
            </div>

            {/* Results list */}
            <div className="max-h-[400px] overflow-y-auto overscroll-contain">
              {query.trim() && results.length === 0 && !loading && (
                <div className="py-12 text-center text-sm text-slate-400">
                  Sin resultados para "<span className="text-slate-600 dark:text-slate-300">{query}</span>"
                </div>
              )}
              {groupsWithIdx.map(group => (
                group.items.length === 0 ? null : (
                  <div key={group.label} className="py-1">
                    <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      {group.label}
                    </p>
                    {group.items.map((cmd, i) => {
                      const flatI = group.start + i
                      const isSelected = selectedIdx === flatI
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => run(cmd)}
                          onMouseEnter={() => setSelectedIdx(flatI)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-900/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${TIPO_COLORS[cmd.tipo]}`}>
                            {cmd.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-200'}`}>
                              {cmd.titulo}
                            </p>
                            {cmd.subtitulo && (
                              <p className="text-xs text-slate-400 truncate">{cmd.subtitulo}</p>
                            )}
                          </div>
                          {cmd.tipo !== 'action' && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TIPO_COLORS[cmd.tipo]}`}>
                              {TIPO_LABELS[cmd.tipo]}
                            </span>
                          )}
                          {cmd.shortcut && (
                            <kbd className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 flex-shrink-0">
                              {cmd.shortcut}
                            </kbd>
                          )}
                          {isSelected && <ArrowRight className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50">
              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <kbd className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded text-[10px]">↵</kbd>
                  abrir
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd>
                  cerrar
                </span>
              </div>
              <span className="text-[11px] text-slate-300 dark:text-slate-600">Emporium</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
