'use client'
import * as React from 'react'
import useSWR from 'swr'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './types'
import { getRiskHeatmap } from '@/app/actions/dashboard'

// [probability 1-3][impact 1-3] → color
const CELL_COLOR = [
  ['#22c55e40', '#f59e0b40', '#ef444440'],  // P=3 (High)
  ['#22c55e30', '#22c55e40', '#f59e0b40'],  // P=2 (Med)
  ['#22c55e20', '#22c55e30', '#22c55e40'],  // P=1 (Low)
]

export function RiskHeatmapWidget({ config }: { config: WidgetConfig }) {
  const { data, isLoading } = useSWR('widget-risk-heatmap', getRiskHeatmap)
  const RISKS = data ?? []

  const cellRisks = (p: number, i: number) =>
    RISKS.filter(r => r.p === p && r.i === i)

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <AlertTriangle className="size-3.5" />
        <span>Risk Heatmap</span>
        <span className="ml-auto bg-red-500/10 text-red-500 rounded-full px-1.5 text-[10px] font-medium">
          {RISKS.filter(r => r.p === 3 || r.i === 3).length} critical
        </span>
      </div>
      {!isLoading && RISKS.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
      )}
      {(isLoading || RISKS.length > 0) && (
      /* 3×3 grid */
      <div className="flex-1 flex flex-col gap-1">
        {/* Y-axis label row */}
        <div className="grid grid-cols-4 gap-1 text-[9px] text-muted-foreground mb-1">
          <div className="text-center col-span-1 flex items-end justify-center pb-0.5">P ↑</div>
          {['Low', 'Med', 'High'].map(l => (
            <div key={l} className="text-center font-semibold">{l}</div>
          ))}
        </div>
        {[3,2,1].map((p) => (
          <div key={p} className="grid grid-cols-4 gap-1 flex-1">
            <div className="flex items-center justify-center text-[9px] text-muted-foreground font-semibold">
              {p === 3 ? 'H' : p === 2 ? 'M' : 'L'}
            </div>
            {[1,2,3].map((i) => {
              const risks = cellRisks(p, i)
              return (
                <div key={i}
                  className="rounded-md flex flex-col items-center justify-center gap-0.5 min-h-0 cursor-default relative group"
                  style={{ background: CELL_COLOR[3-p][i-1] }}>
                  {risks.length > 0 && (
                    <>
                      <span className="text-[10px] font-bold text-foreground">{risks.length}</span>
                      {/* tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col gap-0.5 bg-card border border-border rounded-lg px-2.5 py-1.5 shadow-lg z-50 min-w-max">
                        {risks.map(r => <span key={r.id} className="text-[10px] text-foreground">{r.label}</span>)}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {/* X-axis */}
        <div className="grid grid-cols-4 gap-1 text-[9px] text-muted-foreground mt-1">
          <div />
          {['Low','Med','High'].map(l => <div key={l} className="text-center font-semibold">{l}</div>)}
        </div>
        <div className="text-center text-[9px] text-muted-foreground">Impact →</div>
      </div>
      )}
    </div>
  )
}
