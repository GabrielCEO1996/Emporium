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

// Inner component that only renders on client after PDF modules are loaded
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
        className="flex items-center gap-2 rounded-lg bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-400 cursor-not-allowed"
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
          <span className="flex items-center gap-2 rounded-lg bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-400 cursor-wait select-none">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando...
          </span>
        ) : error ? (
          <span className="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-600 select-none">
            Error al generar PDF
          </span>
        ) : (
          <span className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors cursor-pointer select-none">
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

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      {/* Print button — always available */}
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        title="Abrir diálogo de impresión"
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </button>

      {/* PDF download — client-side only to avoid SSR issues with @react-pdf/renderer */}
      {mounted && <PDFDownloadButton factura={factura} empresaConfig={empresaConfig} />}
    </div>
  )
}
