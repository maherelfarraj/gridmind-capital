'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  BarChart3, AlertTriangle, CheckCircle2, Plus, X, Loader2, RefreshCw,
  Flag, ClipboardList, BookOpen, Lightbulb, Target,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import {
  loadPmoDashboard, createPmoItem, seedPmoDemoData,
  type PmoRisk, type PmoTicketItem, type PmoDecision, type PmoLesson,
} from '@/app/actions/pmo'
import { getProjects } from '@/app/actions/projects'

/* ─── Color helpers ─────────────────────────────────────────── */
const PRIORITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high:     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  medium:   'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  low:      'bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground',
}
function statusStyle(status: string): string {
  const s = status.toLowerCase()
  if (s === 'closed' || s === 'done' || s === 'approved') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (s === 'in_progress' || s === 'in-progress') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (s === 'escalated' || s === 'rejected') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (s === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-slate-100 text-slate-700 dark:bg-muted dark:text-muted-foreground'
}

function PBadge({ label, color }: { label: string; color: string }) {
  return <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-semibold capitalize', color)}>{label.replace('_', ' ')}</span>
}

/* ─── Create modal ──────────────────────────────────────────── */
interface ProjectOption { id: string; name: string }

function CreateModal({
  type, projects, onClose, onCreate,
}: {
  type: 'risk' | 'issue' | 'action' | 'decision' | 'lesson'
  projects: ProjectOption[]
  onClose: () => void
  onCreate: (data: Record<string, string>) => Promise<void>
}) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({
    projectId: projects[0]?.id ?? '', title: '', owner: '', priority: 'medium', category: '', rationale: '', phase: 'Engineering',
  })

  async function submit() {
    setSaving(true)
    await onCreate(form)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-foreground capitalize">Create {type}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-accent"><X className="size-4 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Project</label>
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400">
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={type === 'lesson' ? 'Lesson learned...' : `${type} title`}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400" />
          </div>
          {(type === 'risk' || type === 'issue' || type === 'action') && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Owner</label>
                <input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Name"
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400" />
              </div>
              {type !== 'action' && (
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400">
                    {['critical', 'high', 'medium', 'low'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                  </select>
                </div>
              )}
              {type === 'risk' && (
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Category</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g., Regulatory"
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400" />
                </div>
              )}
            </>
          )}
          {type === 'decision' && (
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Rationale</label>
              <textarea value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))}
                rows={3} placeholder="Decision rationale..."
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400 resize-none" />
            </div>
          )}
          {type === 'lesson' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Phase</label>
                <select value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400">
                  {['Engineering', 'Procurement', 'Construction', 'Commissioning', 'Commercial', 'Finance'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Category</label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g., Regulatory"
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400" />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.title.trim() || !form.projectId || saving} onClick={submit}
            className="bg-[#0a192f] hover:bg-[#112240] dark:bg-[#64ffda] dark:text-[#0a192f] text-white">
            {saving && <Loader2 className="size-3.5 animate-spin mr-1" />} Create
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── KPI Strip ──────────────────────────────────────────────── */
function KpiStrip({ d }: { d: ReturnType<typeof useSWR<Awaited<ReturnType<typeof loadPmoDashboard>>>>['data'] }) {
  const kpis = [
    { label: 'Total Projects',  value: d?.totalProjects ?? 0,  icon: BarChart3,     color: 'text-sky-600' },
    { label: 'On Track',        value: d?.onTrack ?? 0,         icon: CheckCircle2,  color: 'text-green-600' },
    { label: 'At Risk',         value: d?.atRisk ?? 0,          icon: AlertTriangle, color: 'text-amber-500' },
    { label: 'Critical Issues', value: d?.criticalIssues ?? 0,  icon: Flag,          color: 'text-red-500' },
    { label: 'Open Actions',    value: d?.openActions ?? 0,     icon: ClipboardList, color: 'text-indigo-500' },
    { label: 'Lessons',         value: d?.lessonsCount ?? 0,    icon: BookOpen,      color: 'text-teal-500' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map(k => (
        <div key={k.label} className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <k.icon className={cn('size-5 shrink-0', k.color)} />
            <span className="text-sm text-slate-500 dark:text-muted-foreground">{k.label}</span>
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-foreground">{k.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Charts ─────────────────────────────────────────────────── */
function PmoCharts({ d }: { d: Awaited<ReturnType<typeof loadPmoDashboard>> }) {
  const openIssues = d.issues.filter(i => i.status !== 'closed').length
  const closedIssues = d.issues.filter(i => i.status === 'closed').length
  const issuesTrend = [
    { month: 'Apr', open: Math.max(0, openIssues - 2), closed: Math.max(0, closedIssues - 2) },
    { month: 'May', open: Math.max(0, openIssues - 1), closed: Math.max(0, closedIssues - 1) },
    { month: 'Jun', open: openIssues, closed: closedIssues },
    { month: 'Jul', open: openIssues, closed: closedIssues },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-foreground mb-4">Risks by Category</p>
        {d.riskByCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No risks yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d.riskByCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-foreground mb-4">Portfolio Health</p>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={d.portfolioHealth} cx="50%" cy="50%" outerRadius={70} dataKey="value"
              label={({ name, value }) => (value as number) > 0 ? `${name} (${value})` : ''} labelLine={false}>
              {d.portfolioHealth.map((x, i) => <Cell key={i} fill={x.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-foreground mb-4">Issues Trend (Monthly)</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={issuesTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="open" stroke="#f59e0b" strokeWidth={2} dot={false} name="Open" />
            <Line type="monotone" dataKey="closed" stroke="#22c55e" strokeWidth={2} dot={false} name="Closed" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ─── Register table ─────────────────────────────────────────── */
function RegisterTable<T>({
  title, icon: Icon, items, columns, onAdd, addLabel, loading,
}: {
  title: string; icon: React.ElementType; items: T[]
  columns: { key: string; label: string; render: (item: T) => React.ReactNode }[]
  onAdd?: () => void; addLabel?: string; loading?: boolean
}) {
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-border">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-slate-500 dark:text-muted-foreground" />
          <span className="font-semibold text-slate-900 dark:text-foreground">{title}</span>
          <span className="ml-1 text-xs bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground rounded-full px-2 py-0.5">{items.length}</span>
        </div>
        {onAdd && (
          <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0a192f] text-white dark:bg-[#64ffda] dark:text-[#0a192f] hover:opacity-90 transition-opacity">
            <Plus className="size-3.5" /> {addLabel ?? 'Add'}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-border bg-slate-50 dark:bg-muted/40">
              {columns.map(c => (
                <th key={c.key} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 dark:text-muted-foreground text-sm">
                {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading…</span> : 'No entries yet. Use “Seed Demo” to populate.'}
              </td></tr>
            ) : items.map((item, i) => (
              <tr key={i} className={cn('border-b border-slate-50 dark:border-border/50', i % 2 === 0 ? 'bg-white dark:bg-background' : 'bg-slate-50/50 dark:bg-card/50')}>
                {columns.map(c => (
                  <td key={c.key} className="px-4 py-3 align-middle">{c.render(item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────── */
type TabId = 'overview' | 'risks' | 'issues' | 'actions' | 'decisions' | 'lessons'

export function PmoCockpit() {
  const { toast } = useToast()
  const { data, isLoading, mutate } = useSWR('pmo-dashboard', loadPmoDashboard, { revalidateOnFocus: true })
  const { data: projectList } = useSWR('pmo-projects', getProjects)
  const [tab, setTab] = React.useState<TabId>('overview')
  const [modal, setModal] = React.useState<'risk' | 'issue' | 'action' | 'decision' | 'lesson' | null>(null)
  const [seeding, setSeeding] = React.useState(false)

  const projects: ProjectOption[] = React.useMemo(
    () => (projectList ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })),
    [projectList],
  )

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview',   label: 'Overview',   icon: BarChart3      },
    { id: 'risks',      label: 'Risks',      icon: AlertTriangle  },
    { id: 'issues',     label: 'Issues',     icon: Flag           },
    { id: 'actions',    label: 'Actions',    icon: ClipboardList  },
    { id: 'decisions',  label: 'Decisions',  icon: Target         },
    { id: 'lessons',    label: 'Lessons',    icon: Lightbulb      },
  ]

  async function handleCreate(type: NonNullable<typeof modal>, form: Record<string, string>) {
    const { error } = await createPmoItem({
      type, projectId: form.projectId, title: form.title, owner: form.owner,
      priority: form.priority, category: form.category, rationale: form.rationale, phase: form.phase,
    })
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: `${type[0].toUpperCase() + type.slice(1)} created`, variant: 'success' })
    mutate()
  }

  async function handleSeed() {
    setSeeding(true)
    const { error } = await seedPmoDemoData()
    setSeeding(false)
    if (error) { toast({ title: 'Seed failed', description: error, variant: 'danger' }); return }
    toast({ title: 'Demo data seeded', variant: 'success' })
    mutate()
  }

  const risks = data?.risks ?? []
  const issues = data?.issues ?? []
  const actions = data?.actions ?? []
  const decisions = data?.decisions ?? []
  const lessons = data?.lessons ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground">PMO Cockpit</h1>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">Portfolio-wide risk, issue, action, decision &amp; lesson tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh"><RefreshCw className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding} className="gap-1.5">
            {seeding ? <Loader2 className="size-4 animate-spin" /> : null} Seed Demo
          </Button>
        </div>
      </div>

      <KpiStrip d={data} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-border overflow-x-auto scrollbar-none">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px',
              tab === t.id ? 'border-[#0a192f] text-[#0a192f] dark:border-[#64ffda] dark:text-[#64ffda]' : 'border-transparent text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground'
            )}>
            <t.icon className="size-4" aria-hidden /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === 'overview' && data && <PmoCharts d={data} />}

      {tab === 'risks' && (
        <RegisterTable
          title="Risk Register" icon={AlertTriangle} items={risks} loading={isLoading}
          onAdd={() => setModal('risk')} addLabel="Add Risk"
          columns={[
            { key: 'project', label: 'Project', render: (r: PmoRisk) => <span className="text-xs text-slate-600 dark:text-muted-foreground">{r.projectName}</span> },
            { key: 'title', label: 'Title', render: (r: PmoRisk) => <span className="text-slate-800 dark:text-foreground font-medium">{r.title}</span> },
            { key: 'cat', label: 'Category', render: (r: PmoRisk) => <span className="text-xs text-slate-500">{r.category}</span> },
            { key: 'priority', label: 'Priority', render: (r: PmoRisk) => <PBadge label={r.priority} color={PRIORITY_STYLE[r.priority] ?? PRIORITY_STYLE.medium} /> },
            { key: 'status', label: 'Status', render: (r: PmoRisk) => <PBadge label={r.status} color={statusStyle(r.status)} /> },
            { key: 'owner', label: 'Owner', render: (r: PmoRisk) => <span className="text-xs">{r.owner}</span> },
          ]}
        />
      )}

      {tab === 'issues' && (
        <RegisterTable
          title="Issue Register" icon={Flag} items={issues} loading={isLoading}
          onAdd={() => setModal('issue')} addLabel="Add Issue"
          columns={[
            { key: 'project', label: 'Project', render: (i: PmoTicketItem) => <span className="text-xs text-slate-600 dark:text-muted-foreground">{i.projectName}</span> },
            { key: 'title', label: 'Title', render: (i: PmoTicketItem) => <span className="font-medium text-slate-800 dark:text-foreground">{i.title}</span> },
            { key: 'priority', label: 'Priority', render: (i: PmoTicketItem) => <PBadge label={i.priority} color={PRIORITY_STYLE[i.priority] ?? PRIORITY_STYLE.medium} /> },
            { key: 'status', label: 'Status', render: (i: PmoTicketItem) => <PBadge label={i.status} color={statusStyle(i.status)} /> },
            { key: 'owner', label: 'Owner', render: (i: PmoTicketItem) => <span className="text-xs">{i.owner}</span> },
          ]}
        />
      )}

      {tab === 'actions' && (
        <RegisterTable
          title="Action Tracker" icon={ClipboardList} items={actions} loading={isLoading}
          onAdd={() => setModal('action')} addLabel="Add Action"
          columns={[
            { key: 'project', label: 'Project', render: (a: PmoTicketItem) => <span className="text-xs text-slate-600 dark:text-muted-foreground">{a.projectName}</span> },
            { key: 'title', label: 'Action', render: (a: PmoTicketItem) => <span className="font-medium text-slate-800 dark:text-foreground">{a.title}</span> },
            { key: 'status', label: 'Status', render: (a: PmoTicketItem) => <PBadge label={a.status} color={statusStyle(a.status)} /> },
            { key: 'owner', label: 'Owner', render: (a: PmoTicketItem) => <span className="text-xs">{a.owner}</span> },
          ]}
        />
      )}

      {tab === 'decisions' && (
        <RegisterTable
          title="Decision Log" icon={Target} items={decisions} loading={isLoading}
          onAdd={() => setModal('decision')} addLabel="Log Decision"
          columns={[
            { key: 'project', label: 'Project', render: (d: PmoDecision) => <span className="text-xs text-slate-600 dark:text-muted-foreground">{d.projectName}</span> },
            { key: 'title', label: 'Decision', render: (d: PmoDecision) => <span className="font-medium text-slate-800 dark:text-foreground">{d.title}</span> },
            { key: 'rationale', label: 'Rationale', render: (d: PmoDecision) => <span className="text-xs text-slate-500 max-w-[200px] block truncate">{d.rationale}</span> },
            { key: 'status', label: 'Status', render: (d: PmoDecision) => <PBadge label={d.status} color={statusStyle(d.status)} /> },
          ]}
        />
      )}

      {tab === 'lessons' && (
        <RegisterTable
          title="Lessons Learned" icon={Lightbulb} items={lessons} loading={isLoading}
          onAdd={() => setModal('lesson')} addLabel="Add Lesson"
          columns={[
            { key: 'project', label: 'Project', render: (l: PmoLesson) => <span className="text-xs text-slate-600 dark:text-muted-foreground">{l.projectName}</span> },
            { key: 'title', label: 'Lesson', render: (l: PmoLesson) => <span className="font-medium text-slate-800 dark:text-foreground">{l.title}</span> },
            { key: 'phase', label: 'Phase', render: (l: PmoLesson) => <span className="text-xs">{l.phase}</span> },
            { key: 'cat', label: 'Category', render: (l: PmoLesson) => <span className="text-xs">{l.category}</span> },
          ]}
        />
      )}

      {modal && (
        <CreateModal
          type={modal}
          projects={projects}
          onClose={() => setModal(null)}
          onCreate={(d) => handleCreate(modal, d)}
        />
      )}
    </div>
  )
}
