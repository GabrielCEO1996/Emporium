'use client'

import { Printer, Download, Loader2 } from 'lucide-react'
import { Factura } from '@/lib/types'
import { useState } from 'react'

export interface EmpresaConfig {
  nombre?: string
  rif?: string
  direccion?: string
  telefono?: string
  email?: string
  logo_url?: string
  mensaje_factura?: string
  zelle_numero?: string | null
  zelle_titular?: string | null
  banco_nombre?: string | null
  banco_cuenta?: string | null
  banco_routing?: string | null
  banco_titular?: string | null
}

export interface PagoInfo {
  tipo_pago?: string | null
  numero_referencia?: string | null
  pago_confirmado?: boolean | null
  pago_confirmado_at?: string | null
}

interface Props {
  factura: Factura
  empresaConfig?: EmpresaConfig
  pagoInfo?: PagoInfo | null
}

// ─── FacturaPrintButton ────────────────────────────────────────────────────
// Reescrito para evitar que se cuelgue:
//   • Lazy-import del renderer SOLO al click (no en mount → no UI muerta
//     mientras carga ~1 MB de @react-pdf/renderer).
//   • Imprimir: abre el blob en pestaña nueva. NO llama window.print()
//     programáticamente (esa llamada se cuelga si la pestaña no terminó
//     de hidratar el PDF). El usuario aprieta Ctrl+P / cmd+P.
//   • Descargar: blob → ancla <a download> → click programático. NO usa
//     PDFDownloadLink (componente con estado interno opaco que dejaba
//     "Generando…" stuck).
// ────────────────────────────────────────────────────────────────────────────

async function buildBlob(args: Props): Promise<Blob> {
  const [{ pdf }, { default: FacturaPDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./FacturaPDF'),
  ])
  return pdf(
    <FacturaPDF
      factura={args.factura}
      empresaConfig={args.empresaConfig}
      pagoInfo={args.pagoInfo as any}
    />
  ).toBlob()
}

export default function FacturaPrintButton({ factura, empresaConfig, pagoInfo }: Props) {
  const [busy, setBusy] = useState<'print' | 'download' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePrint = async () => {
    setBusy('print')
    setError(null)
    try {
      const blob = await buildBlob({ factura, empresaConfig, pagoInfo })
      const url = URL.createObjectURL(blob)
      // Abrir en pestaña nueva. Usuario imprime con Ctrl+P. window.print()
      // programático se cuelga en algunos browsers con blob URLs.
      const w = window.open(url, '_blank')
      if (!w) {
        // Popup blocker — fallback a download del mismo blob para que el
        // usuario al menos tenga el archivo.
        triggerDownload(url, `Factura-${factura.numero}.pdf`)
      }
      // Liberar URL después de que la pestaña haya tenido tiempo de cargarlo.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err: any) {
      console.error('[FacturaPrintButton] print failed:', err)
      setError('No se pudo generar el PDF para imprimir')
    } finally {
      setBusy(null)
    }
  }

  const handleDownload = async () => {
    setBusy('download')
    setError(null)
    try {
      const blob = await buildBlob({ factura, empresaConfig, pagoInfo })
      const url = URL.createObjectURL(blob)
      triggerDownload(url, `Factura-${factura.numero}.pdf`)
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (err: any) {
      console.error('[FacturaPrintButton] download failed:', err)
      setError('No se pudo generar el PDF')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        onClick={handlePrint}
        disabled={busy !== null}
        title="Abrir PDF en pestaña nueva — Ctrl+P para imprimir"
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
      >
        {busy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        Imprimir
      </button>
      <button
        onClick={handleDownload}
        disabled={busy !== null}
        title="Descargar PDF"
        className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
      >
        {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Descargar PDF
      </button>
      {error && <span className="text-xs text-rose-600 ml-1">{error}</span>}
    </div>
  )
}

function triggerDownload(blobUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
