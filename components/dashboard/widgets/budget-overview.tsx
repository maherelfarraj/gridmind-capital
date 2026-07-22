'use client'
import * as React from 'react'
import { BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import type { WidgetConfig } from './types'

const DATA = [
  { phase: 'G0',  budget: 2.1,  actual: 1.9  },
  { phase: 'G1',  budget: 8.4,  actual: 8.7  },
  { phase: 'G2',  budget: 22.0, actual: 19.8 },
  { phase: 'G3',  budget: 45.0, actual: 38.2 },
  { phase: 'G4',  budget: 180,  actual: 142  },
  { phase: 'G5',  budget: 12.0, actual: 9.1  },
]

export function BudgetOverviewWidget({ config }: { config: WidgetConfig }) {
  const totalBudget = DATA.reduce((s, d) => s + d.budget, 0)
  const totalActual = DATA.reduce((s, d) => s + d.actual, 0)
  const pct = Math.round((totalActual / totalBudget) * 100)

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <BarChart2 className="size-3.5" />
        <span>Budget Overview</span>
        <span className="ml-auto text-[10px] font-mono font-normal text-foreground">${totalActual.toFixed(0)}M / ${totalBudget.toFixed(0)}M</span>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total Budget',  value: `$${totalBudget.toFixed(0)}M`, color: 'text-foreground' },
          { label: 'Actual Spend',  value: `$${totalActual.toFixed(0)}M`, color: pct > 100 ? 'text-red-500' : 'text-green-500' },
          { label: 'Utilisation',   value: `${pct}%`,                      color: pct > 100 ? 'text-red-500' : pct > 85 ? 'text-amber-500' : 'text-green-500' },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-muted/20 px-2 py-1.5 text-center">
            <p className={`text-sm font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barGap={2}>
            <XAxis dataKey="phase" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }}
              formatter={(v) => [`$${v}M`, '']}
            />
            <Bar dataKey="budget"  name="Budget" fill="#3b82f680" radius={[3,3,0,0]} />
            <Bar dataKey="actual"  name="Actual" radius={[3,3,0,0]}>
              {DATA.map((d, i) => (
                <Cell key={i} fill={d.actual > d.budget ? '#ef4444' : '#22c55e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
