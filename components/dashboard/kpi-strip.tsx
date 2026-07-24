'use client'

import * as React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KpiData } from './dashboard-data'

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────

function KpiCardSkeleton() {
  return (
    <div className="relative flex flex-col gap-2 rounded-xl border border-border bg-card p-4 overflow-hidden animate-pulse">
      <div className="absolute start-0 inset-y-0 w-0.5 bg-border rounded-full" />
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="h-7 w-20 rounded bg-muted" />
      <div className="h-3 w-16 rounded bg-muted" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Single KPI card
// ─────────────────────────────────────────────────────────────

interface KpiCardProps {
  data: KpiData
  loading?: boolean
}

function KpiCard({ data, loading }: KpiCardProps) {
  if (loading) return <KpiCardSkeleton />

  const TrendIcon =
    data.trend === 'up' ? TrendingUp :
    data.trend === 'down' ? TrendingDown : Minus

  const trendColor =
    data.trend === 'up' ? 'text-[#22c55e]' :
    data.trend === 'down' ? 'text-[#f97316]' : 'text-muted-foreground'

  return (
    <article
      className={cn(
        'relative flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3.5 overflow-hidden',
        'transition-shadow duration-200 hover:shadow-md hover:shadow-black/10',
        'dark:hover:shadow-black/30 group',
      )}
      aria-label={`${data.label}: ${data.value}`}
    >
      {/* Accent border on the leading edge (left in LTR, right in RTL) */}
      <span
        className="absolute start-0 inset-y-0 w-[3px] rounded-e-full"
        style={{ backgroundColor: data.accentColor }}
        aria-hidden="true"
      />

      {/* Label */}
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground select-none">
        {data.label}
      </p>

      {/* Primary value */}
      <p
        className="text-2xl font-bold text-foreground leading-none tabular-nums"
        aria-live="polite"
      >
        {data.value}
      </p>

      {/* Sub-value */}
      {data.subValue && (
        <p className="text-xs text-muted-foreground truncate">
          {data.subValue}
        </p>
      )}

      {/* Trend row */}
      <div className={cn('mt-1 flex items-center gap-1', trendColor)}>
        <TrendIcon className="size-3 shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-medium leading-none">{data.trendLabel}</span>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────
// KPI Strip
// ─────────────────────────────────────────────────────────────

interface KpiStripProps {
  kpis: KpiData[]
  loading?: boolean
}

export function KpiStrip({ kpis, loading = false }: KpiStripProps) {
  const items = loading ? Array.from({ length: 6 }) : kpis

  return (
    <section aria-label="Portfolio KPIs">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((kpi, i) =>
          loading ? (
            <KpiCardSkeleton key={i} />
          ) : (
            <KpiCard key={(kpi as KpiData).id} data={kpi as KpiData} />
          ),
        )}
      </div>
    </section>
  )
}
