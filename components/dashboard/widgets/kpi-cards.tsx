'use client'
import * as React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { WidgetConfig } from './types'

interface KPI { label: string; value: string; unit: string; delta: number; deltaUnit: string }

const KPIS: KPI[] = [
  { label: 'Portfolio Spend',   value: '71.2',  unit: '%',   delta: +2.1, deltaUnit: 'pts vs LM'  },
  { label: 'Avg SPI',           value: '0.94',  unit: '',    delta: -0.03, deltaUnit: 'vs baseline' },
  { label: 'Avg CPI',           value: '1.02',  unit: '',    delta: +0.04, deltaUnit: 'vs baseline' },
  { label: 'Open Defects',      value: '14',    unit: '',    delta: -3,   deltaUnit: 'vs last week' },
  { label: 'Gate Pass Rate',    value: '87',    unit: '%',   delta: +5,   deltaUnit: 'pts vs Q1'   },
  { label: 'HSE Incidents',     value: '0',     unit: '',    delta: 0,    deltaUnit: 'this month'  },
]

export function KpiCardsWidget({ config }: { config: WidgetConfig }) {
  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <TrendingUp className="size-3.5" />
        <span>KPI Cards</span>
      </div>
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
                {k.value}<span className="text-sm font-semibold text-muted-foreground">{k.unit}</span>
              </p>
              <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-1 ${dColor}`}>
                <Icon className="size-3" />
                <span>{k.delta > 0 ? '+' : ''}{k.delta}{k.deltaUnit.startsWith('pts') ? '' : ''} {k.deltaUnit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
