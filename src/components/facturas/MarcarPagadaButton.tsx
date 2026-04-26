'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle, Loader2, X, Wallet, Banknote, FileCheck, Landmark, CreditCard,
  Image as ImageIcon, Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// ─── MarcarPagadaButton ────────────────────────────────────────────────────
// Reemplaza el botón "Marcar como Pagada" simple por un modal que captura
// el método de pago + campos específicos. Persiste:
//   • factura.estado='pagada' + tipo_pago + monto_pagado + pago_confirmado_*
//   • pagos row con metodo + referencia + comprobante_url + notas
//
// Métodos:
//   • efectivo       — solo monto
//   • zelle          — monto + número confirmación + (opcional) foto
//   • cheque         — monto + número cheque + banco emisor + (opcional) foto
//   • transferencia  — monto + referencia + (opcional) foto
//   • tarjeta_fisica — monto + últimos 4 + número aprobación
// ────────────────────────────────────────────────────────────────────────────

type Metodo = 'efectivo' | 'zelle' | 'cheque' | 'transferencia' | 'tarjeta_fisica'

interface Props {
  facturaId: string
  /** Total de la factura — pre-rellena el campo monto. */
  total?: number
}

const METODOS: Array<{ key: Metodo; label: string; Icon: any }> = [
  { key: 'efectivo',       label: 'Efectivo',         Icon: Banknote },
  { key: 'zelle',          label: 'Zelle',            Icon: Wallet },
  { key: 'cheque',         label: 'Cheque',           Icon: FileCheck },
  { key: 'transferencia',  label: 'Transferencia',    Icon: Landmark },
  { key: 'tarjeta_fisica', label: 'Tarjeta (POS)',    Icon: CreditCard },
]

