'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock, Plus, X,
  Loader2, MoreVertical, ChevronDown, Flag, Zap, Users, Lightbulb,
  ClipboardList, BookOpen, MessageSquare, Target, ArrowUpRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { mockStore } from '@/lib/mock-store'

/* ─── Types ─────────────────────────────────────────────────── */
type ItemStatus = 'open' | 'in-progress' | 'closed' | 'escalated'
type ItemPriority = 'critical' | 'high' | 'medium' | 'low'

interface RiskItem {
  id: string; projectId: string; projectName: string
  title: string; category: string; status: ItemStatus
  probability: number; impact: number; priority: ItemPriority
  owner: string; dueDate: string
}
interface IssueItem {
  id: string; projectId: string; projectName: string
  title: string; status: ItemStatus; priority: ItemPriority
  owner: string; dueDate: string; escalated?: boolean
}
interface ActionItem {
  id: string; projectId: string; projectName: string
  title: string; owner: string; dueDate: string; status: ItemStatus
}
interface Decision {
  id: string; projectId: string; projectName: string
  title: string; rationale: string; decidedBy: string; date: string
  status: 'pending' | 'approved' | 'rejected'
}
interface Lesson {
  id: string; projectId: string; projectName: string
  title: string; phase: string; category: string; promoted: boolean
}

/* ─── Mock data ──────────────────────────────────────────────── */
const PROJECTS = mockStore.getProjects()

