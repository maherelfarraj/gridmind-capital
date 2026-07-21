'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ArrowLeft, Plus, RefreshCw, Loader2, Calendar, CheckCircle2, AlertCircle,
  Clock, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  loadScheduleDashboard, createMilestone, updateMilestoneProgress, seedScheduleDemoData,
} from '@/app/actions/projects'
import type { Milestone } from '@/app/actions/projects'

// ─── Constants ─────────────────────────────────────────────────

const STATUS_META: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  not_started: { color: '#94a3b8', label: 'Not Started', icon: <Clock className="size-3.5 text-[#94a3b8]" /> },
  in_progress: { color: '#3b82f6', label: 'In Progress', icon: <AlertCircle className="size-3.5 text-[#3b82f6]" /> },
  complete:    { color: '#22c55e', label: 'Complete',    icon: <CheckCircle2 className="size-3.5 text-[#22c55e]" /> },
  delayed:     { color: '#ef4444', label: 'Delayed',     icon: <AlertCircle className="size-3.5 text-[#ef4444]" /> },
}

// ─── Pure-CSS Gantt bar ─────────────────────────────────────────

function ganttPercent(start: string, end: string, minDate: Date, totalDays: number): { left: number; width: number } {
  const s = Math.max(0, (new Date(start).getTime() - minDate.getTime()) / 86400000)
  const e = Math.min(totalDays, (new Date(end).getTime()   - minDate.getTime()) / 86400000)
  const left  = Math.round((s / totalDays) * 100)
  const width = Math.max(1, Math.round(((e - s) / totalDays) * 100))
  return { left, width }
}

// ─── Add Milestone Modal ────────────────────────────────────────

