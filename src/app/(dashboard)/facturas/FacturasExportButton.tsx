'use client'

import ExportExcelButton from '@/components/ui/ExportExcelButton'
import { formatDate, ESTADO_FACTURA_LABELS } from '@/lib/utils'
import type { Factura } from '@/lib/types'

interface Props {
  data: (Factura & { cliente?: { nombre?: string; rif?: string } | null })[]
}

const COLUMNS = [
  { header: 'N° Factura',   accessor: (f: any) => f.numero },
  { header: 'Cliente',      accessor: (f: any) => f.cliente?.nombre ?? '' },
  { header: 'Fecha Emisión',accessor: (f: any) => formatDate(f.fecha_emision) },
  { header: 'Vencimiento',  accessor: (f: any) => f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : '' },
  { header: 'Estado',       accessor: (f: any) => ESTADO_FACTURA_LABELS[f.estado] ?? f.estado },
  { header: 'Total',        accessor: (f: any) => f.total },
  { header: 'Monto Pagado', accessor: (f: any) => f.monto_pagado ?? 0 },
]

export default function FacturasExportButton({ data }: Props) {
  return (
    <ExportExcelButton
      data={data}
      filename="facturas"
      sheetName="Facturas"
      columns={COLUMNS}
    />
  )
}
