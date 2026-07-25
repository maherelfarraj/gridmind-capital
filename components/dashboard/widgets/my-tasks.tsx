'use client'
import * as React from 'react'
import useSWR from 'swr'
import { CheckSquare, Clock, AlertCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './types'
import { getMyTasks } from '@/app/actions/dashboard'

const P_META = {
  high:   { label: 'High',   color: 'text-red-500',    bg: 'bg-red-500/10'    },
  medium: { label: 'Medium', color: 'text-amber-500',  bg: 'bg-amber-500/10'  },
  low:    { label: 'Low',    color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
}

/**
 * `t.priority` is database-sourced, so the `as keyof typeof` cast did not make
 * the lookup safe — an unmapped priority returned undefined and threw.
 */
function priorityMeta(priority: string | null | undefined) {
  return (
    P_META[priority as keyof typeof P_META] ?? {
      label: priority ? priority.replace(/_/g, ' ') : 'None',
      color: 'text-slate-400',
      bg:    'bg-slate-500/10',
    }
  )
}

function fmtDue(due: string | null): string {
  if (!due) return '—'
  const d = new Date(due)
  return isNaN(d.getTime()) ? '—' : d.toISOString().slice(5, 10)
}

export function MyTasksWidget({ config }: { config: WidgetConfig }) {
  const { data: TASKS, isLoading } = useSWR('widget-my-tasks', getMyTasks)
  const [done, setDone] = React.useState<string[]>([])
  const tasks = TASKS ?? []
  const open = tasks.filter(t => !done.includes(t.id)).length

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <CheckSquare className="size-3.5" />
        <span>My Tasks</span>
        <span className="ml-auto bg-primary/10 text-primary rounded-full px-1.5 text-[10px] font-medium">{open} open</span>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 overflow-auto">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-11 rounded-lg bg-muted/20 animate-pulse" />)}
        {!isLoading && tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
        )}
        {tasks.map((t) => {
          const isDone = done.includes(t.id)
          const p = priorityMeta(t.priority)
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
                <span className="font-mono">{fmtDue(t.due)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
