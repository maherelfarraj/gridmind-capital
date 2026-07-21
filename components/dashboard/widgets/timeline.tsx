'use client'
import * as React from 'react'
import { CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './types'

interface Milestone { id: string; project: string; label: string; date: string; type: 'gate' | 'milestone' | 'deadline'; status: 'upcoming' | 'overdue' | 'today' }

const MILESTONES: Milestone[] = [
  { id: 'm1', project: 'Sirius 400MW',  label: 'G3 Convene',          date: '2026-07-23', type: 'gate',      status: 'today'    },
  { id: 'm2', project: 'Vega BESS',     label: 'Earthing Design Freeze', date: '2026-07-25', type: 'milestone', status: 'upcoming' },
  { id: 'm3', project: 'Lyra Grid',     label: 'G5 Final QA Sign-off',  date: '2026-07-28', type: 'gate',      status: 'upcoming' },
  { id: 'm4', project: 'Orion Wind',    label: 'Foundation Complete',   date: '2026-08-02', type: 'milestone', status: 'upcoming' },
  { id: 'm5', project: 'Helios Sub',    label: 'IPA-03 Submission',     date: '2026-07-20', type: 'deadline',  status: 'overdue'  },
  { id: 'm6', project: 'Sirius 400MW',  label: 'Module Delivery',       date: '2026-08-10', type: 'milestone', status: 'upcoming' },
]

const TYPE_COLOR: Record<Milestone['type'], string> = {
  gate:      '#6366f1',
  milestone: '#22c55e',
  deadline:  '#ef4444',
}
const STATUS_LABEL: Record<Milestone['status'], { label: string; cls: string }> = {
  today:    { label: 'Today',    cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  upcoming: { label: 'Upcoming', cls: 'bg-muted/50 text-muted-foreground border-border' },
  overdue:  { label: 'Overdue',  cls: 'bg-red-500/20 text-red-400 border-red-500/30'   },
}

export function TimelineWidget({ config }: { config: WidgetConfig }) {
  const sorted = [...MILESTONES].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <CalendarRange className="size-3.5" />
        <span>Upcoming Milestones</span>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
          {(['gate','milestone','deadline'] as Milestone['type'][]).map(t => (
            <span key={t} className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ background: TYPE_COLOR[t] }} />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </span>
          ))}
        </div>
      </div>
      {/* Gantt strip */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-1">
          {sorted.map((m) => {
            const s = STATUS_LABEL[m.status]
            return (
              <div key={m.id}
                className={cn('flex flex-col gap-1 rounded-lg border px-3 py-2 min-w-[120px] cursor-pointer hover:opacity-80 transition-opacity', s.cls)}
                style={{ borderLeftColor: TYPE_COLOR[m.type], borderLeftWidth: 3 }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLOR[m.type] }} />
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wide', s.cls.split(' ')[1])}>{s.label}</span>
                </div>
                <p className="text-xs font-semibold text-foreground leading-snug">{m.label}</p>
                <p className="text-[10px] text-muted-foreground">{m.project}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{m.date}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
