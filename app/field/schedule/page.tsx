'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft, TrendingUp, Loader2, Check, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useFieldProject } from '@/components/field/field-context'
import { getSchedule, recordProgress, type ScheduleActivity } from '@/app/actions/schedule'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const STATUS_CLS: Record<string, string> = {
  completed:   'bg-emerald-500/15 text-emerald-600',
  in_progress: 'bg-primary/15 text-primary',
  not_started: 'bg-muted text-muted-foreground',
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500'
  if (pct >= 50)  return 'bg-primary'
  return 'bg-amber-400'
}

export default function FieldSchedulePage() {
  const { activeProjectId } = useFieldProject()
  const { toast } = useToast()

  const { data, isLoading, mutate } = useSWR(
    activeProjectId ? `schedule-gantt-${activeProjectId}` : null,
    () => getSchedule(activeProjectId as string),
    { revalidateOnFocus: false },
  )

  const activities = (data?.activities ?? []).filter(
    (a) => a.status !== 'completed' && Number(a.percent_complete ?? 0) < 100,
  )

  return (
    <div className="py-4">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/field/reports"
          className="flex items-center gap-1 text-sm text-muted-foreground"
          aria-label="Back to reports"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" aria-hidden="true" />
          Update Progress
        </h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <Check className="size-8 text-emerald-500/60 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">All activities up to date</p>
          <p className="text-xs text-muted-foreground mt-1">No open activities to update.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {activities.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              projectId={activeProjectId as string}
              onSaved={() => {
                mutate()
                toast({ title: 'Progress saved', variant: 'success' })
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ActivityCard({
  activity,
  projectId,
  onSaved,
}: {
  activity: ScheduleActivity
  projectId: string
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [expanded, setExpanded] = React.useState(false)
  const [pct, setPct] = React.useState(Number(activity.percent_complete ?? 0))
  const [busy, setBusy] = React.useState(false)
  const initPct = Number(activity.percent_complete ?? 0)

  const dirty = pct !== initPct

  async function save() {
    setBusy(true)
    const today = new Date().toISOString().slice(0, 10)
    const res = await recordProgress(activity.id, today, pct)
    setBusy(false)
    if (res.error) {
      toast({ title: 'Could not save', description: res.error, variant: 'danger' })
      return
    }
    onSaved()
    setExpanded(false)
  }

  const statusKey = (activity.status ?? 'not_started') as string
  const statusCls = STATUS_CLS[statusKey] ?? STATUS_CLS.not_started

  return (
    <li className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-3.5 text-start active:bg-muted/30"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {activity.activity_code && (
              <span className="text-[10px] font-mono font-medium text-muted-foreground">
                {activity.activity_code}
              </span>
            )}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                statusCls,
              )}
            >
              {statusKey.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-foreground leading-snug">
            {activity.name}
          </p>
          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all', pctColor(pct))}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs font-semibold tabular-nums text-foreground">
              {pct}%
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {/* Expanded: slider + save */}
      {expanded && (
        <div className="border-t border-border px-4 py-4">
          {/* Snap buttons: 0 / 25 / 50 / 75 / 100 */}
          <div className="mb-3 flex justify-between">
            {[0, 25, 50, 75, 100].map((snap) => (
              <button
                key={snap}
                type="button"
                onClick={() => setPct(snap)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  pct === snap
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {snap}%
              </button>
            ))}
          </div>

          {/* Fine-grained slider */}
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-full accent-primary"
            aria-label={`Progress for ${activity.name}`}
          />

          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Save {pct}%
          </button>
        </div>
      )}
    </li>
  )
}
