'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface Column<T> {
  header: string
  accessor: (row: T) => string | number | null | undefined
}

interface Props<T> {
  data: T[]
  columns: Column<T>[]
  filename?: string
  sheetName?: string
  className?: string
}

export default function ExportExcelButton<T>({
  data,
  columns,
  filename = 'export',
  sheetName = 'Datos',
  className,
}: Props<T>) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (loading || data.length === 0) return
    setLoading(true)
    try {
      const ExcelJS = (await import('exceljs')).default

      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet(sheetName)

      // Header row
      ws.addRow(columns.map(c => c.header))
      const headerRow = ws.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D9488' }, // teal-600
      }
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

      // Data rows
      data.forEach(row =>
        ws.addRow(columns.map(col => col.accessor(row) ?? ''))
      )

      // Auto-width (cap at 60)
      ws.columns.forEach(col => {
        let max = 10
        col.eachCell?.({ includeEmpty: false }, cell => {
          const len = String(cell.value ?? '').length
          if (len > max) max = len
        })
        col.width = Math.min(max + 2, 60)
      })

      // Write to buffer → Blob → download
      const buffer = await wb.xlsx.writeBuffer()
      const blob   = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href     = url
      link.download = `${filename}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading || data.length === 0}
      title="Exportar a Excel"
      className={
        className ??
        'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
      }
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Excel
    </button>
  )
}
