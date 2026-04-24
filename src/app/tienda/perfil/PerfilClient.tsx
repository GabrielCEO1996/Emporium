'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  User, ChevronLeft, ShoppingBag, ClipboardList,
  CheckCircle2, Loader2, LogOut, Briefcase, Phone, MapPin, MessageCircle,
  CreditCard, Building2, Store, Mail,
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

const TIPO_CLIENTE_OPTIONS: { value: string; label: string }[] = [
  { value: 'tienda',          label: 'Tienda' },
  { value: 'supermercado',    label: 'Supermercado' },
  { value: 'restaurante',     label: 'Restaurante' },
  { value: 'persona_natural', label: 'Persona natural' },
]

// ── Editorial field — floating label feel ─────────────────────────────────────
function Field({
  label, value, onChange, icon, placeholder, type = 'text', disabled = false,
}: {
  label: string; value: string; onChange?: (v: string) => void
  icon: React.ReactNode; placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-1.5 flex items-center gap-1.5">
        {icon} {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full border border-stone-200 rounded-xl px-4 py-3 text-sm bg-white text-brand-navy placeholder-brand-charcoal/40 focus:outline-none focus:border-brand-navy transition ${
          disabled ? 'opacity-60 cursor-not-allowed bg-brand-stone' : ''
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

  const creditoPct = clienteInfo?.credito_autorizado
    ? Math.min(100, ((clienteInfo.credito_usado ?? 0) / Math.max(1, clienteInfo.limite_credito ?? 1)) * 100)
    : 0

  return (
    <div className="min-h-screen bg-brand-cream text-brand-navy">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-brand-cream/85 backdrop-blur-md border-b border-stone-200/70">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-5 flex items-center gap-4">
          <Link href="/tienda" className="p-2 rounded-full hover:bg-stone-100 transition" aria-label="Volver">
            <ChevronLeft className="w-5 h-5 text-brand-navy" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-luxe text-brand-gold">Tu información</p>
            <h1 className="font-serif text-2xl text-brand-navy leading-tight">Mi cuenta</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 lg:px-10 py-10 pb-28">
        <div className="grid lg:grid-cols-[280px_1fr] gap-8 lg:gap-12">

          {/* ── Left column — avatar + identity ── */}
          <motion.aside
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="lg:sticky lg:top-28 lg:self-start space-y-6"
          >
            <div className="bg-white rounded-[22px] border border-stone-200/70 p-7 text-center">
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-brand-navy to-brand-charcoal flex items-center justify-center mx-auto shadow-[0_15px_30px_-10px_rgba(15,23,42,0.3)]">
                <span className="font-serif text-4xl text-brand-gold">{profile.nombre?.charAt(0).toUpperCase()}</span>
                <div className="absolute -bottom-0 -right-0 w-7 h-7 rounded-full bg-brand-gold flex items-center justify-center border-4 border-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-navy" strokeWidth={2.5} />
                </div>
              </div>
              <p className="font-serif text-xl text-brand-navy mt-4 leading-tight">{profile.nombre}</p>
              <p className="text-[11px] text-brand-charcoal/60 mt-1 truncate">{profile.email}</p>
              <span className="inline-block mt-3 text-[10px] uppercase tracking-luxe text-brand-gold border border-brand-gold/40 px-3 py-1 rounded-full">
                {profile.rol}
              </span>
            </div>

            {/* Quick stats */}
            <div className="bg-brand-stone/60 rounded-[22px] p-5 space-y-3">
              <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60">Accesos rápidos</p>
              <Link
                href="/tienda/mis-pedidos"
                className="flex items-center justify-between py-2 text-sm text-brand-navy hover:text-brand-gold transition"
              >
                <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Mis pedidos</span>
                <ChevronLeft className="w-4 h-4 rotate-180" />
              </Link>
              <Link
                href="/tienda"
                className="flex items-center justify-between py-2 text-sm text-brand-navy hover:text-brand-gold transition"
              >
                <span className="flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Volver al catálogo</span>
                <ChevronLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>
          </motion.aside>

          {/* ── Right column — editable fields ── */}
          <div className="space-y-6">

            {/* Editable info card */}
            <motion.section
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white rounded-[22px] border border-stone-200/70 p-7 space-y-5"
            >
              <div>
                <p className="text-[10px] uppercase tracking-luxe text-brand-gold mb-1">Envío</p>
                <h2 className="font-serif text-2xl text-brand-navy">Información de envío</h2>
                <p className="text-[12px] text-brand-charcoal/70 mt-1 leading-relaxed">
                  Esta información se utiliza para procesar y entregar tus pedidos.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Field
                    label="Nombre / Empresa" value={nombre} onChange={setNombre}
                    icon={<User className="w-3 h-3" />}
                    placeholder="Tu nombre completo o negocio"
                  />
                </div>
                <div className="md:col-span-2">
                  <Field
                    label="Email" value={profile.email}
                    icon={<Mail className="w-3 h-3" />}
                    disabled
                  />
                </div>
                <Field
                  label="Teléfono" value={telefono} onChange={setTelefono}
                  icon={<Phone className="w-3 h-3" />}
                  placeholder="0414-0000000" type="tel"
                />
                <Field
                  label="WhatsApp" value={whatsapp} onChange={setWhatsapp}
                  icon={<MessageCircle className="w-3 h-3" />}
                  placeholder="0414-0000000" type="tel"
                />
                <div className="md:col-span-2">
                  <Field
                    label="Dirección de entrega" value={direccion} onChange={setDireccion}
                    icon={<MapPin className="w-3 h-3" />}
                    placeholder="Av. Principal, Casa 5, Urb. X"
                  />
                </div>
                <Field
                  label="Ciudad" value={ciudad} onChange={setCiudad}
                  icon={<Building2 className="w-3 h-3" />}
                  placeholder="Caracas"
                />
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-luxe text-brand-charcoal/60 mb-2 flex items-center gap-1.5">
                  <Store className="w-3 h-3" /> Tipo de cliente
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {TIPO_CLIENTE_OPTIONS.map(opt => {
                    const active = tipoCliente === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTipoCliente(opt.value)}
                        className={`px-3 py-2.5 rounded-full text-[11px] uppercase tracking-wide border transition ${
                          active
                            ? 'bg-brand-navy text-brand-cream border-brand-navy'
                            : 'bg-white text-brand-charcoal border-stone-200 hover:border-brand-navy/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !nombre.trim()}
                className="w-full bg-brand-navy hover:bg-brand-navy/90 disabled:opacity-50 text-brand-cream text-[11px] uppercase tracking-luxe py-4 rounded-full transition flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </motion.section>

            {/* Credit balance */}
            {clienteInfo?.credito_autorizado && (
              <motion.section
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-emerald-50 to-brand-mint rounded-[22px] p-7 border border-emerald-200/60 space-y-5"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                  <p className="text-[10px] uppercase tracking-luxe text-emerald-800">Línea de crédito</p>
                  <span className="ml-auto text-[10px] uppercase tracking-luxe text-emerald-800 bg-white px-3 py-1 rounded-full">
                    Activa
                  </span>
                </div>

                <div className="flex items-end justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-emerald-700/70">Disponible</p>
                    <p className="font-serif text-5xl text-emerald-900 leading-none mt-1">
                      ${((clienteInfo.limite_credito ?? 0) - (clienteInfo.credito_usado ?? 0)).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-emerald-700/80 mt-1.5">
                      de ${(clienteInfo.limite_credito ?? 0).toFixed(2)} total
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-emerald-700/70">Usado</p>
                    <p className="font-serif text-xl text-emerald-900 mt-1">${(clienteInfo.credito_usado ?? 0).toFixed(2)}</p>
                  </div>
                </div>

                <div>
                  <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${creditoPct}%` }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                      className="h-full bg-emerald-600 rounded-full"
                    />
                  </div>
                  <p className="text-[11px] text-emerald-800/80 mt-3 leading-relaxed">
                    Utilízala al checkout seleccionando "Crédito" como método de pago.
                  </p>
                </div>
              </motion.section>
            )}

            {/* Vendor access request */}
            {profile.rol === 'cliente' && (
              <motion.section
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-brand-navy text-brand-cream rounded-[22px] p-7 space-y-3 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-brand-gold/10 blur-3xl pointer-events-none" />
                <div className="relative">
                  <Briefcase className="w-5 h-5 text-brand-gold mb-3" />
                  <p className="text-[10px] uppercase tracking-luxe text-brand-gold mb-1">Equipo Emporium</p>
                  <h2 className="font-serif text-2xl leading-tight">¿Formas parte del equipo?</h2>
                  <p className="text-[13px] text-brand-cream/80 leading-relaxed mt-2 max-w-md">
                    Si trabajas con nosotros y necesitas acceso completo al sistema administrativo,
                    solicita habilitación a un administrador.
                  </p>
                  {requested ? (
                    <div className="mt-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-luxe text-brand-gold bg-brand-gold/10 px-4 py-2 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Solicitud enviada — pendiente de revisión
                    </div>
                  ) : (
                    <button
                      onClick={handleRequestAccess}
                      disabled={requesting}
                      className="mt-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-luxe bg-brand-gold text-brand-navy hover:bg-brand-gold/90 px-6 py-3 rounded-full transition disabled:opacity-60"
                    >
                      {requesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
                      Solicitar acceso de vendedor
                    </button>
                  )}
                </div>
              </motion.section>
            )}

            {/* Sign out */}
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex items-center justify-center gap-2 text-[11px] uppercase tracking-luxe text-rose-600 hover:text-rose-700 py-4 rounded-full border border-rose-200 hover:bg-rose-50 transition disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </motion.button>
          </div>
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-brand-cream/95 backdrop-blur-md border-t border-stone-200/80 flex items-center justify-around px-4 py-3 md:hidden">
        <Link href="/tienda" className="flex flex-col items-center gap-1 py-1 text-brand-charcoal hover:text-brand-navy transition">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-luxe">Tienda</span>
        </Link>
        <Link href="/tienda/mis-pedidos" className="flex flex-col items-center gap-1 py-1 text-brand-charcoal hover:text-brand-navy transition">
          <ClipboardList className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-luxe">Pedidos</span>
        </Link>
        <Link href="/tienda/perfil" className="flex flex-col items-center gap-1 py-1 text-brand-navy">
          <User className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-luxe">Cuenta</span>
        </Link>
      </nav>
    </div>
  )
}