function AddMilestoneModal({ open, onClose, projectId, onCreated }: {
  open: boolean; onClose: () => void; projectId: string; onCreated: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    name: '', planned_start: '', planned_end: '', owner: '', is_critical: false, gate: 0,
  })
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })) }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.planned_start || !form.planned_end) {
      toast({ title: 'Name and dates are required', variant: 'danger' }); return
    }
    setLoading(true)
    const { error } = await createMilestone({
      project_id: projectId, name: form.name,
      planned_start: form.planned_start, planned_end: form.planned_end,
      is_critical: form.is_critical, gate: form.gate, owner: form.owner,
    })
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Milestone added', variant: 'success' })
    onCreated(); onClose()
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Add Milestone</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. IFC Drawings Package"
            className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Planned Start *</label>
            <input type="date" value={form.planned_start} onChange={(e) => set('planned_start', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Planned End *</label>
            <input type="date" value={form.planned_end} onChange={(e) => set('planned_end', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Owner</label>
            <input type="text" value={form.owner} onChange={(e) => set('owner', e.target.value)} placeholder="e.g. M. Al-Farsi"
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Gate</label>
            <select value={form.gate} onChange={(e) => set('gate', Number(e.target.value))}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40">
              {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>G{i}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" checked={form.is_critical} onChange={(e) => set('is_critical', e.target.checked)}
            className="rounded border-border" />
          Critical path milestone
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            Add Milestone
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Gantt Chart ────────────────────────────────────────────────

function GanttChart({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No milestones — seed demo or add milestones above.
      </div>
    )
  }

  // Compute overall date range
  const dates = milestones.flatMap((m) => [new Date(m.planned_start), new Date(m.planned_end)])
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / 86400000)

  // Month markers
  const months: { label: string; left: number }[] = []
  const cur = new Date(minDate); cur.setDate(1)
  while (cur <= maxDate) {
    const left = Math.round(((cur.getTime() - minDate.getTime()) / 86400000 / totalDays) * 100)
    months.push({ label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), left })
    cur.setMonth(cur.getMonth() + 1)
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Month header */}
        <div className="relative h-6 border-b border-border mb-1">
          {months.map((m, i) => (
            <span key={i} className="absolute text-[10px] text-muted-foreground font-medium"
              style={{ left: `calc(${m.left}% + 8px)` }}>
              {m.label}
            </span>
          ))}
        </div>
        {/* Rows */}
        <div className="space-y-1.5">
          {milestones.map((m) => {
            const { left, width } = ganttPercent(m.planned_start, m.planned_end, minDate, totalDays)
            const meta = STATUS_META[m.status] ?? STATUS_META.not_started
            return (
              <div key={m.id} className="flex items-center gap-3 group">
                {/* Label */}
                <div className="w-44 shrink-0 flex items-center gap-1.5">
                  {m.is_critical && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444] shrink-0" title="Critical path" />
                  )}
                  <span className="text-xs text-foreground truncate" title={m.name}>{m.name}</span>
                </div>
                {/* Bar track */}
                <div className="flex-1 relative h-6 rounded bg-muted/20">
                  <div
                    className="absolute h-full rounded transition-all"
                    style={{
                      left:  `${left}%`,
                      width: `${width}%`,
                      backgroundColor: meta.color,
                      opacity: m.status === 'not_started' ? 0.35 : 0.85,
                    }}
                    title={`${m.planned_start} → ${m.planned_end}`}
                  >
                    {/* Progress fill */}
                    {m.progress_pct > 0 && m.progress_pct < 100 && (
                      <div className="absolute inset-y-0 left-0 rounded"
                        style={{ width: `${m.progress_pct}%`, backgroundColor: meta.color, opacity: 1 }} />
                    )}
                  </div>
                </div>
                {/* Status chip */}
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: `${meta.color}20`, color: meta.color }}>
                  {m.progress_pct > 0 ? `${m.progress_pct}%` : meta.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────

export function SchedulePage({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = React.useState(false)
  const [seeding, setSeeding]     = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const { data, isLoading, mutate } = useSWR(
    `schedule-${projectId}`,
    () => loadScheduleDashboard(projectId),
    { revalidateOnFocus: true },
  )

  async function handleSeed() {
    setSeeding(true)
    const { error } = await seedScheduleDemoData(projectId)
    setSeeding(false)
    if (error) { toast({ title: 'Seed failed', description: error, variant: 'danger' }); return }
    toast({ title: 'Demo data seeded', variant: 'success' })
    mutate()
  }

  const milestones = data?.milestones ?? []

  // Chart data
  const statusPieData = [
    { name: 'Not Started', value: milestones.filter((m) => m.status === 'not_started').length, color: '#94a3b8' },
    { name: 'In Progress', value: milestones.filter((m) => m.status === 'in_progress').length, color: '#3b82f6' },
    { name: 'Complete',    value: milestones.filter((m) => m.status === 'complete').length,    color: '#22c55e' },
    { name: 'Delayed',     value: milestones.filter((m) => m.status === 'delayed').length,     color: '#ef4444' },
  ].filter((d) => d.value > 0)

  const progressBarData = milestones.map((m) => ({ name: m.name.slice(0, 20), value: m.progress_pct }))

  const kpis = [
    { label: 'Total',      value: data?.totalMilestones ?? 0, color: '#64ffda' },
    { label: 'Complete',   value: data?.complete        ?? 0, color: '#22c55e' },
    { label: 'In Progress',value: data?.inProgress      ?? 0, color: '#3b82f6' },
    { label: 'Delayed',    value: data?.delayed         ?? 0, color: '#ef4444' },
  ]

  return (
    <>
      <AddMilestoneModal open={modalOpen} onClose={() => setModalOpen(false)} projectId={projectId} onCreated={() => mutate()} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="size-3.5" /> Back to project
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Project Schedule</h1>
            <p className="text-sm text-muted-foreground mt-0.5">G1 · Milestones, Gantt chart, and critical path</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh"><RefreshCw className="size-3.5" /></Button>
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="size-3.5 animate-spin" /> : 'Seed Demo'}
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4" /> Add Milestone</Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-card border border-border p-4" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium block mb-1">{label}</span>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Milestone Status Split</CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : statusPieData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data — seed demo first</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {statusPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Progress % by Milestone</CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : progressBarData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressBarData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v}%`, 'Progress']} />
                    <Bar dataKey="value" name="Progress" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            milestones.length > 0 ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-muted text-muted-foreground',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', milestones.length > 0 ? 'bg-[#22c55e]' : 'bg-muted-foreground')} />
            {milestones.length > 0 ? 'Live data' : 'Illustrative — seed demo to populate'}
          </span>
        </div>

        {/* Gantt */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Gantt Chart</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 rounded bg-muted/40 animate-pulse" />
              ))}</div>
            ) : (
              <GanttChart milestones={milestones} />
            )}
          </CardContent>
        </Card>

        {/* Milestone register */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Milestone Register</CardTitle>
          </CardHeader>
          <CardContent>
            {milestones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Calendar className="size-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold text-foreground">No milestones yet</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>Seed Demo</Button>
                  <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="size-3.5" /> Add Milestone</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {milestones.map((m) => {
                  const meta = STATUS_META[m.status] ?? STATUS_META.not_started
                  const expanded = expandedId === m.id
                  return (
                    <div key={m.id} className="rounded-lg border border-border/50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : m.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left"
                      >
                        {m.is_critical && <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444] shrink-0" title="Critical" />}
                        <span className="flex-1 text-sm font-medium text-foreground truncate">{m.name}</span>
                        <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{m.planned_start} → {m.planned_end}</span>
                        <span className="text-xs px-2 py-0.5 rounded font-medium shrink-0"
                          style={{ background: `${meta.color}20`, color: meta.color }}>{meta.label}</span>
                        {expanded ? <ChevronUp className="size-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />}
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3 pt-1 border-t border-border/30 bg-muted/10 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                          <div><span className="text-muted-foreground">Owner:</span> <span className="text-foreground font-medium ml-1">{m.owner}</span></div>
                          <div><span className="text-muted-foreground">Gate:</span> <span className="text-foreground font-medium ml-1">G{m.gate}</span></div>
                          <div><span className="text-muted-foreground">Progress:</span> <span className="text-foreground font-medium ml-1">{m.progress_pct}%</span></div>
                          {m.actual_start && <div><span className="text-muted-foreground">Actual Start:</span> <span className="text-foreground font-medium ml-1">{m.actual_start}</span></div>}
                          {m.actual_end   && <div><span className="text-muted-foreground">Actual End:</span>   <span className="text-foreground font-medium ml-1">{m.actual_end}</span></div>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
