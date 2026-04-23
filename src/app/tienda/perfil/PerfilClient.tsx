'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  User, ChevronLeft, ShoppingBag, ClipboardList,
  CheckCircle2, Loader2, LogOut, Briefcase, Phone, MapPin, MessageCircle,
  CreditCard, Building2, Store,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  profile: {
    id: string; nombre: string; email: string; rol: string
    solicita_vendedor?: boolean
  }
  clienteInfo?: {
    id?: string; nombre?: string; telefono?: string
    whatsapp?: string; direccion?: string; ciudad?: string
    tipo_cliente?: string
    credito_autorizado?: boolean; limite_credito?: number; credito_usado?: number
  } | null
}

const TIPO_CLIENTE_OPTIONS: { value: string; label: string; emoji: string }[] = [
  { value: 'tienda',          label: 'Tienda',          emoji: '🏪' },
  { value: 'supermercado',    label: 'Supermercado',    emoji: '🛒' },
  { value: 'restaurante',     label: 'Restaurante',     emoji: '🍽️' },
  { value: 'persona_natural', label: 'Persona natural', emoji: '👤' },
]

function Field({
  label, value, onChange, icon, placeholder, type = 'text', disabled = false,
}: {
  label: string; value: string; onChange?: (v: string) => void
  icon: React.ReactNode; placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
        {icon} {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      />
    </div>
  )
}

export default function PerfilClient({ profile, clienteInfo }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [nombre, setNombre] = useState(profile.nombre ?? '')
  const [telefono, setTelefono] = useState(clienteInfo?.telefono ?? '')
  const [whatsapp, setWhatsapp] = useState(clienteInfo?.whatsapp ?? '')
  const [direccion, setDireccion] = useState(clienteInfo?.direccion ?? '')
  const [ciudad, setCiudad] = useState(clienteInfo?.ciudad ?? '')
  const [tipoCliente, setTipoCliente] = useState(clienteInfo?.tipo_cliente ?? 'persona_natural')
  const [saving, setSaving] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [requested, setRequested] = useState(profile.solicita_vendedor ?? false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    const res = await fetch('/api/tienda/perfil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre, telefono, whatsapp, direccion,
        ciudad, tipo_cliente: tipoCliente,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Perfil actualizado')
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Error al guardar')
    }
  }

  const handleRequestAccess = async () => {
    setRequesting(true)
    const res = await fetch('/api/tienda/perfil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicita_vendedor: true }),
    })
    setRequesting(false)
    if (res.ok) {
      setRequested(true)
      toast.success('Solicitud enviada. Un administrador te contactará.')
    } else {
      toast.error('Error al enviar solicitud')
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3">
        <Link href="/tienda" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </Link>
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-teal-600" />
          <h1 className="font-bold text-slate-800 dark:text-white">Mi Perfil</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-24">

        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl p-6 flex flex-col items-center gap-3 shadow-sm border border-slate-100 dark:border-slate-700"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <span className="text-3xl font-black text-white">{profile.nombre?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="text-center">
            <p className="font-bold text-slate-800 dark:text-white text-lg">{profile.nombre}</p>
            <p className="text-sm text-slate-400">{profile.email}</p>
            <span className="inline-block mt-1.5 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 text-xs font-semibold px-3 py-1 rounded-full capitalize">
              {profile.rol}
            </span>
          </div>
        </motion.div>

        {/* Editable fields */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4"
        >
          <div>
            <h2 className="font-semibold text-slate-700 dark:text-white text-sm">Tu información de envío</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Esta información se usa para procesar tus órdenes.
            </p>
          </div>

          <Field
            label="Nombre / Empresa" value={nombre} onChange={setNombre}
            icon={<User className="w-3 h-3" />}
            placeholder="Tu nombre completo o negocio"
          />
          <Field
            label="Email" value={profile.email}
            icon={<User className="w-3 h-3" />}
            disabled
          />
          <Field
            label="Teléfono" value={telefono} onChange={setTelefono}
            icon={<Phone className="w-3 h-3" />}
            placeholder="0414-0000000"
            type="tel"
          />
          <Field
            label="WhatsApp" value={whatsapp} onChange={setWhatsapp}
            icon={<MessageCircle className="w-3 h-3" />}
            placeholder="0414-0000000"
            type="tel"
          />
          <Field
            label="Dirección de entrega" value={direccion} onChange={setDireccion}
            icon={<MapPin className="w-3 h-3" />}
            placeholder="Av. Principal, Casa 5, Urb. X"
          />
          <Field
            label="Ciudad" value={ciudad} onChange={setCiudad}
            icon={<Building2 className="w-3 h-3" />}
            placeholder="Caracas"
          />

          {/* Tipo de cliente */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Store className="w-3 h-3" /> Tipo de cliente
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIPO_CLIENTE_OPTIONS.map(opt => {
                const active = tipoCliente === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTipoCliente(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition ${
                      active
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-400'
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !nombre.trim()}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </motion.div>

        {/* Credit balance */}
        {clienteInfo?.credito_autorizado && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-5 border border-emerald-200 dark:border-emerald-800 space-y-3"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h2 className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">Crédito disponible</h2>
              <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">Activo</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                  ${((clienteInfo.limite_credito ?? 0) - (clienteInfo.credito_usado ?? 0)).toFixed(2)}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  de ${(clienteInfo.limite_credito ?? 0).toFixed(2)} límite total
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">Usado</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">${(clienteInfo.credito_usado ?? 0).toFixed(2)}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, ((clienteInfo.credito_usado ?? 0) / Math.max(1, clienteInfo.limite_credito ?? 1)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Úsalo al hacer pedidos desde la tienda con el botón "Pedir a crédito"
            </p>
          </motion.div>
        )}

        {/* Request vendor access */}
        {profile.rol === 'cliente' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-2xl p-5 border border-violet-100 dark:border-violet-800 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-violet-600" />
              <h2 className="font-semibold text-violet-800 dark:text-violet-300 text-sm">¿Formas parte del equipo?</h2>
            </div>
            <p className="text-xs text-violet-700 dark:text-violet-400 leading-relaxed">
              Si trabajas en la empresa y necesitas acceso completo al sistema, solicita habilitación a un administrador.
            </p>
            {requested ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Solicitud enviada — pendiente de revisión
              </div>
            ) : (
              <button
                onClick={handleRequestAccess}
                disabled={requesting}
                className="flex items-center gap-2 text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl transition disabled:opacity-50"
              >
                {requesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
                Solicitar acceso como vendedor
              </button>
            )}
          </motion.div>
        )}

        {/* Sign out */}
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-600 font-semibold py-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </motion.button>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-4 py-2 lg:hidden">
        <Link href="/tienda" className="flex flex-col items-center gap-0.5 py-1 text-slate-400 hover:text-slate-600 transition">
          <ShoppingBag className="w-5 h-5" /><span className="text-xs font-medium">Tienda</span>
        </Link>
        <Link href="/tienda/mis-pedidos" className="flex flex-col items-center gap-0.5 py-1 text-slate-400 hover:text-slate-600 transition">
          <ClipboardList className="w-5 h-5" /><span className="text-xs font-medium">Pedidos</span>
        </Link>
        <Link href="/tienda/perfil" className="flex flex-col items-center gap-0.5 py-1 text-teal-600">
          <User className="w-5 h-5" /><span className="text-xs font-medium">Perfil</span>
        </Link>
      </nav>
    </div>
  )
}
