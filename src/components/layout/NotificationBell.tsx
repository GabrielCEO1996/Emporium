'use client'

import { useState, useEffect } from 'react'
import { Bell, X, Package, AlertTriangle, ShoppingCart, CheckCircle2, UserCog } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface Notif {
  id: string
  tipo: 'stock' | 'factura' | 'pedido' | 'equipo'
  titulo: string
  cuerpo: string
  href: string
  urgent: boolean
}

export default function NotificationBell() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadNotifs() }, [])

  const loadNotifs = async () => {
    setLoading(true)

    // Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    let isAdmin = false
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      isAdmin = prof?.rol === 'admin'
    }

    const [{ data: stockBajo }, { data: facturasVencidas }, { data: pedidosConf }, pendientesResult] = await Promise.all([
      supabase.from('presentaciones')
        .select('id, nombre, stock, productos(nombre)')
        .lt('stock', 5).eq('activo', true)
        .order('stock', { ascending: true }).limit(6),
      supabase.from('facturas')
        .select('id, numero, total, fecha_vencimiento')
        .lt('fecha_vencimiento', new Date().toISOString().split('T')[0])
        .in('estado', ['emitida', 'enviada']).limit(4),
      supabase.from('pedidos')
        .select('id, numero, clientes(nombre)')
        .eq('estado', 'confirmado')
        .order('created_at', { ascending: false }).limit(3),
      isAdmin
        ? supabase.from('profiles').select('id, nombre').eq('rol', 'pendiente').eq('activo', true)
        : Promise.resolve({ data: [] }),
    ])

    const pendientes = (pendientesResult as any)?.data ?? []

    const list: Notif[] = [
      ...(pendientes.length > 0 ? [{
        id: 'equipo-pendientes',
        tipo: 'equipo' as const,
        titulo: `${pendientes.length} usuario${pendientes.length > 1 ? 's' : ''} por aprobar`,
        cuerpo: pendientes.map((p: any) => p.nombre).join(', '),
        href: '/equipo',
        urgent: true,
      }] : []),
      ...(stockBajo ?? []).map((item: any): Notif => ({
        id: `stock-${item.id}`,
        tipo: 'stock',
        titulo: item.stock === 0 ? '⚠ Sin stock' : 'Stock bajo',
        cuerpo: `${(item.productos as any)?.nombre ?? '—'} — ${item.nombre}: ${item.stock} uds`,
        href: '/productos',
        urgent: item.stock === 0,
      })),
      ...(facturasVencidas ?? []).map((f: any): Notif => ({
        id: `fac-${f.id}`,
        tipo: 'factura',
        titulo: 'Factura vencida',
        cuerpo: `${f.numero} — ${formatCurrency(f.total)}`,
        href: `/facturas/${f.id}`,
        urgent: true,
      })),
      ...(pedidosConf ?? []).map((p: any): Notif => ({
        id: `ped-${p.id}`,
        tipo: 'pedido',
        titulo: 'Pedido por facturar',
        cuerpo: `${p.numero} — ${(p.clientes as any)?.nombre ?? ''}`,
        href: `/pedidos/${p.id}`,
        urgent: false,
      })),
    ]
    setNotifs(list)
    setLoading(false)
  }

  const urgentCount = notifs.filter(n => n.urgent).length
  const total = notifs.length

  const iconBg: Record<string, string> = {
    stock:   'bg-amber-100 text-amber-600',
    factura: 'bg-red-100 text-red-600',
    pedido:  'bg-teal-100 text-teal-600',
    equipo:  'bg-violet-100 text-violet-600',
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-0.5 ${urgentCount > 0 ? 'bg-red-500' : 'bg-teal-500'}`}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.14 }}
              className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-white">Alertas</h3>
                  {urgentCount > 0 && (
                    <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{urgentCount} urgente{urgentCount > 1 ? 's' : ''}</span>
                  )}
                </div>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition p-0.5 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* List */}
              <div className="max-h-72 overflow-y-auto">
                {loading && <div className="py-8 text-center text-sm text-slate-400">Cargando...</div>}
                {!loading && total === 0 && (
                  <div className="py-10 text-center">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm text-slate-400">Sin alertas activas</p>
                  </div>
                )}
                {notifs.map(n => (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${n.urgent ? 'border-l-2 border-l-red-400' : ''}`}
                  >
                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg[n.tipo]}`}>
                      {n.tipo === 'stock'   ? <Package className="w-3.5 h-3.5" /> :
                       n.tipo === 'factura' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                       n.tipo === 'equipo'  ? <UserCog className="w-3.5 h-3.5" /> :
                       <ShoppingCart className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{n.titulo}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{n.cuerpo}</p>
                    </div>
                  </Link>
                ))}
              </div>

              {total > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30">
                  <button onClick={() => { loadNotifs(); }} className="text-xs text-teal-600 hover:underline font-medium">
                    Actualizar alertas
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
