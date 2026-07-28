'use client'
import * as React from 'react'
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, Plus, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { DELIVERABLE_STATUS_META } from './data'
import type { DeliverableStatus, CharterDeliverable } from './types'

const STATUS_ORDER: DeliverableStatus[] = ['not_started', 'in_progress', 'complete', 'approved']

export function DeliverablesTab({ liveData }: { liveData?: CharterDeliverable[] }) {
  const [filter, setFilter] = React.useState<DeliverableStatus | 'all'>('all')
  const [expanded, setExpanded] = React.useState<string | null>(null)

  const deliverables = liveData ?? []

  const filtered = deliverables.filter((d) => filter === 'all' || d.status === filter)
  const total     = deliverables.length
  const done      = deliverables.filter((d) => d.status === 'approved' || d.status === 'complete').length
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0

  const chartData = STATUS_ORDER.map((s) => ({
    name: DELIVERABLE_STATUS_META[s].label,
    count: deliverables.filter((d) => d.status === s).length,
    color: DELIVERABLE_STATUS_META[s].color,
  })).filter((d) => d.count > 0)

  return (
    <div className="space-y-6">
      {/* Progress + chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-xl border border-border bg-card p-5 flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Overall Progress</p>
          <div className="text-4xl font-black text-foreground mb-3">{pct}<span className="text-2xl text-muted-foreground">%</span></div>
          <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{done} of {total} deliverables complete or approved</p>
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Deliverables by Status</p>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v} items`, '']} contentStyle={{ fontSize: 12, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter + add */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {(['all', ...STATUS_ORDER] as const).map((s) => (
            <button key={s} type="button" onClick={() => setFilter(s)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                filter === s ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30')}>
              {s === 'all' ? 'All' : DELIVERABLE_STATUS_META[s].label}
            </button>
          ))}
        </div>
        <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-500 hover:bg-amber-500/20 transition-colors">
          <Plus className="size-3.5" /> Add Deliverable
        </button>
      </div>

      {/* Deliverable rows */}
      <div className="rounded-xl border border-border overflow-hidden">
        {filtered.map((d, i) => {
          const meta = DELIVERABLE_STATUS_META[d.status]
          const isOpen = expanded === d.id
          return (
            <div key={d.id} className={cn('border-b border-border last:border-0', isOpen && 'bg-muted/10')}>
              <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : d.id)}>
                <div className="flex-shrink-0">
                  {d.status === 'approved'   ? <CheckCircle2 className="size-4 text-green-500" /> :
                   d.status === 'complete'   ? <CheckCircle2 className="size-4 text-amber-500" /> :
                   d.status === 'in_progress'? <Clock className="size-4 text-blue-500" /> :
                   <Circle className="size-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{d.name}</span>
                    {d.mandatory && <Star className="size-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span className="bg-muted/50 px-2 py-0.5 rounded-full">{d.category}</span>
                    <span>Owner: {d.owner}</span>
                    <span>Due: {d.due_date}</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
                  style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}12` }}>
                  {meta.label}
                </span>
                {isOpen ? <ChevronUp className="size-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground flex-shrink-0" />}
              </div>
              {isOpen && (
                <div className="px-5 pb-4 pt-0 text-sm text-muted-foreground bg-muted/5 border-t border-border/50">
                  <p className="pt-3">{d.notes}</p>
                  {d.completed_date && <p className="mt-1 text-xs">Completed: <span className="text-foreground font-mono">{d.completed_date}</span></p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
