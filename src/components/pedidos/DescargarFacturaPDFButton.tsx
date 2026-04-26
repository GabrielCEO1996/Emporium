'use client'

import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { Factura } from '@/lib/types'
import type { EmpresaConfig, PagoInfo } from '@/components/facturas/FacturaPrintButton'

interface Props {
  factura: Factura
  empresaConfig?: EmpresaConfig
  pagoInfo?: PagoInfo | null
}

// ─── DescargarFacturaPDFButton ─────────────────────────────────────────────
// Reescrito (post Fase 5) para evitar el "Generando PDF…" stuck que tenía
// el componente antes vía PDFDownloadLink. Mismo patrón que
// FacturaPrintButton:
//   • Lazy-import del renderer SOLO al click
//   • blob → ancla <a download> → click programático
//   • Timeout de 15s — si la generación se cuelga (ej. Image con URL
//     CORS-blocked dentro del PDF), no bloquea el botón para siempre
// ────────────────────────────────────────────────────────────────────────────

const PDF_TIMEOUT_MS = 15_000

async function buildBlobWithTimeout(args: Props): Promise<Blob> {
  const work = (async () => {
    const [{ pdf }, { default: FacturaPDF }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/components/facturas/FacturaPDF'),
    ])
    return pdf(
      <FacturaPDF
        factura={args.factura}
        empresaConfig={args.empresaConfig}
        pagoInfo={args.pagoInfo as any}
      />
    ).toBlob()
  })()
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Tardó demasiado en generar — verificá que el logo sea accesible.')), PDF_TIMEOUT_MS)
  )
  return Promise.race([work, timeout])
}

function triggerDownload(blobUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function DescargarFacturaPDFButton({ factura, empresaConfig, pagoInfo }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setBusy(true)
    setError(null)
    try {
      const blob = await buildBlobWithTimeout({ factura, empresaConfig, pagoInfo })
      const url = URL.createObjectURL(blob)
      triggerDownload(url, `Factura-${factura.numero}.pdf`)
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (err: any) {
      console.error('[DescargarFacturaPDF]', err)
      setError(err?.message ?? 'No se pudo generar el PDF')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition-colors shadow-sm"
        style={{ backgroundColor: busy ? undefined : '#0D9488' }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? 'Generando PDF…' : 'Descargar Factura PDF'}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  )
}
