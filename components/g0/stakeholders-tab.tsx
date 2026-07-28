'use client'
import * as React from 'react'
import { CheckCircle2, Circle, Mail, Phone, Users } from 'lucide-react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { cn } from '@/lib/utils'
// Real stakeholder data shown when available; MOCK_STAKEHOLDERS removed
import type { G0LiveStakeholder } from '@/app/actions/gate-submissions'
import type { Stakeholder } from './types'

const EMPTY_MSG = 'No members recorded yet — add team members via the Project Members page.'

const ROLE_COLORS: Record<string, string> = {
  sponsor:   '#f59e0b',
  owner:     '#3b82f6',
  pmo:       '#22c55e',
  finance:   '#a855f7',
  legal:     '#ec4899',
  technical: '#06b6d4',
  external:  '#6b7280',
}

const INFLUENCE_NUM = { high: 3, medium: 2, low: 1 }
const INTEREST_NUM  = { high: 3, medium: 2, low: 1 }

export function StakeholdersTab({ liveData }: { liveData?: G0LiveStakeholder[] }) {
  const stakeholders: Stakeholder[] = liveData
    ? liveData.map((m) => ({ ...m } as unknown as Stakeholder))
    : []

  if (!stakeholders || stakeholders.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <Users className="size-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">No records yet</p>
        <p className="text-xs text-muted-foreground mt-1">{EMPTY_MSG}</p>
      </div>
    )
  }

  const signatories = stakeholders.filter((s) => s.charter_signatory)
  const signed      = signatories.filter((s) => s.signed).length

  const scatterData = stakeholders.map((s) => ({
    x: INFLUENCE_NUM[s.influence],
    y: INTEREST_NUM[s.interest],
    name: s.name,
    role: s.role,
  }))

  return (
    <div className="space-y-6">
      {/* Signature status */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Charter Sign-offs</p>
          <span className="text-sm font-bold text-foreground">{signed} / {signatories.length} signed</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          {signatories.map((s) => (
            <div key={s.id} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
              s.signed ? 'border-green-500/30 bg-green-500/5 text-foreground' : 'border-border bg-muted/20 text-muted-foreground')}>
              {s.signed ? <CheckCircle2 className="size-4 text-green-500" /> : <Circle className="size-4 text-muted-foreground" />}
              <span className="font-medium">{s.name.split(' ').slice(-1)[0]}</span>
              {s.signed_date && <span className="text-xs text-muted-foreground font-mono">{s.signed_date}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Scatter chart — influence vs interest */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Stakeholder Influence / Interest Matrix</p>
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <XAxis dataKey="x" type="number" domain={[0.5, 3.5]} ticks={[1,2,3]} tickFormatter={(v) => ['', 'Low', 'Med', 'High'][v]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} label={{ value: 'Influence', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }} />
            <YAxis dataKey="y" type="number" domain={[0.5, 3.5]} ticks={[1,2,3]} tickFormatter={(v) => ['', 'Low', 'Med', 'High'][v]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} label={{ value: 'Interest', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
            <ReferenceLine x={2} stroke="#1e293b" strokeDasharray="3 3" />
            <ReferenceLine y={2} stroke="#1e293b" strokeDasharray="3 3" />
            <Tooltip content={({ payload }) => payload?.[0] ? (
              <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs">
                <p className="font-semibold text-foreground">{payload[0].payload.name}</p>
                <p className="text-muted-foreground capitalize">{payload[0].payload.role}</p>
              </div>
            ) : null} />
            <Scatter data={scatterData} shape="circle">
              {scatterData.map((d, i) => <Cell key={i} fill={ROLE_COLORS[d.role]} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Stakeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {stakeholders.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm text-foreground leading-tight">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.organisation}</p>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize flex-shrink-0"
                style={{ color: ROLE_COLORS[s.role], background: `${ROLE_COLORS[s.role]}18` }}>
                {s.role}
              </span>
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="bg-muted/40 px-1.5 py-0.5 rounded capitalize">Influence: {s.influence}</span>
              <span className="bg-muted/40 px-1.5 py-0.5 rounded capitalize">Interest: {s.interest}</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <a href={`mailto:${s.email}`} className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"><Mail className="size-3.5" /></a>
              <a href={`tel:${s.phone}`}   className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"><Phone className="size-3.5" /></a>
              {s.charter_signatory && (
                <span className={cn('ml-auto text-[9px] font-semibold flex items-center gap-1',
                  s.signed ? 'text-green-500' : 'text-amber-500')}>
                  {s.signed ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
                  {s.signed ? 'Signed' : 'Pending'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
