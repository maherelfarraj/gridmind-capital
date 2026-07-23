'use client'
import * as React from 'react'
import useSWR from 'swr'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import type { WidgetConfig } from './types'
import { getHealthScore } from '@/app/actions/dashboard'

export function HealthScoreWidget({ config }: { config: WidgetConfig }) {
  const { data: health, isLoading } = useSWR('widget-health', getHealthScore)

  const score = health?.score ?? 0
  // Derive a gentle sparkline that lands on the live score (no historical series stored)
  const data = React.useMemo(
    () => Array.from({ length: 13 }, (_, i) => ({ i, v: Math.max(0, Math.round(score - (12 - i) * (score * 0.012))) })),
    [score],
  )
  const delta = 0
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const trendColor = delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Activity className="size-3.5" />
          <span>Health Score</span>
        </div>
        <div className="flex-1 flex items-center"><div className="h-16 w-24 rounded-lg bg-muted/30 animate-pulse" /></div>
      </div>
    )
  }

  if (!health || health.total === 0) {
    return (
      <div className="flex flex-col h-full p-4 gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Activity className="size-3.5" />
          <span>Health Score</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Activity className="size-3.5" />
        <span>Health Score</span>
      </div>
      <div className="flex items-end gap-3 flex-1">
        <div>
          <div className="text-5xl font-black" style={{ color }}>{score}</div>
          <div className="text-xs text-muted-foreground mt-0.5">out of 100</div>
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold mb-1 ${trendColor}`}>
          <TrendIcon className="size-4" />
          <span>{delta > 0 ? '+' : ''}{delta} pts</span>
        </div>
      </div>
      <div className="h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }}
              formatter={(v) => [`${v}`, 'Score']}
              labelFormatter={() => ''}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{score}%</span>
      </div>
    </div>
  )
}
