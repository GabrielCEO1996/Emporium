'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface DataPoint { nombre: string; margen: number; revenue: number }
interface Props { data: DataPoint[] }

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1 max-w-[160px] truncate">{d.nombre}</p>
      <p className={`font-bold ${d.margen >= 30 ? 'text-emerald-600' : d.margen >= 20 ? 'text-amber-600' : 'text-red-500'}`}>
        Margen: {d.margen.toFixed(1)}%
      </p>
    </div>
  )
}

function getColor(margen: number) {
  if (margen >= 30) return '#10b981'
  if (margen >= 20) return '#f59e0b'
  return '#ef4444'
}

export default function MargenesChart({ data }: Props) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-sm text-slate-400">Sin datos de productos</div>
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          tickFormatter={v => `${v}%`} domain={[0, 100]} />
        <YAxis type="category" dataKey="nombre" width={120}
          tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
          tickFormatter={v => v.length > 16 ? v.slice(0, 16) + '…' : v} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="margen" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => <Cell key={i} fill={getColor(d.margen)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
