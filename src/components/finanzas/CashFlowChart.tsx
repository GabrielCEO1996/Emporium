'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface DataPoint { mes: string; ingresos: number }
interface Props { data: DataPoint[] }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      <p className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function CashFlowChart({ data }: Props) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-sm text-slate-400">Sin datos</div>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52}
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2.5}
          fill="url(#cashGradient)" dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
