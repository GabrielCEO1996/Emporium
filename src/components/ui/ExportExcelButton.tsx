'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'

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

  const handleExport = () => {
    if (loading || data.length === 0) return
    setLoading(true)

    try {
      const rows = data.map(row =>
        Object.fromEntries(columns.map(col => [col.header, col.accessor(row) ?? '']))
      )
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
      XLSX.writeFile(wb, `${filename}.xlsx`)
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
