'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DayData {
  dia: string       // "Lun", "Mar", etc.
  total: number
}

interface Props {
  data: DayData[]
}

function formatK(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 text-white rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold">{label}</p>
      <p className="text-teal-300">${payload[0].value.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
    </div>
  )
}

export default function VentasChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
        Sin datos de ventas
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="dia"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0f9ff', radius: 6 }} />
        <Bar dataKey="total" fill="#1e4db7" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}
