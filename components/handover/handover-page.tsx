'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  CheckCircle2, Clock, AlertTriangle, FolderCheck,
  ChevronDown, Database, RefreshCw, Plus, X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  loadHandoverDashboard, updateHandoverStatus, seedHandoverDemoData,
  createHandoverItem,
} from '@/app/actions/handover'
import type { HandoverItem, HandoverDashboard, HandoverStatus } from '@/app/actions/handover'

// ─── Illustrative fallback ────────────────────────────────────

const ILLUSTRATIVE: HandoverDashboard = {
  total: 12, complete: 5, inProgress: 4, overdue: 2,
  byCategory: [
    { name: 'technical',     total: 3, complete: 2 },
    { name: 'safety',        total: 2, complete: 1 },
    { name: 'documentation', total: 3, complete: 2 },
    { name: 'commercial',    total: 2, complete: 0 },
    { name: 'training',      total: 2, complete: 0 },
  ],
  byStatus: [
    { name: 'accepted',    value: 5, color: '#22c55e' },
    { name: 'submitted',   value: 2, color: '#f59e0b' },
    { name: 'in_progress', value: 4, color: '#3b82f6' },
    { name: 'not_started', value: 1, color: '#94a3b8' },
  ],
  items: [],
}

// ─── Helpers ──────────────────────────────────────────────────

const STATUS_LABEL: Record<HandoverStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  submitted:   'Submitted',
  accepted:    'Accepted',
  rejected:    'Rejected',
}

const STATUS_COLOR: Record<HandoverStatus, string> = {
  not_started: '#94a3b8',
  in_progress: '#3b82f6',
  submitted:   '#f59e0b',
  accepted:    '#22c55e',
  rejected:    '#ef4444',
}

const CATEGORY_COLORS: Record<string, string> = {
  technical:     '#64ffda',
  safety:        '#ef4444',
  documentation: '#3b82f6',
  commercial:    '#f59e0b',
  training:      '#8b5cf6',
}

function relDate(iso: string | null): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  const days = Math.ceil(diff / 86400000)
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Today'
  return `${days}d`
}

// ─── KPI Card ─────────────────────────────────────────────────

