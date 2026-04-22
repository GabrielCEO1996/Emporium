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
      // ExcelJS works in the browser when bundled by Next.js/webpack
      const ExcelJS = (await import('exceljs')).default

      const wb = new ExcelJS.Workbook()
      wb.creator  = 'Emporium'
      wb.created  = new Date()
      wb.modified = new Date()

      const ws = wb.addWorksheet(sheetName)

      // ── Column definitions (drives auto-width) ──────────────────────────────
      ws.columns = columns.map(col => ({
        header: col.header,
        key:    col.header,
        width:  Math.max(col.header.length + 4, 14),
      }))

      // ── Header row styling ──────────────────────────────────────────────────
      const headerRow = ws.getRow(1)
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.fill = {
          type:    'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0D9488' },   // teal-600
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF0F766E' } },
        }
      })
      headerRow.height = 22

      // ── Data rows ────────────────────────────────────────────────────────────
      data.forEach((row, rowIdx) => {
        const values = columns.map(col => col.accessor(row) ?? '')
        const dataRow = ws.addRow(values)

        // Alternating row fill
        if (rowIdx % 2 === 1) {
          dataRow.eachCell(cell => {
            cell.fill = {
              type:    'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF0FDFA' },  // teal-50
            }
          })
        }
        dataRow.eachCell(cell => {
          cell.alignment = { vertical: 'middle' }
        })
      })

      // ── Generate buffer and trigger download ─────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer()
      const blob   = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `${filename}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[ExportExcelButton]', err)
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
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Download className="h-4 w-4" />
      }
      Excel
    </button>
  )
}