export default function MarcarPagadaButton({ facturaId, total }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [metodo, setMetodo] = useState<Metodo>('efectivo')
  const [monto, setMonto] = useState<string>(total ? total.toFixed(2) : '')
  const [referencia, setReferencia] = useState('')
  const [bancoEmisor, setBancoEmisor] = useState('')
  const [ultimos4, setUltimos4] = useState('')
  const [aprobacion, setAprobacion] = useState('')
  const [notas, setNotas] = useState('')
  const [comprobanteUrl, setComprobanteUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Cuando cambia total (ej. props update post-reload), re-pre-llenamos
  // el monto si el usuario aún no lo tocó.
  useEffect(() => {
    if (total != null && !monto) setMonto(total.toFixed(2))
  }, [total, monto])

  const reset = () => {
    setMetodo('efectivo')
    setMonto(total ? total.toFixed(2) : '')
    setReferencia('')
    setBancoEmisor('')
    setUltimos4('')
    setAprobacion('')
    setNotas('')
    setComprobanteUrl('')
  }

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Debe ser una imagen')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Máximo 5 MB por imagen')
      return
    }
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
      const path = `pago-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type })
      if (error) throw error
      const { data: pub } = supabase.storage.from('payment-proofs').getPublicUrl(data.path)
      if (!pub?.publicUrl) throw new Error('No se pudo obtener URL pública')
      setComprobanteUrl(pub.publicUrl)
      toast.success('Comprobante adjuntado')
    } catch (err: any) {
      console.error('[MarcarPagadaButton.upload]', err)
      toast.error(err?.message ?? 'No se pudo subir el comprobante')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const validate = (): string | null => {
    const m = Number(monto)
    if (!Number.isFinite(m) || m <= 0) return 'El monto debe ser positivo'
    if (metodo === 'zelle' && !referencia.trim()) return 'Ingresá el número de confirmación Zelle'
    if (metodo === 'cheque') {
      if (!referencia.trim()) return 'Ingresá el número de cheque'
      if (!bancoEmisor.trim()) return 'Ingresá el banco emisor del cheque'
    }
    if (metodo === 'transferencia' && !referencia.trim()) return 'Ingresá el número de referencia'
    if (metodo === 'tarjeta_fisica') {
      if (!ultimos4.trim()) return 'Ingresá los últimos 4 dígitos de la tarjeta'
      if (!/^\d{4}$/.test(ultimos4.trim())) return 'Los últimos 4 dígitos deben ser exactamente 4 números'
      if (!aprobacion.trim()) return 'Ingresá el número de aprobación'
    }
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    setSubmitting(true)
    try {
      // Compose extras into notas for cheque + tarjeta_fisica (banco /
      // last4 / approval). Mantiene los datos sin ampliar la tabla.
      const extras: string[] = []
      if (metodo === 'cheque' && bancoEmisor.trim()) {
        extras.push(`Banco emisor: ${bancoEmisor.trim()}`)
      }
      if (metodo === 'tarjeta_fisica') {
        if (ultimos4.trim()) extras.push(`Últimos 4: ${ultimos4.trim()}`)
        if (aprobacion.trim()) extras.push(`Aprobación: ${aprobacion.trim()}`)
      }
      const notasFinal = [notas.trim(), ...extras].filter(Boolean).join(' · ') || null

      const res = await fetch(`/api/facturas/${facturaId}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metodo,
          monto: Number(monto),
          referencia: referencia.trim() || null,
          comprobante_url: comprobanteUrl || null,
          notas: notasFinal,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Error al registrar el pago')
        return
      }
      toast.success('Pago registrado · factura marcada como pagada')
      setOpen(false)
      reset()
      router.refresh()
    } catch (err: any) {
      console.error('[MarcarPagadaButton.submit]', err)
      toast.error(err?.message ?? 'Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Field visibility per método ─────────────────────────────────────────
  const showRef = ['zelle', 'cheque', 'transferencia'].includes(metodo)
  const refLabel =
    metodo === 'zelle'         ? 'Número de confirmación Zelle' :
    metodo === 'cheque'        ? 'Número de cheque' :
    metodo === 'transferencia' ? 'Número de referencia' :
    'Referencia'
  const refRequired = ['zelle', 'cheque', 'transferencia'].includes(metodo)
  const showFoto = ['zelle', 'cheque', 'transferencia'].includes(metodo)
  const showBanco = metodo === 'cheque'
  const showTarjeta = metodo === 'tarjeta_fisica'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
      >
        <CheckCircle className="h-4 w-4" />
        Marcar como Pagada
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 sticky top-0 bg-white">
              <h2 className="text-base font-bold text-slate-900">¿Cómo te pagaron?</h2>
              <button
                onClick={() => { setOpen(false); reset() }}
                disabled={submitting}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Method picker — grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {METODOS.map(m => {
                  const Icon = m.Icon
                  const active = metodo === m.key
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMetodo(m.key)}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold transition ${
                        active
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {m.label}
                    </button>
                  )
                })}
              </div>

              {/* Monto — siempre visible */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Monto recibido <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                />
                {total != null && Number(monto) !== total && (
                  <p className="mt-1 text-[11px] text-amber-600">
                    Total de factura: ${total.toFixed(2)}. Si el monto difiere, queda registrado tal cual.
                  </p>
                )}
              </div>

              {/* Referencia — zelle/cheque/transferencia */}
              {showRef && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {refLabel} {refRequired && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={referencia}
                    onChange={e => setReferencia(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                  />
                </div>
              )}

              {/* Banco — cheque only */}
              {showBanco && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Banco emisor <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bancoEmisor}
                    onChange={e => setBancoEmisor(e.target.value)}
                    placeholder="Ej. Provincial, Mercantil, Banesco"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                  />
                </div>
              )}

              {/* Tarjeta física — last4 + aprobación */}
              {showTarjeta && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Últimos 4 dígitos <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={ultimos4}
                      onChange={e => setUltimos4(e.target.value.replace(/\D/g, ''))}
                      placeholder="1234"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Aprobación <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={aprobacion}
                      onChange={e => setAprobacion(e.target.value)}
                      placeholder="123456"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                    />
                  </div>
                </div>
              )}

              {/* Foto comprobante — opcional para zelle/cheque/transferencia */}
              {showFoto && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Foto del comprobante <span className="text-slate-400">(opcional)</span>
                  </label>
                  {comprobanteUrl ? (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
                      <img
                        src={comprobanteUrl}
                        alt="Comprobante"
                        className="h-14 w-14 rounded object-cover border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setComprobanteUrl('')}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? 'Subiendo…' : 'Subir foto / screenshot'}
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) handleUpload(f)
                    }}
                  />
                </div>
              )}

              {/* Notas — siempre visible, opcional */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notas <span className="text-slate-400">(opcional)</span>
                </label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Cualquier detalle adicional"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 sticky bottom-0 bg-white">
              <button
                onClick={() => { setOpen(false); reset() }}
                disabled={submitting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || uploading}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {submitting ? 'Registrando…' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
