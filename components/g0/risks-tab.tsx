'use client'
import * as React from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { cn } from '@/lib/utils'
import { RISK_META } from './data'
import type { RiskLevel, InitiationRisk } from './types'
import type { G0LiveRisk } from '@/app/actions/gate-submissions'

const LEVEL_ORDER: RiskLevel[] = ['critical', 'high', 'medium', 'low']

// `r.level` on live rows comes from the DB and may fall outside RiskLevel, so
// this render path needs a neutral fallback. The LEVEL_ORDER-driven sites above
// always pass known keys and don't.
function riskMeta(level: string | null | undefined) {
  return (
    RISK_META[level as RiskLevel] ?? {
      label: level ? level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown',
      color: '#94a3b8',
    }
  )
}

export function RisksTab({ liveData }: { liveData?: G0LiveRisk[] }) {
  const [selectedLevel, setSelectedLevel] = React.useState<RiskLevel | 'all'>('all')

  const risks: InitiationRisk[] = liveData
    // Index-based fallback id, not Math.random(): a random id is regenerated on
    // every render, so React would treat each row as new and remount it (losing
    // focus and selection), and SSR/client would disagree during hydration.
    : liveData.map((r, i) => ({ ...r, id: r.id || `live-risk-${i}` } as InitiationRisk))

  if (liveData !== undefined && liveData.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-sm font-medium text-foreground">No records yet</p>
        <p className="text-xs text-muted-foreground mt-1">No initiation risks recorded — use the gate form to add risks.</p>
      </div>
    )
  }

  const filtered = risks.filter((r) => selectedLevel === 'all' || r.level === selectedLevel)

  const pieData = LEVEL_ORDER.map((l) => ({
    name: RISK_META[l].label,
    value: risks.filter((r) => r.level === l).length,
    color: RISK_META[l].color,
  })).filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      {/* KPI + pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 grid grid-cols-2 gap-3">
          {LEVEL_ORDER.map((l) => {
            const count = risks.filter((r) => r.level === l).length
            return (
              <button key={l} type="button" onClick={() => setSelectedLevel(selectedLevel === l ? 'all' : l)}
                className={cn('rounded-xl border p-3 text-center transition-colors',
                  selectedLevel === l ? 'ring-2' : 'border-border bg-card hover:bg-muted/20')}
                style={selectedLevel === l ? { borderColor: RISK_META[l].color, boxShadow: `0 0 0 2px ${RISK_META[l].color}40` } : {}}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{RISK_META[l].label}</p>
                <p className="text-2xl font-black" style={{ color: RISK_META[l].color }}>{count}</p>
              </button>
            )
          })}
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Risk Distribution</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3}>
                  {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-foreground font-medium">{d.value}</span>
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Risk register */}
      <div className="space-y-3">
        {filtered.map((r) => {
          const meta = riskMeta(r.level)
          const score = Math.round(r.probability * r.impact / 100)
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color: meta.color, background: `${meta.color}18` }}>{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">{r.category}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{r.description}</p>
                </div>
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className="text-2xl font-black" style={{ color: meta.color }}>{score}</span>
                  <span className="text-[9px] text-muted-foreground">Risk Score</span>
                </div>
              </div>
              <div className="px-5 pb-4 border-t border-border/50 bg-muted/5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
                  <div><p className="text-muted-foreground mb-0.5">Probability</p><p className="font-semibold text-foreground">{r.probability}%</p></div>
                  <div><p className="text-muted-foreground mb-0.5">Impact</p><p className="font-semibold text-foreground">{r.impact}%</p></div>
                  <div><p className="text-muted-foreground mb-0.5">Owner</p><p className="font-semibold text-foreground">{r.owner}</p></div>
                </div>
                <div className="mt-3">
                  <p className="text-muted-foreground text-xs mb-1">Mitigation</p>
                  <p className="text-sm text-foreground">{r.mitigation}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