function KpiCard({ label, value, accent, sub, icon: Icon }: {
  label: string; value: number; accent: string; sub?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div
      className="flex-1 min-w-[130px] rounded-xl bg-card border border-border p-4"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <span className="opacity-40" style={{ color: accent }}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Handover Row ─────────────────────────────────────────────

function HandoverRow({
  item, onAccept,
}: {
  item: HandoverItem
  onAccept: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [accepting, setAccepting] = React.useState(false)
  const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== 'accepted'

  async function handleAccept() {
    setAccepting(true)
    await onAccept(item.id)
    setAccepting(false)
  }

  return (
    <div className={cn('border-b border-border last:border-0', isOverdue && 'bg-red-500/3')}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
      >
        {/* Category dot */}
        <span
          className="mt-1 size-2.5 rounded-full shrink-0"
          style={{ background: CATEGORY_COLORS[item.category] ?? '#64ffda' }}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-foreground">{item.title}</span>
            {isOverdue && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-red-400">
                <AlertTriangle className="size-3" aria-hidden />
                Overdue
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="font-mono text-[#64ffda]">{item.project_code}</span>
            <span className="capitalize">{item.category}</span>
            <span>{relDate(item.due_date)}</span>
            <span>{item.completion_pct}%</span>
          </div>
        </div>

        {/* Status badge + chevron */}
        <div className="shrink-0 flex items-center gap-2">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: `${STATUS_COLOR[item.status]}20`,
              color: STATUS_COLOR[item.status],
            }}
          >
            {STATUS_LABEL[item.status]}
          </span>
          <ChevronDown
            className={cn('size-4 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')}
            aria-hidden
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/50 bg-muted/20">
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          )}

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Completion</span>
              <span>{item.completion_pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${item.completion_pct}%`,
                  background: STATUS_COLOR[item.status],
                }}
              />
            </div>
          </div>

          {item.accepted_by && (
            <p className="text-xs text-muted-foreground">
              Accepted by <span className="text-foreground font-medium">{item.accepted_by}</span>
            </p>
          )}

          {item.status !== 'accepted' && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" aria-hidden />
                {accepting ? 'Accepting...' : 'Accept'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add Item Modal ───────────────────────────────────────────

const DEMO_PROJECTS = [{ id: '', label: 'Select project...' }]

function AddItemModal({
  projects,
  onAdd,
  onClose,
}: {
  projects: { id: string; name: string; code: string }[]
  onAdd: (data: {
    project_id: string; category: HandoverItem['category']
    title: string; description?: string; due_date?: string
  }) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = React.useState({
    project_id: '',
    category:   'technical' as HandoverItem['category'],
    title:      '',
    description: '',
    due_date:   '',
  })
  const [saving, setSaving] = React.useState(false)

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.project_id) return
    setSaving(true)
    await onAdd({
      project_id:  form.project_id,
      category:    form.category,
      title:       form.title,
      description: form.description || undefined,
      due_date:    form.due_date || undefined,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Add Handover Item</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Project</label>
            <select
              value={form.project_id}
              onChange={(e) => set('project_id', e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value as HandoverItem['category'])}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {(['technical', 'commercial', 'safety', 'documentation', 'training'] as const).map((c) => (
                <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
              placeholder="e.g. As-Built Drawings Package"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date (optional)</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !form.title || !form.project_id}
              className="flex-1 py-2 rounded-lg bg-[#0a192f] dark:bg-sky-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Item'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function HandoverPage() {
  const { data, mutate, isLoading } = useSWR('handover-dashboard', loadHandoverDashboard)
  const [seeding,     setSeeding]     = React.useState(false)
  const [showAdd,     setShowAdd]     = React.useState(false)
  const [catFilter,   setCatFilter]   = React.useState<string>('all')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')

  const d      = data ?? (isLoading ? null : ILLUSTRATIVE)
  const isLive = !!data

  async function handleSeed() {
    setSeeding(true)
    await seedHandoverDemoData()
    await mutate()
    setSeeding(false)
  }

  async function handleAccept(id: string) {
    await updateHandoverStatus(id, 'accepted', 100)
    await mutate()
  }

  async function handleAdd(form: Parameters<typeof createHandoverItem>[0]) {
    await createHandoverItem(form)
    await mutate()
  }

  const filtered = (d?.items ?? []).filter((item) => {
    if (catFilter    !== 'all' && item.category !== catFilter) return false
    if (statusFilter !== 'all' && item.status   !== statusFilter) return false
    return true
  })

  const byCategory = d?.byCategory ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Project Handover</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and accept handover items across all projects
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full',
            isLive
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-amber-500/15 text-amber-400',
          )}>
            {isLive ? 'Live' : 'Illustrative'}
          </span>
          {!isLive && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <Database className="size-3.5" aria-hidden />
              {seeding ? 'Seeding...' : 'Seed Demo'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#0a192f] dark:bg-sky-700 text-white hover:opacity-90 transition-colors"
          >
            <Plus className="size-3.5" aria-hidden />
            Add Item
          </button>
          <button
            type="button"
            onClick={() => mutate()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {d && (
        <div className="flex flex-wrap gap-3" role="region" aria-label="Handover statistics">
          <KpiCard label="Total Items"  value={d.total}      accent="#64ffda" icon={FolderCheck}  />
          <KpiCard label="Accepted"     value={d.complete}   accent="#22c55e" icon={CheckCircle2} />
          <KpiCard label="In Progress"  value={d.inProgress} accent="#3b82f6" icon={Clock}        />
          <KpiCard label="Overdue"      value={d.overdue}    accent="#ef4444" icon={AlertTriangle}
            sub={d.overdue > 0 ? 'Requires action' : 'All on track'} />
        </div>
      )}

      {/* Charts */}
      {d && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Category progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Completion by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byCategory} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, 'Count']}
                  />
                  <Bar dataKey="total"    fill="#475569"  radius={[4, 4, 0, 0]} name="Total"    />
                  <Bar dataKey="complete" fill="#22c55e"  radius={[4, 4, 0, 0]} name="Accepted" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={d.byStatus}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    outerRadius={72}
                    label={({ name, percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {d.byStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, 'Items']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2 shrink-0">
                {d.byStatus.map((s) => (
                  <li key={s.name} className="flex items-center gap-2 text-xs text-foreground capitalize">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    {s.name.replace('_', ' ')}
                    <span className="ml-1 text-muted-foreground">({s.value})</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'technical', 'commercial', 'safety', 'documentation', 'training'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors capitalize',
                catFilter === cat
                  ? 'bg-[#64ffda]/10 border-[#64ffda]/40 text-[#64ffda]'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" aria-hidden />
        {/* Status filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'not_started', 'in_progress', 'submitted', 'accepted'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                statusFilter === st
                  ? 'bg-sky-500/10 border-sky-500/40 text-sky-400'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {st === 'all' ? 'All Statuses' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Register */}
      <Card>
        <CardHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            {catFilter !== 'all' && ` · ${catFilter}`}
          </CardTitle>
          {(d?.overdue ?? 0) > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <AlertTriangle className="size-3.5" aria-hidden />
              {d!.overdue} overdue
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <CheckCircle2 className="size-12 text-emerald-400 mb-3" aria-hidden />
              <p className="text-base font-semibold text-foreground">All clear</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isLive ? 'No handover items match the current filters.' : 'Seed demo data to see live handover items.'}
              </p>
            </div>
          ) : (
            <div role="list" aria-label="Handover items">
              {filtered.map((item) => (
                <HandoverRow key={item.id} item={item} onAccept={handleAccept} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add modal */}
      {showAdd && (
        <AddItemModal
          projects={
            (d?.items ?? [])
              .filter((v, i, arr) => arr.findIndex((x) => x.project_id === v.project_id) === i)
              .map((item) => ({ id: item.project_id, name: item.project_name, code: item.project_code }))
          }
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
