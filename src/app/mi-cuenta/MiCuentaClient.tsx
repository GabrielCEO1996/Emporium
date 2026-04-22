'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import {
  User, ShoppingCart, FileText, LogOut, ChevronRight,
  Clock, CheckCircle2, Truck, XCircle, AlertCircle, Package,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Profile } from '@/lib/types'

interface Props {
  profile: Profile
  pedidos: Array<{
    id: string; numero: string; estado: string
    fecha_pedido: string; total: number
  }>
  facturas: Array<{
    id: string; numero: string; estado: string
    fecha_emision: string; total: number; monto_pagado: number
  }>
  isLinked: boolean
}

const ESTADO_PEDIDO: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  borrador:   { label: 'Borrador',   color: 'text-slate-500 bg-slate-100 dark:bg-slate-700',               icon: <Clock className="w-3 h-3" /> },
  confirmado: { label: 'Confirmado', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',                icon: <CheckCircle2 className="w-3 h-3" /> },
  en_ruta:    { label: 'En ruta',    color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30',             icon: <Truck className="w-3 h-3" /> },
  entregado:  { label: 'Entregado',  color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30',       icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelado:  { label: 'Cancelado',  color: 'text-red-500 bg-red-50 dark:bg-red-900/30',                  icon: <XCircle className="w-3 h-3" /> },
  facturado:  { label: 'Facturado',  color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30',         icon: <FileText className="w-3 h-3" /> },
}

const ESTADO_FACTURA: Record<string, { label: string; color: string }> = {
  emitida:          { label: 'Emitida',     color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  pagada:           { label: 'Pagada',      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
  anulada:          { label: 'Anulada',     color: 'text-red-500 bg-red-50 dark:bg-red-900/30' },
  con_nota_credito: { label: 'Nota crédito', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
}

export default function MiCuentaClient({ profile, pedidos, facturas, isLinked }: Props) {
  const router = useRouter()
  const [requesting, setRequesting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const supabase = createClient()

  const handleRequestAccess = async () => {
    setRequesting(true)
    const { error } = await supabase
      .from('profiles')
      .update({ rol: 'pendiente' })
      .eq('id', profile.id)
    if (error) {
      toast.error('Error al enviar solicitud')
    } else {
      toast.success('Solicitud enviada. Un administrador revisará tu acceso.')
      router.refresh()
    }
    setRequesting(false)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-sm">
            {profile.nombre?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">{profile.nombre}</p>
            <p className="text-xs text-slate-400">{profile.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Welcome card */}
        <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl p-6 text-white">
          <p className="text-teal-100 text-sm mb-1">Bienvenido a</p>
          <h1 className="text-2xl font-bold mb-4">Mi Cuenta</h1>
          {!isLinked && (
            <div className="bg-white/10 rounded-xl p-3 flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-teal-50">Tu cuenta no está vinculada aún a un perfil de cliente. Contacta a tu distribuidor para que te agregue al sistema.</p>
            </div>
          )}
          {isLinked && (
            <div className="flex gap-4">
              <div className="bg-white/10 rounded-xl p-3 flex-1 text-center">
                <p className="text-2xl font-bold">{pedidos.length}</p>
                <p className="text-xs text-teal-100">Pedidos</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 flex-1 text-center">
                <p className="text-2xl font-bold">{facturas.length}</p>
                <p className="text-xs text-teal-100">Facturas</p>
              </div>
            </div>
          )}
        </div>

        {/* Request vendor access */}
        {profile.rol === 'cliente' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-white mb-0.5">¿Eres parte del equipo?</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Si trabajas en la empresa y necesitas acceso al sistema, solicita que un administrador te habilite.
                </p>
                <button
                  onClick={handleRequestAccess}
                  disabled={requesting}
                  className="text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {requesting ? 'Enviando...' : 'Solicitar acceso al sistema'}
                  {!requesting && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pedidos */}
        {isLinked && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
              <ShoppingCart className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Mis Pedidos</h2>
            </div>
            {pedidos.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Package className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Sin pedidos registrados</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {pedidos.map(p => {
                  const cfg = ESTADO_PEDIDO[p.estado] ?? ESTADO_PEDIDO.borrador
                  return (
                    <li key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.numero}</p>
                        <p className="text-xs text-slate-400">{new Date(p.fecha_pedido).toLocaleDateString('es-VE')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(p.total)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* Facturas */}
        {isLinked && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
              <FileText className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Mis Facturas</h2>
            </div>
            {facturas.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <FileText className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Sin facturas registradas</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {facturas.map(f => {
                  const cfg = ESTADO_FACTURA[f.estado] ?? ESTADO_FACTURA.emitida
                  const pendiente = f.total - f.monto_pagado
                  return (
                    <li key={f.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{f.numero}</p>
                        <p className="text-xs text-slate-400">{new Date(f.fecha_emision).toLocaleDateString('es-VE')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(f.total)}</p>
                          {pendiente > 0.01 && (
                            <p className="text-xs text-red-500 tabular-nums">Debe: {formatCurrency(pendiente)}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
