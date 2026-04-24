'use client'

import { Download, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Factura } from '@/lib/types'
import type { EmpresaConfig, PagoInfo } from '@/components/facturas/FacturaPrintButton'

interface Props {
  factura: Factura
  empresaConfig?: EmpresaConfig
  pagoInfo?: PagoInfo | null
}

/**
 * Prominent "Descargar Factura PDF" button for the pedido detail page.
 * Dynamically imports @react-pdf/renderer and FacturaPDF client-side to
 * avoid bloating the initial bundle.
 */
export default function DescargarFacturaPDFButton({ factura, empresaConfig, pagoInfo }: Props) {
  const [modules, setModules] = useState<{
    PDFDownloadLink: any
    FacturaPDF: any
  } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    Promise.all([
      import('@react-pdf/renderer'),
      import('@/components/facturas/FacturaPDF'),
    ]).then(([pdfRenderer, facturaModule]) => {
      setModules({
        PDFDownloadLink: pdfRenderer.PDFDownloadLink,
        FacturaPDF: facturaModule.default,
      })
    })
  }, [])

  if (!mounted) return null

  const fileName = `Factura-${factura.numero}.pdf`

  if (!modules) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg bg-teal-600/60 px-4 py-2 text-sm font-semibold text-white cursor-not-allowed shadow-sm"
        aria-label="Preparando PDF"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparando PDF…
      </button>
    )
  }

  const { PDFDownloadLink, FacturaPDF } = modules

  return (
    <PDFDownloadLink
      document={<FacturaPDF factura={factura} empresaConfig={empresaConfig} pagoInfo={pagoInfo} />}
      fileName={fileName}
    >
      {({
        loading,
        error,
      }: {
        loading: boolean
        error: Error | null
        url: string | null
        blob: Blob | null
      }) =>
        loading ? (
          <span className="flex items-center gap-2 rounded-lg bg-teal-600/60 px-4 py-2 text-sm font-semibold text-white cursor-wait shadow-sm select-none">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando PDF…
          </span>
        ) : error ? (
          <span className="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 select-none">
            Error al generar PDF
          </span>
        ) : (
          <span
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors cursor-pointer select-none"
            style={{ backgroundColor: '#0D9488' }}
          >
            <Download className="h-4 w-4" />
            Descargar Factura PDF
          </span>
        )
      }
    </PDFDownloadLink>
  )
}
