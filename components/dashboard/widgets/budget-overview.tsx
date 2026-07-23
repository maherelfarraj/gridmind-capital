'use client'
import * as React from 'react'
import useSWR from 'swr'
import { BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import type { WidgetConfig } from './types'
import { getBudgetOverview } from '@/app/actions/dashboard'

export function BudgetOverviewWidget({ config }: { config: WidgetConfig }) {
  const { data: overview, isLoading } = useSWR('widget-budget', getBudgetOverview)

  // Chart rows keyed by finance record type (budget vs actual spend)
  const DATA = (overview?.groups ?? []).map((g) => ({
    phase:  g.category,
    budget: Math.round((g.planned / 1_000_000) * 10) / 10,
    actual: Math.round((g.actual  / 1_000_000) * 10) / 10,
  }))
  const totalBudget = (overview?.totalPlanned ?? 0) / 1_000_000
  const totalActual = (overview?.totalActual  ?? 0) / 1_000_000
  const pct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <BarChart2 className="size-3.5" />
          <span>Budget Overview</span>
        </div>
        <div className="flex-1 rounded-lg bg-muted/20 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <BarChart2 className="size-3.5" />
        <span>Budget Overview</span>
        <span className="ml-auto text-[10px] font-mono font-normal text-foreground">${totalActual.toFixed(0)}M / ${totalBudget.toFixed(0)}M</span>
      </div>
      {DATA.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
      ) : (
      <>
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
      </>
      )}
    </div>
  )
}
