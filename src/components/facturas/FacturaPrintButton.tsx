'use client'

import { Printer, Download, Loader2 } from 'lucide-react'
import { Factura } from '@/lib/types'
import { useState, useEffect } from 'react'

export interface EmpresaConfig {
  nombre?: string
  rif?: string
  direccion?: string
  telefono?: string
  email?: string
  logo_url?: string
  mensaje_factura?: string
}

interface FacturaPrintButtonProps {
  factura: Factura
  empresaConfig?: EmpresaConfig
}

// ─────────────────────────────────────────────────────────────────────────────
// Print button: uses the same FacturaPDF component as Download + Email.
// Generates a PDF blob, opens it in a new window, and triggers print on load.
// ─────────────────────────────────────────────────────────────────────────────
function PrintPDFButton({ factura, empresaConfig }: { factura: Factura; empresaConfig?: EmpresaConfig }) {
  const [loading, setLoading] = useState(false)

  const handlePrint = async () => {
    setLoading(true)
    try {
      const [{ pdf }, { default: FacturaPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./FacturaPDF'),
      ])

      const blob = await pdf(
        <FacturaPDF factura={factura} empresaConfig={empresaConfig} />
      ).toBlob()

      const blobUrl = URL.createObjectURL(blob)
      const printWindow = window.open(blobUrl, '_blank')

      if (printWindow) {
        printWindow.addEventListener('load', () => {
          try {
            printWindow.focus()
            printWindow.print()
          } catch {
            // browser may block — user can still print from preview
          }
        })
      }

      // Revoke after a delay to let the window render
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (err) {
      console.error('Error al generar PDF para imprimir:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePrint}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
      title="Imprimir factura"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      Imprimir
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Download PDF button — same renderer, download link
// ─────────────────────────────────────────────────────────────────────────────
function PDFDownloadButton({ factura, empresaConfig }: { factura: Factura; empresaConfig?: EmpresaConfig }) {
  const [modules, setModules] = useState<{
    PDFDownloadLink: any
    FacturaPDF: any
  } | null>(null)

  useEffect(() => {
    Promise.all([
      import('@react-pdf/renderer'),
      import('./FacturaPDF'),
    ]).then(([pdfRenderer, facturaModule]) => {
      setModules({
        PDFDownloadLink: pdfRenderer.PDFDownloadLink,
        FacturaPDF: facturaModule.default,
      })
    })
  }, [])

  const fileName = `Factura-${factura.numero}.pdf`

  if (!modules) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg bg-teal-100 px-4 py-2 text-sm font-medium text-teal-400 cursor-not-allowed"
        aria-label="Cargando PDF"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        PDF
      </button>
    )
  }

  const { PDFDownloadLink, FacturaPDF } = modules

  return (
    <PDFDownloadLink
      document={<FacturaPDF factura={factura} empresaConfig={empresaConfig} />}
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
          <span className="flex items-center gap-2 rounded-lg bg-teal-100 px-4 py-2 text-sm font-medium text-teal-400 cursor-wait select-none">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando...
          </span>
        ) : error ? (
          <span className="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-600 select-none">
            Error al generar PDF
          </span>
        ) : (
          <span className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors cursor-pointer select-none">
            <Download className="h-4 w-4" />
            Descargar PDF
          </span>
        )
      }
    </PDFDownloadLink>
  )
}

export default function FacturaPrintButton({ factura, empresaConfig }: FacturaPrintButtonProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex items-center gap-2 print:hidden">
      {mounted && <PrintPDFButton factura={factura} empresaConfig={empresaConfig} />}
      {mounted && <PDFDownloadButton factura={factura} empresaConfig={empresaConfig} />}
    </div>
  )
}
