'use client'
import * as React from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Zap, ArrowUpRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './types'
import { getEnergyDashboard } from '@/app/actions/energy'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pctColor(pct: number): { ring: string; fill: string; text: string } {
  if (pct >= 100) return { ring: 'stroke-emerald-200 dark:stroke-emerald-900/40', fill: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
  if (pct >=  90) return { ring: 'stroke-amber-200  dark:stroke-amber-900/40',   fill: 'stroke-amber-400',   text: 'text-amber-600  dark:text-amber-400'  }
  return              { ring: 'stroke-red-200    dark:stroke-red-900/40',    fill: 'stroke-red-500',     text: 'text-red-600    dark:text-red-400'    }
}

interface GaugeProps {
  pct:   number   // 0-100+ clamped to 0-100 for display
  size?: number   // svg viewBox dimension
}

function P50Gauge({ pct, size = 120 }: GaugeProps) {
  const radius      = 44
  const cx          = size / 2
  const cy          = size / 2
  const circumference = 2 * Math.PI * radius
  // Full-circle gauge: progress from top (rotate -90deg via transform)
  const filled      = Math.min(pct, 100) / 100
  const dashOffset  = circumference * (1 - filled)
  const colors      = pctColor(pct)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct.toFixed(0)}% of P50`}>
      {/* Background ring */}
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        strokeWidth={10}
        className={colors.ring}
      />
      {/* Progress arc */}
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        strokeWidth={10}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        className={cn('transition-all duration-700', colors.fill)}
      />
      {/* Centre label */}
      <text
        x={cx} y={cy - 5}
        textAnchor="middle" dominantBaseline="middle"
        className="fill-foreground font-bold"
        style={{ fontSize: 18, fontWeight: 700, fontFamily: 'inherit' }}
      >
        {pct >= 1000 ? '999+' : pct.toFixed(0)}%
      </text>
      <text
        x={cx} y={cy + 14}
        textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 9, fontFamily: 'inherit', fill: 'hsl(var(--muted-foreground))' }}
      >
        of P50
      </text>
    </svg>
  )
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function EnergyYieldWidget({ config }: { config: WidgetConfig }) {
  // Resolve project: if config.projectFilter is a specific projectId, use it;
  // otherwise fall back to the first project returned by the action.
  const projectId = config.projectFilter !== 'all' ? config.projectFilter : null

  const { data, isLoading } = useSWR(
    projectId ? `widget-energy-yield-${projectId}` : null,
    () => getEnergyDashboard(projectId as string),
    { refreshInterval: 5 * 60 * 1_000 },   // 5-minute refresh
  )

  const kpis    = data?.kpis
  const mtd     = kpis?.mtd_actual     ?? 0
  const pctP50  = kpis?.pct_of_p50     ?? 0
  const colors  = pctColor(pctP50)

  return (
    <div className="flex flex-col h-full p-4 gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Zap className="size-3.5 text-teal-500" aria-hidden />
        <span>Energy Yield</span>
      </div>

      {/* No project configured */}
      {!projectId && (
        <div className="flex-1 flex items-center justify-center text-center px-2">
          <p className="text-xs text-muted-foreground leading-snug">
            Select a project in widget settings to show live energy data.
          </p>
        </div>
      )}

      {/* Loading */}
      {projectId && isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-5 text-muted-foreground animate-spin" aria-hidden />
        </div>
      )}

      {/* No data */}
      {projectId && !isLoading && !kpis && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Zap className="size-6 text-muted-foreground/30" aria-hidden />
          <p className="text-xs text-muted-foreground text-center">No production data logged yet.</p>
          <Link
            href={`/projects/${projectId}/energy`}
            className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
          >
            Open energy page <ArrowUpRight className="size-3" />
          </Link>
        </div>
      )}

      {/* Live data */}
      {projectId && !isLoading && kpis && (
        <div className="flex-1 flex flex-col items-center justify-center gap-1">
          <P50Gauge pct={pctP50} size={110} />

          {/* MTD production */}
          <div className="text-center mt-1">
            <p className={cn('text-base font-bold tabular-nums leading-tight', colors.text)}>
              {mtd >= 1000 ? `${(mtd / 1000).toFixed(1)} GWh` : `${mtd.toFixed(1)} MWh`}
            </p>
            <p className="text-[10px] text-muted-foreground">MTD production</p>
          </div>

          {/* Availability + curtailment pills */}
          <div className="flex gap-2 mt-1">
            {kpis.availability_avg > 0 && (
              <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                Avail {kpis.availability_avg.toFixed(1)}%
              </span>
            )}
            {kpis.curtailment_total > 0 && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/20 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">
                Curt {kpis.curtailment_total.toFixed(1)} MWh
              </span>
            )}
          </div>

          <Link
            href={`/projects/${projectId}/energy`}
            className="mt-1.5 text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors"
            aria-label="Open energy dashboard"
          >
            View dashboard <ArrowUpRight className="size-2.5" aria-hidden />
          </Link>
        </div>
      )}
    </div>
  )
}
