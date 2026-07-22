'use client'
import * as React from 'react'
import { CheckSquare, Clock, AlertCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './types'

const TASKS = [
  { id: 't1', title: 'Review G3 Convene Package',   project: 'Sirius 400MW',  priority: 'high',   due: '2026-07-23', done: false },
  { id: 't2', title: 'Sign off IPA-03 application', project: 'Lyra Grid',     priority: 'high',   due: '2026-07-24', done: false },
  { id: 't3', title: 'Approve earthing design',     project: 'Vega BESS',     priority: 'medium', due: '2026-07-25', done: false },
  { id: 't4', title: 'Upload HSE induction records',project: 'Helios Sub',    priority: 'low',    due: '2026-07-28', done: true  },
  { id: 't5', title: 'Confirm milestone MS-14',     project: 'Orion Wind',    priority: 'medium', due: '2026-07-30', done: false },
]

const P_META = {
  high:   { label: 'High',   color: 'text-red-500',    bg: 'bg-red-500/10'    },
  medium: { label: 'Medium', color: 'text-amber-500',  bg: 'bg-amber-500/10'  },
  low:    { label: 'Low',    color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
}

export function MyTasksWidget({ config }: { config: WidgetConfig }) {
  const [done, setDone] = React.useState<string[]>(TASKS.filter(t => t.done).map(t => t.id))
  const open = TASKS.filter(t => !done.includes(t.id)).length

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <CheckSquare className="size-3.5" />
        <span>My Tasks</span>
        <span className="ml-auto bg-primary/10 text-primary rounded-full px-1.5 text-[10px] font-medium">{open} open</span>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 overflow-auto">
        {TASKS.map((t) => {
          const isDone = done.includes(t.id)
          const p = P_META[t.priority as keyof typeof P_META]
          return (
            <div key={t.id} className={cn('flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-all', isDone ? 'opacity-40' : 'hover:bg-muted/30')}>
              <button
                onClick={() => setDone(d => isDone ? d.filter(x => x !== t.id) : [...d, t.id])}
                className="mt-0.5 flex-shrink-0"
              >
                {isDone
                  ? <CheckSquare className="size-4 text-green-500" />
                  : <Circle className="size-4 text-muted-foreground hover:text-primary transition-colors" />
                }
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-medium text-foreground leading-snug', isDone && 'line-through')}>{t.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{t.project}</span>
                  <span className={cn('text-[10px] font-semibold px-1 rounded', p.color, p.bg)}>{p.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
                <Clock className="size-3" />
                <span className="font-mono">{t.due.slice(5)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
