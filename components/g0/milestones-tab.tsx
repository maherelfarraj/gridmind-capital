'use client'
import * as React from 'react'
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_MILESTONES, MILESTONE_META } from './data'

const STATUS_ICON = {
  complete:    CheckCircle2,
  in_progress: Clock,
  at_risk:     AlertCircle,
  pending:     Circle,
}

export function MilestonesTab() {
  const complete = MOCK_MILESTONES.filter((m) => m.status === 'complete').length
  const pct      = Math.round((complete / MOCK_MILESTONES.length) * 100)

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">G0 Milestone Progress</p>
          <span className="text-sm font-bold text-foreground">{complete}/{MOCK_MILESTONES.length} complete</span>
        </div>
        <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-5 top-6 bottom-6 w-px bg-border" />
        <div className="space-y-1">
          {MOCK_MILESTONES.map((m, idx) => {
            const meta = MILESTONE_META[m.status]
            const Icon = STATUS_ICON[m.status]
            return (
              <div key={m.id} className="relative flex gap-4 pl-12 pr-4 py-3 rounded-xl hover:bg-muted/20 transition-colors group">
                {/* Node */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 bg-background z-10">
                  <Icon className="size-5" style={{ color: meta.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{m.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: meta.color, background: `${meta.color}18` }}>{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">{m.gate}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
                    <span>Target: <span className="font-mono text-foreground">{m.target_date}</span></span>
                    {m.actual_date && <span>Actual: <span className="font-mono text-green-500">{m.actual_date}</span></span>}
                    <span>Owner: {m.owner}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
