'use client'

import ExportExcelButton from '@/components/ui/ExportExcelButton'
import { formatDate, ESTADO_PEDIDO_LABELS } from '@/lib/utils'

const COLUMNS = [
  { header: 'N° Pedido',      accessor: (p: any) => p.numero },
  { header: 'Cliente',        accessor: (p: any) => p.cliente?.nombre ?? '' },
  { header: 'Estado',         accessor: (p: any) => ESTADO_PEDIDO_LABELS[p.estado] ?? p.estado },
  { header: 'Fecha Pedido',   accessor: (p: any) => formatDate(p.fecha_pedido) },
  { header: 'Fecha Entrega',  accessor: (p: any) => p.fecha_entrega_estimada ? formatDate(p.fecha_entrega_estimada) : '' },
  { header: 'Subtotal',       accessor: (p: any) => p.subtotal },
  { header: 'Descuento',      accessor: (p: any) => p.descuento },
  { header: 'Total',          accessor: (p: any) => p.total },
]

export default function PedidosExportButton({ data }: { data: any[] }) {
  return (
    <ExportExcelButton
      data={data}
      filename="pedidos"
      sheetName="Pedidos"
      columns={COLUMNS}
    />
  )
}
