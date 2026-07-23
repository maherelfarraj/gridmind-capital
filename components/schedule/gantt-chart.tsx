'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CalendarRange, Loader2 } from 'lucide-react'
import type { ScheduleActivity, ActivityDependency } from '@/app/actions/schedule'

// ─── Layout constants ───────────────────────────────────────────
const LEFT_W = 300
const ROW_H = 36
const HEADER_H = 44
const MIN_BAR = 6
const MS_DAY = 86_400_000

// Palette — matches the app's navy/mint/teal system
const COLOR = {
  critical:   '#dc2626', // red-600
  completed:  '#16a34a', // green-600
  inProgress: '#0d9488', // teal-600
  notStarted: '#cbd5e1', // gray-300 (used as outline)
  today:      '#ef4444',
  arrow:      '#94a3b8',
}

type Scale = 'day' | 'week' | 'month'

function parse(iso: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00Z' : ''))
  return isNaN(d.getTime()) ? null : d
}

function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Pick a color for a bar based on status + criticality. */
function barColor(a: ScheduleActivity): string {
  if (a.is_critical) return COLOR.critical
  const pct = Number(a.percent_complete ?? 0)
  if (a.status === 'completed' || pct >= 100) return COLOR.completed
  if (pct > 0 || a.status === 'in_progress') return COLOR.inProgress
  return COLOR.notStarted
}

/** WBS indent level = number of dot segments in the code (e.g. 1.2.3 → level 2). */
function wbsLevel(code: string | null): number {
  if (!code) return 0
  const dots = code.split('.').length - 1
  return Math.min(dots, 4)
}

