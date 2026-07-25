'use client'
import * as React from 'react'
import useSWR from 'swr'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { WidgetConfig } from './types'
import { getWidgetStats } from '@/app/actions/dashboard'
import { useDigitStyle } from '@/lib/session-context'
import { toLocaleDigits } from '@/lib/digits'

interface KPI { label: string; value: string; unit: string; delta: number; deltaUnit: string }

export function KpiCardsWidget({ config }: { config: WidgetConfig }) {
  const { data: stats, isLoading } = useSWR('widget-stats', getWidgetStats)
  const digitStyle = useDigitStyle()

  const KPIS: KPI[] = stats ? [
    { label: 'Active Projects', value: `${stats.activeProjects}`,                     unit: '',  delta: 0, deltaUnit: 'in portfolio' },
    { label: 'Total Budget',    value: `${(stats.totalBudget / 1_000_000).toFixed(0)}`, unit: 'M', delta: 0, deltaUnit: 'USD committed' },
    { label: 'Open Approvals',  value: `${stats.openApprovals}`,                      unit: '',  delta: 0, deltaUnit: 'awaiting action' },
    { label: 'Open Risks',      value: `${stats.openRisks}`,                          unit: '',  delta: 0, deltaUnit: 'active' },
    { label: 'Avg Health',      value: `${stats.avgHealth}`,                          unit: '%', delta: 0, deltaUnit: 'portfolio' },
  ] : []

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <TrendingUp className="size-3.5" />
          <span>KPI Cards</span>
        </div>
        <div className="grid grid-cols-3 gap-2 flex-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/10 h-20 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <TrendingUp className="size-3.5" />
        <span>KPI Cards</span>
      </div>
      {KPIS.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
      ) : (
      <div className="grid grid-cols-3 gap-2 flex-1">
        {KPIS.map((k) => {
          const isGood = (k.label === 'Open Defects' || k.label === 'HSE Incidents')
            ? k.delta <= 0
            : k.delta >= 0
          const Icon = k.delta > 0 ? TrendingUp : k.delta < 0 ? TrendingDown : Minus
          const dColor = k.delta === 0 ? 'text-muted-foreground' : isGood ? 'text-green-500' : 'text-red-500'
          return (
            <div key={k.label} className="rounded-xl border border-border bg-muted/10 px-3 py-2.5 flex flex-col justify-between">
              <p className="text-[10px] text-muted-foreground font-medium leading-tight">{k.label}</p>
              <p className="text-xl font-black text-foreground mt-1">
                {toLocaleDigits(k.value, digitStyle)}<span className="text-sm font-semibold text-muted-foreground">{toLocaleDigits(k.unit, digitStyle)}</span>
              </p>
              <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-1 ${dColor}`}>
                <Icon className="size-3" />
                <span>{k.delta > 0 ? '+' : ''}{toLocaleDigits(String(k.delta), digitStyle)}{k.deltaUnit.startsWith('pts') ? '' : ''} {k.deltaUnit}</span>
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