const MOCK_RISKS: RiskItem[] = [
  { id: 'r1', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', title: 'Grid connection permit delayed', category: 'Regulatory', status: 'open', probability: 60, impact: 90, priority: 'critical', owner: 'Sarah Al-Mansouri', dueDate: '2026-09-30' },
  { id: 'r2', projectId: 'GMC-2026-002', projectName: 'Neom Green Hydrogen Wind', title: 'Wind turbine long-lead delivery risk', category: 'Supply Chain', status: 'in-progress', probability: 50, impact: 70, priority: 'high', owner: 'Carlos Reyes', dueDate: '2026-10-15' },
  { id: 'r3', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', title: 'Solar tracker design change', category: 'Technical', status: 'open', probability: 30, impact: 50, priority: 'medium', owner: 'Dr. Yuki Tanaka', dueDate: '2026-08-30' },
  { id: 'r4', projectId: 'GMC-2026-003', projectName: 'Hornsea V Offshore Wind', title: 'Offshore cable route conflict', category: 'Environmental', status: 'escalated', probability: 70, impact: 85, priority: 'critical', owner: 'Ingrid Larsen', dueDate: '2026-08-01' },
  { id: 'r5', projectId: 'GMC-2026-002', projectName: 'Neom Green Hydrogen Wind', title: 'Fx rate exposure SAR/USD', category: 'Financial', status: 'open', probability: 40, impact: 60, priority: 'medium', owner: 'Priya Sharma', dueDate: '2027-01-01' },
]

const MOCK_ISSUES: IssueItem[] = [
  { id: 'i1', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', title: 'ADWEC connection agreement not signed', status: 'escalated', priority: 'critical', owner: 'Sarah Al-Mansouri', dueDate: '2026-07-31', escalated: true },
  { id: 'i2', projectId: 'GMC-2026-002', projectName: 'Neom Green Hydrogen Wind', title: 'Access road construction delayed 3 months', status: 'in-progress', priority: 'high', owner: 'Ahmed Hassan', dueDate: '2026-08-15' },
  { id: 'i3', projectId: 'GMC-2026-003', projectName: 'Hornsea V Offshore Wind', title: 'Marine survey results dispute', status: 'open', priority: 'high', owner: 'Ingrid Larsen', dueDate: '2026-09-01' },
  { id: 'i4', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', title: 'EPC contractor cashflow concern', status: 'in-progress', priority: 'medium', owner: 'Priya Sharma', dueDate: '2026-08-31' },
]

const MOCK_ACTIONS: ActionItem[] = [
  { id: 'ac1', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', title: 'Submit DEWA interconnection package v3', owner: 'Dr. Yuki Tanaka', dueDate: '2026-07-31', status: 'in-progress' },
  { id: 'ac2', projectId: 'GMC-2026-002', projectName: 'Neom Green Hydrogen Wind', title: 'Negotiate extended WTG delivery window with Siemens', owner: 'Carlos Reyes', dueDate: '2026-08-10', status: 'open' },
  { id: 'ac3', projectId: 'GMC-2026-003', projectName: 'Hornsea V Offshore Wind', title: 'Commission independent marine survey', owner: 'Michael Chen', dueDate: '2026-08-20', status: 'open' },
  { id: 'ac4', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', title: 'Finalise EPC insurance endorsement', owner: 'Priya Sharma', dueDate: '2026-07-25', status: 'closed' },
]

const MOCK_DECISIONS: Decision[] = [
  { id: 'd1', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', title: 'Approve change to bifacial mono-PERC modules', rationale: 'Energy yield +3% with 1.2% cost uplift — NPV positive', decidedBy: 'Sarah Al-Mansouri', date: '2026-07-01', status: 'approved' },
  { id: 'd2', projectId: 'GMC-2026-002', projectName: 'Neom Green Hydrogen Wind', title: 'Accept Vestas V236 instead of GE Haliade-X', rationale: 'Delivery schedule 4 months earlier', decidedBy: 'James Okafor', date: '2026-07-10', status: 'approved' },
  { id: 'd3', projectId: 'GMC-2026-003', projectName: 'Hornsea V Offshore Wind', title: 'Alternative cable route via western corridor', rationale: 'Awaiting environmental impact assessment', decidedBy: '', date: '', status: 'pending' },
]

const MOCK_LESSONS: Lesson[] = [
  { id: 'l1', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', title: 'Early DEWA engagement (6-months pre-NTP) prevents connection delays', phase: 'Engineering', category: 'Regulatory', promoted: true },
  { id: 'l2', projectId: 'GMC-2026-002', projectName: 'Neom Green Hydrogen Wind', title: 'Dual-source WTG qualification reduces long-lead risk', phase: 'Procurement', category: 'Supply Chain', promoted: false },
  { id: 'l3', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', title: 'Module technology lock-in should be delayed to G2 not G1', phase: 'Commercial', category: 'Design', promoted: false },
]

/* ─── Color helpers ─────────────────────────────────────────── */
const PRIORITY_STYLE: Record<ItemPriority, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high:     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  medium:   'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  low:      'bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground',
}
const STATUS_STYLE: Record<ItemStatus, string> = {
  'open': 'bg-slate-100 text-slate-700 dark:bg-muted dark:text-muted-foreground',
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'closed': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'escalated': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function PBadge({ label, color }: { label: string; color: string }) {
  return <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-semibold', color)}>{label}</span>
}

/* ─── Create modal ──────────────────────────────────────────── */
function CreateModal({
  type, onClose, onCreate,
}: {
  type: 'risk' | 'issue' | 'action' | 'decision' | 'lesson'
  onClose: () => void
  onCreate: (data: Record<string, string>) => void
}) {
  const [form, setForm] = React.useState<Record<string, string>>({
    projectId: PROJECTS[0]?.id ?? '', title: '', owner: '', dueDate: '', priority: 'medium', category: '', rationale: '', phase: '',
  })

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
              {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Owner</label>
                  <input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Name"
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Due Date</label>
                  <input value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400" />
                </div>
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
          <Button
            disabled={!form.title.trim()}
            onClick={() => { onCreate(form); onClose() }}
            className="bg-[#0a192f] hover:bg-[#112240] dark:bg-[#64ffda] dark:text-[#0a192f] text-white"
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── KPI Strip ──────────────────────────────────────────────── */
function KpiStrip() {
  const p = PROJECTS
  const green = p.filter(x => x.health === 'green').length
  const amber = p.filter(x => x.health === 'amber').length
  const red = p.filter(x => x.health === 'red').length
  const kpis = [
    { label: 'Total Projects',  value: p.length,         icon: BarChart3,     color: 'text-sky-600' },
    { label: 'On Track',        value: green,             icon: CheckCircle2,  color: 'text-green-600' },
    { label: 'At Risk',         value: amber,             icon: AlertTriangle, color: 'text-amber-500' },
    { label: 'Critical Issues', value: MOCK_ISSUES.filter(i => i.priority === 'critical').length, icon: Flag, color: 'text-red-500' },
    { label: 'Open Actions',    value: MOCK_ACTIONS.filter(a => a.status !== 'closed').length,    icon: ClipboardList, color: 'text-indigo-500' },
    { label: 'Lessons',         value: MOCK_LESSONS.length, icon: BookOpen,     color: 'text-teal-500' },
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
function PmoCharts() {
  const riskByCat = Object.entries(MOCK_RISKS.reduce((acc, r) => { acc[r.category] = (acc[r.category] ?? 0) + 1; return acc }, {} as Record<string, number>))
    .map(([name, value]) => ({ name, value }))

  const healthData = [
    { name: 'On Track', value: PROJECTS.filter(p => p.health === 'green').length, color: '#22c55e' },
    { name: 'At Risk', value: PROJECTS.filter(p => p.health === 'amber').length, color: '#f59e0b' },
    { name: 'Off Track', value: PROJECTS.filter(p => p.health === 'red').length, color: '#ef4444' },
  ]

  const issuesTrend = [
    { month: 'Apr', open: 8, closed: 3 }, { month: 'May', open: 10, closed: 5 },
    { month: 'Jun', open: 7, closed: 8 }, { month: 'Jul', open: MOCK_ISSUES.filter(i => i.status !== 'closed').length, closed: MOCK_ISSUES.filter(i => i.status === 'closed').length },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-foreground mb-4">Risks by Category</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={riskByCat}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-foreground mb-4">Portfolio Health</p>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={healthData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => value > 0 ? `${name} (${value})` : ''} labelLine={false}>
              {healthData.map((d, i) => <Cell key={i} fill={d.color} />)}
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
            <YAxis tick={{ fontSize: 11 }} />
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
  title, icon: Icon, items, columns, onAdd, addLabel,
}: {
  title: string; icon: React.ElementType; items: T[]
  columns: { key: string; label: string; render: (item: T) => React.ReactNode }[]
  onAdd?: () => void; addLabel?: string
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
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 dark:text-muted-foreground text-sm">No entries yet</td></tr>
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
  const [tab, setTab] = React.useState<TabId>('overview')
  const [modal, setModal] = React.useState<'risk' | 'issue' | 'action' | 'decision' | 'lesson' | null>(null)
  const [risks, setRisks] = React.useState(MOCK_RISKS)
  const [issues, setIssues] = React.useState(MOCK_ISSUES)
  const [actions, setActions] = React.useState(MOCK_ACTIONS)
  const [decisions, setDecisions] = React.useState(MOCK_DECISIONS)
  const [lessons, setLessons] = React.useState(MOCK_LESSONS)

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview',   label: 'Overview',   icon: BarChart3      },
    { id: 'risks',      label: 'Risks',      icon: AlertTriangle  },
    { id: 'issues',     label: 'Issues',     icon: Flag           },
    { id: 'actions',    label: 'Actions',    icon: ClipboardList  },
    { id: 'decisions',  label: 'Decisions',  icon: Target         },
    { id: 'lessons',    label: 'Lessons',    icon: Lightbulb      },
  ]

  function handleCreate(type: typeof modal, data: Record<string, string>) {
    const proj = PROJECTS.find(p => p.id === data.projectId)
    const pName = proj?.name ?? data.projectId
    const newId = `${type?.slice(0, 1).toUpperCase()}${Date.now()}`
    mockStore.addAuditEntry({
      actor: 'PMO Director',
      action: type === 'risk' ? 'RISK_CREATED' : type === 'issue' ? 'ISSUE_CREATED' : type === 'action' ? 'ACTION_CREATED' : type === 'decision' ? 'DECISION_CREATED' : 'LESSON_CREATED',
      entityType: type ?? 'item', entityId: newId, projectId: data.projectId, result: 'success', details: { title: data.title },
    })
    if (type === 'risk') setRisks(r => [...r, { id: newId, projectId: data.projectId, projectName: pName, title: data.title, category: data.category || 'General', status: 'open', probability: 50, impact: 50, priority: (data.priority as ItemPriority) || 'medium', owner: data.owner, dueDate: data.dueDate }])
    if (type === 'issue') setIssues(r => [...r, { id: newId, projectId: data.projectId, projectName: pName, title: data.title, status: 'open', priority: (data.priority as ItemPriority) || 'medium', owner: data.owner, dueDate: data.dueDate }])
    if (type === 'action') setActions(r => [...r, { id: newId, projectId: data.projectId, projectName: pName, title: data.title, owner: data.owner, dueDate: data.dueDate, status: 'open' }])
    if (type === 'decision') setDecisions(r => [...r, { id: newId, projectId: data.projectId, projectName: pName, title: data.title, rationale: data.rationale, decidedBy: 'PMO Director', date: new Date().toISOString().slice(0, 10), status: 'pending' }])
    if (type === 'lesson') setLessons(r => [...r, { id: newId, projectId: data.projectId, projectName: pName, title: data.title, phase: data.phase, category: data.category, promoted: false }])
  }

  function escalateIssue(id: string) {
    setIssues(i => i.map(x => x.id === id ? { ...x, status: 'escalated' as ItemStatus, escalated: true } : x))
    mockStore.addAuditEntry({ actor: 'PMO Director', action: 'ISSUE_ESCALATED', entityType: 'issue', entityId: id, result: 'success', details: { escalated: true } })
    mockStore.addNotification({ type: 'issue_escalated', title: 'Issue Escalated', body: `Issue ${id} escalated.`, module: 'PMO', severity: 'critical', recipientRole: 'Project Director', status: 'unread' })
  }

  function closeRisk(id: string) {
    setRisks(r => r.map(x => x.id === id ? { ...x, status: 'closed' as ItemStatus } : x))
    mockStore.addAuditEntry({ actor: 'PMO Director', action: 'RISK_CLOSED', entityType: 'risk', entityId: id, result: 'success', details: {} })
  }

  function promoteLesson(id: string) {
    setLessons(l => l.map(x => x.id === id ? { ...x, promoted: true } : x))
    mockStore.addAuditEntry({ actor: 'PMO Director', action: 'LESSON_PROMOTED', entityType: 'lesson', entityId: id, result: 'success', details: {} })
  }

  function approveDecision(id: string) {
    setDecisions(d => d.map(x => x.id === id ? { ...x, status: 'approved' as const, decidedBy: 'PMO Director', date: new Date().toISOString().slice(0, 10) } : x))
    mockStore.addAuditEntry({ actor: 'PMO Director', action: 'DECISION_APPROVED', entityType: 'decision', entityId: id, result: 'success', details: {} })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground">PMO Cockpit</h1>
        <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">Portfolio-wide risk, issue, action, decision &amp; lesson tracking</p>
      </div>

      <KpiStrip />

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
      {tab === 'overview' && <PmoCharts />}

      {tab === 'risks' && (
        <RegisterTable
          title="Risk Register" icon={AlertTriangle} items={risks}
          onAdd={() => setModal('risk')} addLabel="Add Risk"
          columns={[
            { key: 'id', label: 'ID', render: (r: RiskItem) => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
            { key: 'project', label: 'Project', render: (r: RiskItem) => <span className="text-xs text-slate-600 dark:text-muted-foreground">{r.projectName}</span> },
            { key: 'title', label: 'Title', render: (r: RiskItem) => <span className="text-slate-800 dark:text-foreground font-medium">{r.title}</span> },
            { key: 'cat', label: 'Category', render: (r: RiskItem) => <span className="text-xs text-slate-500">{r.category}</span> },
            { key: 'priority', label: 'Priority', render: (r: RiskItem) => <PBadge label={r.priority} color={PRIORITY_STYLE[r.priority]} /> },
            { key: 'status', label: 'Status', render: (r: RiskItem) => <PBadge label={r.status} color={STATUS_STYLE[r.status]} /> },
            { key: 'owner', label: 'Owner', render: (r: RiskItem) => <span className="text-xs">{r.owner}</span> },
            { key: 'due', label: 'Due', render: (r: RiskItem) => <span className="text-xs text-slate-500">{r.dueDate}</span> },
            { key: 'actions', label: '', render: (r: RiskItem) => r.status !== 'closed' ? (
              <button onClick={() => closeRisk(r.id)} className="text-xs text-green-600 hover:underline">Close</button>
            ) : null },
          ]}
        />
      )}

      {tab === 'issues' && (
        <RegisterTable
          title="Issue Register" icon={Flag} items={issues}
          onAdd={() => setModal('issue')} addLabel="Add Issue"
          columns={[
            { key: 'id', label: 'ID', render: (i: IssueItem) => <span className="font-mono text-xs text-slate-400">{i.id}</span> },
            { key: 'project', label: 'Project', render: (i: IssueItem) => <span className="text-xs text-slate-600 dark:text-muted-foreground">{i.projectName}</span> },
            { key: 'title', label: 'Title', render: (i: IssueItem) => <span className="font-medium text-slate-800 dark:text-foreground">{i.title}</span> },
            { key: 'priority', label: 'Priority', render: (i: IssueItem) => <PBadge label={i.priority} color={PRIORITY_STYLE[i.priority]} /> },
            { key: 'status', label: 'Status', render: (i: IssueItem) => <PBadge label={i.status} color={STATUS_STYLE[i.status]} /> },
            { key: 'owner', label: 'Owner', render: (i: IssueItem) => <span className="text-xs">{i.owner}</span> },
            { key: 'due', label: 'Due', render: (i: IssueItem) => <span className="text-xs text-slate-500">{i.dueDate}</span> },
            { key: 'act', label: '', render: (i: IssueItem) => i.status !== 'escalated' && i.status !== 'closed' ? (
              <button onClick={() => escalateIssue(i.id)} className="text-xs text-red-600 hover:underline">Escalate</button>
            ) : null },
          ]}
        />
      )}

      {tab === 'actions' && (
        <RegisterTable
          title="Action Tracker" icon={ClipboardList} items={actions}
          onAdd={() => setModal('action')} addLabel="Add Action"
          columns={[
            { key: 'id', label: 'ID', render: (a: ActionItem) => <span className="font-mono text-xs text-slate-400">{a.id}</span> },
            { key: 'project', label: 'Project', render: (a: ActionItem) => <span className="text-xs text-slate-600 dark:text-muted-foreground">{a.projectName}</span> },
            { key: 'title', label: 'Action', render: (a: ActionItem) => <span className="font-medium text-slate-800 dark:text-foreground">{a.title}</span> },
            { key: 'status', label: 'Status', render: (a: ActionItem) => <PBadge label={a.status} color={STATUS_STYLE[a.status]} /> },
            { key: 'owner', label: 'Owner', render: (a: ActionItem) => <span className="text-xs">{a.owner}</span> },
            { key: 'due', label: 'Due', render: (a: ActionItem) => <span className="text-xs text-slate-500">{a.dueDate}</span> },
          ]}
        />
      )}

      {tab === 'decisions' && (
        <RegisterTable
          title="Decision Log" icon={Target} items={decisions}
          onAdd={() => setModal('decision')} addLabel="Log Decision"
          columns={[
            { key: 'id', label: 'ID', render: (d: Decision) => <span className="font-mono text-xs text-slate-400">{d.id}</span> },
            { key: 'project', label: 'Project', render: (d: Decision) => <span className="text-xs text-slate-600 dark:text-muted-foreground">{d.projectName}</span> },
            { key: 'title', label: 'Decision', render: (d: Decision) => <span className="font-medium text-slate-800 dark:text-foreground">{d.title}</span> },
            { key: 'rationale', label: 'Rationale', render: (d: Decision) => <span className="text-xs text-slate-500 max-w-[200px] block truncate">{d.rationale}</span> },
            { key: 'by', label: 'Decided By', render: (d: Decision) => <span className="text-xs">{d.decidedBy || '—'}</span> },
            { key: 'status', label: 'Status', render: (d: Decision) => <PBadge label={d.status} color={d.status === 'approved' ? 'bg-green-100 text-green-700' : d.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} /> },
            { key: 'act', label: '', render: (d: Decision) => d.status === 'pending' ? (
              <button onClick={() => approveDecision(d.id)} className="text-xs text-green-600 hover:underline">Approve</button>
            ) : null },
          ]}
        />
      )}

      {tab === 'lessons' && (
        <RegisterTable
          title="Lessons Learned" icon={Lightbulb} items={lessons}
          onAdd={() => setModal('lesson')} addLabel="Add Lesson"
          columns={[
            { key: 'id', label: 'ID', render: (l: Lesson) => <span className="font-mono text-xs text-slate-400">{l.id}</span> },
            { key: 'project', label: 'Project', render: (l: Lesson) => <span className="text-xs text-slate-600 dark:text-muted-foreground">{l.projectName}</span> },
            { key: 'title', label: 'Lesson', render: (l: Lesson) => <span className="font-medium text-slate-800 dark:text-foreground">{l.title}</span> },
            { key: 'phase', label: 'Phase', render: (l: Lesson) => <span className="text-xs">{l.phase}</span> },
            { key: 'cat', label: 'Category', render: (l: Lesson) => <span className="text-xs">{l.category}</span> },
            { key: 'promoted', label: 'Promoted', render: (l: Lesson) => l.promoted ? <CheckCircle2 className="size-4 text-green-500" /> : <span className="text-slate-300">—</span> },
            { key: 'act', label: '', render: (l: Lesson) => !l.promoted ? (
              <button onClick={() => promoteLesson(l.id)} className="text-xs text-sky-600 hover:underline">Promote</button>
            ) : null },
          ]}
        />
      )}

      {modal && (
        <CreateModal
          type={modal}
          onClose={() => setModal(null)}
          onCreate={(d) => handleCreate(modal, d)}
        />
      )}
    </div>
  )
}
