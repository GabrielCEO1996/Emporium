'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Package, Users, X, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  tipo: 'producto' | 'cliente'
  titulo: string
  subtitulo?: string
  href: string
}

interface Props {
  mobile?: boolean
}

export default function GlobalSearch({ mobile = false }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)

    const [{ data: productos }, { data: clientes }] = await Promise.all([
      supabase
        .from('productos')
        .select('id, nombre, categoria')
        .ilike('nombre', `%${q}%`)
        .eq('activo', true)
        .limit(5),
      supabase
        .from('clientes')
        .select('id, nombre, telefono, ciudad')
        .ilike('nombre', `%${q}%`)
        .eq('activo', true)
        .limit(5),
    ])

    const r: SearchResult[] = [
      ...(productos || []).map(p => ({
        id: p.id,
        tipo: 'producto' as const,
        titulo: p.nombre,
        subtitulo: p.categoria || 'Sin categoría',
        href: `/productos/${p.id}`,
      })),
      ...(clientes || []).map(c => ({
        id: c.id,
        tipo: 'cliente' as const,
        titulo: c.nombre,
        subtitulo: [c.ciudad, c.telefono].filter(Boolean).join(' · '),
        href: `/clientes/${c.id}`,
      })),
    ]

    setResults(r)
    setSelected(0)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250)
    return () => clearTimeout(timer)
  }, [query, search])

  const navigate = (href: string) => {
    router.push(href)
    setOpen(false)
    setQuery('')
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigate(results[selected].href)
  }

  // Inline search for mobile (always visible)
  if (mobile) {
    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar productos, clientes..."
          className="w-full bg-slate-100 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        )}
        {open && query.length >= 2 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <SearchDropdown results={results} loading={loading} selected={selected} onNavigate={navigate} />
          </>
        )}
      </div>
    )
  }

  // Desktop: button that opens a modal overlay
  return (
    <>
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl px-4 py-2 text-sm transition w-72 text-left"
      >
        <Search className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">Buscar productos, clientes...</span>
        <kbd className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono text-slate-400">⌘K</kbd>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => { setOpen(false); setQuery('') }}
          />
          {/* Modal */}
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
                <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar productos, clientes..."
                  className="flex-1 text-base text-slate-700 placeholder-slate-400 focus:outline-none"
                  autoFocus
                />
                {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                {query && !loading && (
                  <button onClick={() => { setQuery(''); setResults([]) }} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Results */}
              <SearchDropdown results={results} loading={false} selected={selected} onNavigate={navigate} inline />
            </div>
          </div>
        </>
      )}
    </>
  )
}

function SearchDropdown({
  results, loading, selected, onNavigate, inline
}: {
  results: SearchResult[]
  loading: boolean
  selected: number
  onNavigate: (href: string) => void
  inline?: boolean
}) {
  if (loading) {
    return (
      <div className={cn('bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center text-sm text-slate-400', !inline && 'absolute top-full left-0 right-0 mt-2 z-20')}>
        Buscando...
      </div>
    )
  }

  if (results.length === 0) return null

  const productos = results.filter(r => r.tipo === 'producto')
  const clientes = results.filter(r => r.tipo === 'cliente')
  let idx = 0

  return (
    <div className={cn(!inline && 'absolute top-full left-0 right-0 mt-2 z-20 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden')}>
      <div className="max-h-80 overflow-y-auto">
        {productos.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3 h-3" /> Productos
            </p>
            {productos.map(r => {
              const i = idx++
              return (
                <button
                  key={r.id}
                  onClick={() => onNavigate(r.href)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition text-left',
                    selected === i && 'bg-blue-50'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.titulo}</p>
                      {r.subtitulo && <p className="text-xs text-slate-400 truncate">{r.subtitulo}</p>}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        )}
        {clientes.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Clientes
            </p>
            {clientes.map(r => {
              const i = idx++
              return (
                <button
                  key={r.id}
                  onClick={() => onNavigate(r.href)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition text-left',
                    selected === i && 'bg-blue-50'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.titulo}</p>
                      {r.subtitulo && <p className="text-xs text-slate-400 truncate">{r.subtitulo}</p>}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
        ↑↓ navegar · Enter seleccionar · Esc cerrar
      </div>
    </div>
  )
}
