'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, Legend, ReferenceLine, CartesianGrid,
} from 'recharts'
import { TrendingUp, Loader2 } from 'lucide-react'
import { getSCurveData, type SCurvePoint } from '@/app/actions/schedule'

interface SCurveChartProps {
  projectId: string
}

function fmtWeek(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function SCurveChart({ projectId }: SCurveChartProps) {
  const { data, isLoading } = useSWR(
    `scurve-${projectId}`,
    () => getSCurveData(projectId),
    { revalidateOnFocus: false },
  )

  const points: SCurvePoint[] = data ?? []
  const today = new Date().toISOString().slice(0, 10)

  // Map to chart-friendly shape. Keep null as undefined so Recharts gaps the line.
  const chartData = points.map((p) => ({
    week:    p.week,
    label:   fmtWeek(p.week),
    planned: p.planned,
    actual:  p.actual ?? undefined,
  }))

  const hasActual = chartData.some((d) => d.actual !== undefined)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">S-Curve — Planned vs Actual</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : chartData.length < 2 ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Not enough schedule data to render an S-curve.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => `${v}%`}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
              formatter={(v: number, name: string) => [`${v}%`, name]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value: string) =>
                value === 'planned' ? 'Planned' : 'Actual'
              }
            />
            {/* Today marker */}
            {chartData.some((d) => d.week === today) && (
              <ReferenceLine
                x={fmtWeek(today)}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{ value: 'Today', fontSize: 10, fill: 'var(--muted-foreground)' }}
              />
            )}
            <Line
              type="monotone"
              dataKey="planned"
              name="planned"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
            />
            {hasActual && (
              <Line
                type="monotone"
                dataKey="actual"
                name="actual"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: 'var(--primary)', strokeWidth: 0 }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      {hasActual && (
        <p className="mt-2 text-right text-[11px] text-muted-foreground">
          Solid line = actual progress recorded via field updates
        </p>
      )}
    </div>
  )
}