export function GanttChart({
  activities,
  dependencies,
  selectedId,
  onSelect,
  onSeed,
  seeding,
}: {
  activities: ScheduleActivity[]
  dependencies: ActivityDependency[]
  selectedId: string | null
  onSelect: (id: string) => void
  onSeed: () => void
  seeding: boolean
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)

  // ── Empty state ──
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/40 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <CalendarRange className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">No schedule yet</p>
          <p className="text-xs text-muted-foreground">Generate the standard PV + BESS template to get started.</p>
        </div>
        <Button size="sm" onClick={onSeed} disabled={seeding}>
          {seeding ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Generate the standard template
        </Button>
      </div>
    )
  }

  // ── Compute the date window ──
  const bounds = activities.reduce(
    (acc, a) => {
      const s = parse(a.planned_start)
      const f = parse(a.planned_finish)
      if (s) acc.min = Math.min(acc.min, startOfDayUTC(s))
      if (f) acc.max = Math.max(acc.max, startOfDayUTC(f))
      return acc
    },
    { min: Infinity, max: -Infinity },
  )

  const hasDates = Number.isFinite(bounds.min) && Number.isFinite(bounds.max)
  // Pad the window by a few days on each side for breathing room.
  const minMs = hasDates ? bounds.min - 3 * MS_DAY : startOfDayUTC(new Date())
  const maxMs = hasDates ? bounds.max + 3 * MS_DAY : minMs + 30 * MS_DAY
  const totalDays = Math.max(1, Math.round((maxMs - minMs) / MS_DAY))

  // ── Auto-scale ──
  const scale: Scale = totalDays < 90 ? 'day' : totalDays < 548 ? 'week' : 'month'
  const pxPerDay = scale === 'day' ? 22 : scale === 'week' ? 7 : 2.6
  const totalWidth = Math.round(totalDays * pxPerDay)

  const xForMs = (ms: number) => ((ms - minMs) / MS_DAY) * pxPerDay
  const xForDate = (iso: string | null) => {
    const d = parse(iso)
    return d ? xForMs(startOfDayUTC(d)) : null
  }

  // ── Timeline ticks ──
  const ticks: { x: number; label: string; major: boolean }[] = []
  {
    const cursor = new Date(minMs)
    if (scale === 'day') {
      cursor.setUTCHours(0, 0, 0, 0)
      while (startOfDayUTC(cursor) <= maxMs) {
        const ms = startOfDayUTC(cursor)
        const isMonthStart = cursor.getUTCDate() === 1
        ticks.push({
          x: xForMs(ms),
          label: isMonthStart
            ? cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
            : String(cursor.getUTCDate()),
          major: isMonthStart,
        })
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    } else if (scale === 'week') {
      // Snap to Monday
      const day = cursor.getUTCDay()
      cursor.setUTCDate(cursor.getUTCDate() - ((day + 6) % 7))
      while (startOfDayUTC(cursor) <= maxMs) {
        const ms = startOfDayUTC(cursor)
        ticks.push({
          x: xForMs(ms),
          label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
          major: cursor.getUTCDate() <= 7,
        })
        cursor.setUTCDate(cursor.getUTCDate() + 7)
      }
    } else {
      cursor.setUTCDate(1)
      while (startOfDayUTC(cursor) <= maxMs) {
        const ms = startOfDayUTC(cursor)
        ticks.push({
          x: xForMs(ms),
          label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
          major: cursor.getUTCMonth() === 0,
        })
        cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      }
    }
  }

  // ── Row index lookup for dependency arrows ──
  const rowIndex = new Map(activities.map((a, i) => [a.id, i]))

  const todayX = (() => {
    const ms = startOfDayUTC(new Date())
    return ms >= minMs && ms <= maxMs ? xForMs(ms) : null
  })()

  const bodyHeight = activities.length * ROW_H

  // ── Dependency arrow paths (FS-style routing for all types) ──
  const arrows: string[] = []
  for (const dep of dependencies) {
    const pi = rowIndex.get(dep.predecessor_id)
    const si = rowIndex.get(dep.successor_id)
    if (pi === undefined || si === undefined) continue
    const pred = activities[pi]
    const succ = activities[si]
    const px = xForDate(pred.planned_finish)
    const sx = xForDate(succ.planned_start)
    if (px === null || sx === null) continue
    const py = pi * ROW_H + ROW_H / 2
    const sy = si * ROW_H + ROW_H / 2
    const midX = Math.max(px + 8, sx - 12)
    arrows.push(`M ${px} ${py} L ${midX} ${py} L ${midX} ${sy} L ${sx - 6} ${sy}`)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex">
        {/* ── Left pane (fixed) ── */}
        <div className="shrink-0 border-r border-border" style={{ width: LEFT_W }}>
          <div
            className="flex items-center border-b border-border bg-muted/40 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            style={{ height: HEADER_H }}
          >
            Activity
          </div>
          {activities.map((a) => {
            const pct = Math.round(Number(a.percent_complete ?? 0))
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelect(a.id)}
                onMouseEnter={() => setHoveredId(a.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={cn(
                  'flex w-full items-center gap-2 border-b border-border/60 px-3 text-left transition-colors',
                  hoveredId === a.id && 'bg-muted/50',
                  selectedId === a.id && 'bg-[#64ffda]/10',
                )}
                style={{ height: ROW_H }}
              >
                <span className="w-14 shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                  {a.activity_code ?? '—'}
                </span>
                <span
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-foreground"
                  style={{ paddingLeft: wbsLevel(a.activity_code) * 12 }}
                >
                  {a.is_milestone && <span className="size-2 shrink-0 rotate-45 bg-foreground/70" aria-hidden />}
                  {a.is_critical && !a.is_milestone && (
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR.critical }} aria-hidden />
                  )}
                  <span className="truncate" title={a.name}>{a.name}</span>
                </span>
                <span
                  className={cn(
                    'w-9 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold tabular-nums',
                    pct >= 100 ? 'text-[#16a34a]' : pct > 0 ? 'text-[#0d9488]' : 'text-muted-foreground',
                  )}
                >
                  {pct}%
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Right pane (scrollable timeline) ── */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ width: totalWidth, minWidth: '100%' }}>
            {/* Timeline header */}
            <div className="relative border-b border-border bg-muted/40" style={{ height: HEADER_H }}>
              {ticks.map((t, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex h-full flex-col justify-center border-l"
                  style={{
                    left: t.x,
                    borderColor: t.major ? 'var(--border)' : 'transparent',
                  }}
                >
                  <span
                    className={cn(
                      'whitespace-nowrap pl-1 text-[10px]',
                      t.major ? 'font-semibold text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {t.label}
                  </span>
                </div>
              ))}
              {todayX !== null && (
                <span
                  className="absolute top-0.5 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold"
                  style={{ left: todayX, color: COLOR.today }}
                >
                  Today
                </span>
              )}
            </div>

            {/* Body */}
            <div className="relative" style={{ height: bodyHeight }}>
              {/* Gridlines for major ticks */}
              {ticks.filter((t) => t.major).map((t, i) => (
                <div
                  key={`grid-${i}`}
                  className="absolute top-0 border-l border-border/40"
                  style={{ left: t.x, height: bodyHeight }}
                  aria-hidden
                />
              ))}

              {/* Dependency arrows */}
              {arrows.length > 0 && (
                <svg
                  className="pointer-events-none absolute inset-0 z-10"
                  width={totalWidth}
                  height={bodyHeight}
                  aria-hidden
                >
                  <defs>
                    <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill={COLOR.arrow} />
                    </marker>
                  </defs>
                  {arrows.map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill="none"
                      stroke={COLOR.arrow}
                      strokeWidth={1.25}
                      markerEnd="url(#gantt-arrow)"
                    />
                  ))}
                </svg>
              )}

              {/* Today line */}
              {todayX !== null && (
                <div
                  className="absolute top-0 z-20 border-l border-dashed"
                  style={{ left: todayX, height: bodyHeight, borderColor: COLOR.today }}
                  aria-hidden
                />
              )}

              {/* Rows with bars */}
              {activities.map((a, i) => {
                const color = barColor(a)
                const startX = xForDate(a.planned_start)
                const finishX = xForDate(a.planned_finish)
                const pct = Math.max(0, Math.min(100, Number(a.percent_complete ?? 0)))
                const isMilestone = !!a.is_milestone
                const notStarted = !a.is_critical && a.status !== 'completed' && pct <= 0

                return (
                  <div
                    key={a.id}
                    onMouseEnter={() => setHoveredId(a.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onSelect(a.id)}
                    className={cn(
                      'absolute left-0 w-full cursor-pointer border-b border-border/40 transition-colors',
                      hoveredId === a.id && 'bg-muted/40',
                      selectedId === a.id && 'bg-[#64ffda]/5',
                    )}
                    style={{ top: i * ROW_H, height: ROW_H }}
                  >
                    {isMilestone && startX !== null ? (
                      <span
                        className="absolute top-1/2 z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-background shadow-sm"
                        style={{ left: startX, backgroundColor: color }}
                        title={`${a.name} — ${a.planned_start ?? ''}`}
                        aria-label={`Milestone ${a.name}`}
                      />
                    ) : startX !== null && finishX !== null ? (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 overflow-hidden rounded"
                        style={{
                          left: startX,
                          width: Math.max(MIN_BAR, finishX - startX),
                          height: 16,
                          backgroundColor: notStarted ? 'transparent' : `${color}33`,
                          border: notStarted ? `1.5px solid ${color}` : `1px solid ${color}`,
                        }}
                        title={`${a.name} · ${a.planned_start ?? ''} → ${a.planned_finish ?? ''} · ${Math.round(pct)}%`}
                      >
                        <div
                          className="h-full rounded-l"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: `${COLOR.inProgress}33`, border: `1px solid ${COLOR.inProgress}` }} /> In progress</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: `${COLOR.completed}33`, border: `1px solid ${COLOR.completed}` }} /> Completed</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: `${COLOR.critical}33`, border: `1px solid ${COLOR.critical}` }} /> Critical</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded" style={{ border: `1.5px solid ${COLOR.notStarted}` }} /> Not started</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rotate-45 bg-foreground/70" /> Milestone</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-px border-l border-dashed" style={{ borderColor: COLOR.today }} /> Today</span>
      </div>
    </div>
  )
}
