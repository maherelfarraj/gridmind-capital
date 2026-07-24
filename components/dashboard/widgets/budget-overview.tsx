'use client'
import * as React from 'react'
import useSWR from 'swr'
import { BarChart2 } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import type { WidgetConfig } from './types'
import { getPortfolioCostExposure } from '@/app/actions/payments'
import { useDigitStyle } from '@/lib/session-context'
import { toLocaleDigits } from '@/lib/digits'

export function BudgetOverviewWidget({ config: _config }: { config: WidgetConfig }) {
  const { data: exposure, isLoading } = useSWR('widget-cost-exposure', getPortfolioCostExposure)
  const digitStyle = useDigitStyle()

  // Per-project chart rows: contract value (bar) + pending VO exposure (line), in $M.
  const DATA = (exposure?.projects ?? []).map((p) => ({
    code:      p.code,
    contract:  Math.round((p.contractValue / 1_000_000) * 10) / 10,
    exposure:  Math.round((p.pendingVoImpact / 1_000_000) * 10) / 10,
    certified: p.certifiedPct,
  }))

  const totalContract = (exposure?.totals.contractValue ?? 0) / 1_000_000
  const certifiedPct  = exposure?.totals.certifiedPct ?? 0
  const totalExposure = (exposure?.totals.pendingVoImpact ?? 0) / 1_000_000

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <BarChart2 className="size-3.5" />
          <span>Cost Exposure</span>
        </div>
        <div className="flex-1 rounded-lg bg-muted/20 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <BarChart2 className="size-3.5" />
        <span>Cost Exposure</span>
        <span className="ms-auto text-[10px] font-mono font-normal text-foreground">${toLocaleDigits(totalContract.toFixed(0), digitStyle)}M contract</span>
      </div>
      {DATA.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
      ) : (
      <>
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Contract Value', value: `$${toLocaleDigits(totalContract.toFixed(0), digitStyle)}M`, color: 'text-foreground' },
          { label: '% Certified',    value: `${toLocaleDigits(certifiedPct.toFixed(0), digitStyle)}%`,   color: certifiedPct >= 100 ? 'text-red-500' : certifiedPct >= 85 ? 'text-amber-500' : 'text-green-500' },
          { label: 'Exposure',       value: `$${toLocaleDigits(totalExposure.toFixed(1), digitStyle)}M`, color: totalExposure > 0 ? 'text-amber-500' : 'text-green-500' },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-muted/20 px-2 py-1.5 text-center">
            <p className={`text-sm font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={DATA} margin={{ top: 4, right: 0, bottom: 0, left: -20 }} barGap={2}>
            <XAxis dataKey="code" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }}
              formatter={(v, name) => [`$${v}M`, name === 'contract' ? 'Contract' : 'Exposure']}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="contract" name="Contract" fill="#3b82f680" radius={[3,3,0,0]}>
              {DATA.map((d, i) => (
                <Cell key={i} fill={d.certified >= 100 ? '#ef444480' : '#3b82f680'} />
              ))}
            </Bar>
            <Line dataKey="exposure" name="Exposure" type="monotone" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      </>
      )}
    </div>
  )
}
