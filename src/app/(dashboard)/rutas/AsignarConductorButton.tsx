'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Truck } from 'lucide-react'

interface Conductor {
  id: string
  nombre: string
  zona?: string
}

interface Props {
  pedidoId: string
  conductores: Conductor[]
}

export default function AsignarConductorButton({ pedidoId, conductores }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const asignar = async (conductorId: string) => {
    setLoading(true)
    await fetch(`/api/pedidos/${pedidoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conductor_id: conductorId, estado: 'en_ruta' }),
    })
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  if (!conductores.length) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
      >
        <Truck className="w-4 h-4" />
        Asignar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden w-48">
            <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-100">Seleccionar conductor</p>
            {conductores.map(c => (
              <button
                key={c.id}
                onClick={() => asignar(c.id)}
                disabled={loading}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm text-slate-700 transition"
              >
                <p className="font-medium">{c.nombre}</p>
                {c.zona && <p className="text-xs text-slate-400">{c.zona}</p>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
