'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'
import {
  Users, ArrowLeft, Plus, RefreshCw, Filter, Download,
  Mail, Phone, AlertTriangle, MessageSquare, ChevronDown, ChevronUp,
  TrendingUp, Shield, Eye, Loader2, Database,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts'
import { cn } from '@/lib/utils'
import { loadStakeholdersDashboard, createStakeholder, seedStakeholdersDemoData } from '@/app/actions/projects'
import type { Stakeholder } from '@/app/actions/projects'

// ─── Types ────────────────────────────────────────────────────

interface EngagementPlan {
  stakeholderId: string
  strategy: string
  frequency: string
  method: string
  owner: string
  nextAction: string
  nextActionDate: string
}

interface CommLog {
  id: string
  stakeholder: string
  date: string
  method: string
  summary: string
  outcome: 'positive' | 'neutral' | 'negative'
  followUp: string | null
}

interface Issue {
  id: string
  stakeholder: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'resolved'
  raised: string
  owner: string
  resolution: string | null
}

// ─── Mock data ────────────────────────────────────────────────

const MOCK_STAKEHOLDERS: Stakeholder[] = [
  { id: 's1', project_id: 'p1', name: 'Ministry of Energy',    organisation: 'Government of KSA',    role: 'Regulator',      influence: 5, interest: 4, engagement: 'high',     notes: 'Grid connection and generation licence authority.',  created_at: '2026-01-10T10:00:00Z' },
  { id: 's2', project_id: 'p1', name: 'ACWA Power',            organisation: 'Owner / Sponsor',       role: 'Client',         influence: 5, interest: 5, engagement: 'high',     notes: 'Project sponsor and PPA off-taker.',                  created_at: '2026-01-10T10:00:00Z' },
  { id: 's3', project_id: 'p1', name: 'Saudi Electricity Co.', organisation: 'Utility',               role: 'Grid Operator',  influence: 5, interest: 3, engagement: 'medium',   notes: 'Evacuation point agreement and grid access.',          created_at: '2026-01-11T10:00:00Z' },
  { id: 's4', project_id: 'p1', name: 'IFC / World Bank',      organisation: 'Multilateral Lender',   role: 'Lender',         influence: 4, interest: 5, engagement: 'high',     notes: 'Project finance lender — E&S covenants apply.',       created_at: '2026-01-11T10:00:00Z' },
  { id: 's5', project_id: 'p1', name: 'Aljouf Municipality',   organisation: 'Local Government',      role: 'Authority',      influence: 3, interest: 4, engagement: 'medium',   notes: 'Local land use permits and community liaison.',        created_at: '2026-01-12T10:00:00Z' },
  { id: 's6', project_id: 'p1', name: 'EPC Consortium JV',     organisation: 'Contractor',            role: 'Contractor',     influence: 3, interest: 5, engagement: 'high',     notes: 'Main EPC contractor — lump sum turnkey.',             created_at: '2026-01-12T10:00:00Z' },
  { id: 's7', project_id: 'p1', name: 'Desert Solar NGO',      organisation: 'Environmental NGO',     role: 'Watchdog',       influence: 2, interest: 3, engagement: 'low',      notes: 'Biodiversity and land-use concerns. Quarterly briefings recommended.', created_at: '2026-01-13T10:00:00Z' },
  { id: 's8', project_id: 'p1', name: 'Bedouin Community Rep.', organisation: 'Local Community',     role: 'Community',      influence: 2, interest: 4, engagement: 'medium',   notes: 'Land access rights and community benefit programme.',  created_at: '2026-01-13T10:00:00Z' },
  { id: 's9', project_id: 'p1', name: 'Riyadh Capital',        organisation: 'Equity Investor',       role: 'Investor',       influence: 4, interest: 4, engagement: 'high',     notes: 'Equity co-investor — requires monthly IRR updates.',  created_at: '2026-01-14T10:00:00Z' },
  { id: 's10', project_id: 'p1', name: 'NEOM Authority',       organisation: 'Special Economic Zone', role: 'Regulator',      influence: 4, interest: 3, engagement: 'medium',   notes: 'NEOM grid integration and development zone approval.', created_at: '2026-01-14T10:00:00Z' },
]

const MOCK_PLANS: EngagementPlan[] = [
  { stakeholderId: 's1', strategy: 'Monitor and maintain',   frequency: 'Monthly',    method: 'Formal meeting',   owner: 'M. Al-Farsi',  nextAction: 'Quarterly regulatory briefing',    nextActionDate: '2026-08-05' },
  { stakeholderId: 's2', strategy: 'Manage closely',         frequency: 'Weekly',     method: 'Steering Cmte.',   owner: 'J. Rivera',    nextAction: 'Monthly progress report',           nextActionDate: '2026-08-01' },
  { stakeholderId: 's3', strategy: 'Keep satisfied',         frequency: 'Quarterly',  method: 'Site visit',       owner: 'A. Carter',    nextAction: 'Evacuation point review',           nextActionDate: '2026-09-01' },
  { stakeholderId: 's4', strategy: 'Manage closely',         frequency: 'Monthly',    method: 'Lender call',      owner: 'J. Rivera',    nextAction: 'E&S compliance update',             nextActionDate: '2026-08-15' },
  { stakeholderId: 's5', strategy: 'Keep informed',          frequency: 'Bi-monthly', method: 'Community liaison',owner: 'M. Al-Farsi',  nextAction: 'Planning consent hearing',          nextActionDate: '2026-08-20' },
  { stakeholderId: 's6', strategy: 'Manage closely',         frequency: 'Weekly',     method: 'EPC meeting',      owner: 'R. Chen',      nextAction: 'IFC drawing review',                nextActionDate: '2026-07-28' },
  { stakeholderId: 's7', strategy: 'Keep informed',          frequency: 'Quarterly',  method: 'Briefing pack',    owner: 'M. Al-Farsi',  nextAction: 'Q3 environmental briefing',         nextActionDate: '2026-09-15' },
  { stakeholderId: 's8', strategy: 'Keep informed',          frequency: 'Monthly',    method: 'Community meeting',owner: 'M. Al-Farsi',  nextAction: 'Community benefit update',          nextActionDate: '2026-08-10' },
  { stakeholderId: 's9', strategy: 'Manage closely',         frequency: 'Monthly',    method: 'Investor call',    owner: 'J. Rivera',    nextAction: 'Monthly IRR update pack',           nextActionDate: '2026-08-01' },
  { stakeholderId: 's10', strategy: 'Keep satisfied',        frequency: 'Quarterly',  method: 'Formal meeting',   owner: 'A. Carter',    nextAction: 'Development zone progress brief',   nextActionDate: '2026-09-01' },
]

const MOCK_COMMS: CommLog[] = [
  { id: 'c1', stakeholder: 'Ministry of Energy',    date: '2026-07-15', method: 'Formal Meeting', summary: 'Discussed grid connection timeline and licence application progress.', outcome: 'positive',  followUp: 'Submit licence application by 30 Aug.' },
  { id: 'c2', stakeholder: 'ACWA Power',            date: '2026-07-12', method: 'Steering Cmte.', summary: 'Reviewed G1 deliverables and IRR sensitivity analysis.',             outcome: 'positive',  followUp: 'Confirm financial model assumptions.' },
  { id: 'c3', stakeholder: 'IFC / World Bank',      date: '2026-07-08', method: 'Lender Call',    summary: 'E&S action plan reviewed. Two items flagged for clarification.',    outcome: 'neutral',   followUp: 'Provide EIA scoping by 25 Jul.' },
  { id: 'c4', stakeholder: 'Bedouin Community Rep.', date: '2026-07-05', method: 'Community Meeting', summary: 'Land access compensation discussed. Community raised access road concerns.', outcome: 'negative', followUp: 'Convene second meeting with legal team.' },
  { id: 'c5', stakeholder: 'EPC Consortium JV',     date: '2026-07-02', method: 'EPC Meeting',    summary: 'IFC drawing schedule reviewed. One-week delay flagged.',             outcome: 'neutral',   followUp: 'Recovery programme due 10 Jul.' },
  { id: 'c6', stakeholder: 'Riyadh Capital',        date: '2026-06-30', method: 'Investor Call',  summary: 'Q2 performance update delivered. IRR revised to 12.4%.',            outcome: 'positive',  followUp: null },
]

const MOCK_ISSUES: Issue[] = [
  { id: 'i1', stakeholder: 'Bedouin Community Rep.', title: 'Land access road compensation dispute', severity: 'high',   status: 'in_progress', raised: '2026-07-05', owner: 'M. Al-Farsi', resolution: null },
  { id: 'i2', stakeholder: 'IFC / World Bank',       title: 'EIA scoping opinion delayed',           severity: 'medium', status: 'open',        raised: '2026-07-08', owner: 'A. Carter',   resolution: null },
  { id: 'i3', stakeholder: 'Saudi Electricity Co.',  title: 'Evacuation point capacity constrained',  severity: 'critical', status: 'open',      raised: '2026-06-20', owner: 'J. Rivera',   resolution: null },
  { id: 'i4', stakeholder: 'Desert Solar NGO',       title: 'Biodiversity impact study requested',   severity: 'low',    status: 'resolved',    raised: '2026-06-01', owner: 'M. Al-Farsi', resolution: 'Agreed to include specialist appendix in EIA.' },
]

// ─── Constants ────────────────────────────────────────────────

const ENGAGEMENT_META: Record<string, { label: string; color: string }> = {
  high:      { label: 'High',      color: '#22c55e' },
  medium:    { label: 'Medium',    color: '#3b82f6' },
  low:       { label: 'Low',       color: '#f59e0b' },
  resistant: { label: 'Resistant', color: '#ef4444' },
}

const SEVERITY_META: Record<Issue['severity'], { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-red-500/15 text-red-400' },
  high:     { label: 'High',     cls: 'bg-orange-500/15 text-orange-400' },
  medium:   { label: 'Medium',   cls: 'bg-amber-500/15 text-amber-400' },
  low:      { label: 'Low',      cls: 'bg-slate-500/15 text-slate-400' },
}

const STATUS_META: Record<Issue['status'], { label: string; cls: string }> = {
  open:        { label: 'Open',        cls: 'bg-red-500/15 text-red-400' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-500/15 text-blue-400' },
  resolved:    { label: 'Resolved',    cls: 'bg-emerald-500/15 text-emerald-400' },
}

const OUTCOME_META: Record<CommLog['outcome'], { cls: string; label: string }> = {
  positive: { cls: 'bg-emerald-500/15 text-emerald-400', label: 'Positive' },
  neutral:  { cls: 'bg-slate-500/15 text-slate-400',     label: 'Neutral' },
  negative: { cls: 'bg-red-500/15 text-red-400',         label: 'Negative' },
}

function quadrantLabel(inf: number, int: number) {
  if (inf >= 3 && int >= 3)  return 'Manage Closely'
  if (inf >= 3 && int < 3)   return 'Keep Satisfied'
  if (inf < 3  && int >= 3)  return 'Keep Informed'
  return 'Monitor'
}

// ─── Add Stakeholder Modal ────────────────────────────────────

function AddStakeholderModal({
  open, onClose, projectId, onCreated,
}: {
  open: boolean; onClose: () => void; projectId: string; onCreated: () => void
}) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [form, setForm] = React.useState({
    name: '', organisation: '', role: 'Client',
    influence: 3, interest: 3, engagement: 'medium', notes: '',
  })
  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.organisation) { setError('Name and organisation are required.'); return }
    setError('')
    setLoading(true)
    const res = await createStakeholder({ project_id: projectId, ...form, notes: form.notes || undefined })
    setLoading(false)
    if (res.error) { setError(res.error); return }
    onCreated()
    onClose()
    setForm({ name: '', organisation: '', role: 'Client', influence: 3, interest: 3, engagement: 'medium', notes: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogClose onClose={onClose} />
        <DialogHeader>
          <DialogTitle>Add Stakeholder</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" aria-label="Add stakeholder form">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="sh-name">Name *</label>
              <Input id="sh-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ministry of Energy" required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="sh-org">Organisation *</label>
              <Input id="sh-org" value={form.organisation} onChange={(e) => set('organisation', e.target.value)} placeholder="Government" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="sh-role">Role</label>
              <select id="sh-role" value={form.role} onChange={(e) => set('role', e.target.value)}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
                {['Client','Regulator','Lender','Contractor','Authority','Community','Investor','Grid Operator','Watchdog'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="sh-inf">Influence (1-5)</label>
              <Input id="sh-inf" type="number" min={1} max={5} value={form.influence} onChange={(e) => set('influence', Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="sh-int">Interest (1-5)</label>
              <Input id="sh-int" type="number" min={1} max={5} value={form.interest} onChange={(e) => set('interest', Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="sh-eng">Engagement Level</label>
            <select id="sh-eng" value={form.engagement} onChange={(e) => set('engagement', e.target.value)}
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="resistant">Resistant</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="sh-notes">Notes</label>
            <Textarea id="sh-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Key interests, concerns, communication preferences…" />
          </div>
          {error && (
            <p className="text-xs text-red-400" role="alert">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Add Stakeholder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tab: Register ────────────────────────────────────────────

function RegisterTab({
  stakeholders, onAdd, projectId, onRefresh, isLive,
}: {
  stakeholders: Stakeholder[]; onAdd: () => void; projectId: string; onRefresh: () => void; isLive: boolean
}) {
  const [search, setSearch] = React.useState('')
  const [engFilter, setEngFilter] = React.useState('all')
  const [expanded, setExpanded] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => stakeholders.filter((s) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.organisation.toLowerCase().includes(search.toLowerCase())
    const matchEng = engFilter === 'all' || s.engagement === engFilter
    return matchSearch && matchEng
  }), [stakeholders, search, engFilter])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search stakeholders…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            aria-label="Search stakeholders"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {['all', 'high', 'medium', 'low', 'resistant'].map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEngFilter(e)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold rounded-full capitalize transition-colors',
                engFilter === e
                  ? 'bg-[#0a192f] dark:bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
              )}
            >
              {e}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} aria-label="Refresh">
          <RefreshCw className="size-3.5 mr-1.5" />Refresh
        </Button>
        <Button size="sm" onClick={onAdd}>
          <Plus className="size-3.5 mr-1.5" />Add
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stakeholder</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Organisation</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Role</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Inf.</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Int.</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Engagement</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quadrant</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {filtered.map((s, i) => {
                const eng  = ENGAGEMENT_META[s.engagement] ?? ENGAGEMENT_META.medium
                const quad = quadrantLabel(s.influence, s.interest)
                const isOpen = expanded === s.id
                return (
                  <React.Fragment key={s.id}>
                    <motion.tr
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className={cn(
                        'border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors',
                        isOpen && 'bg-muted/20',
                      )}
                      onClick={() => setExpanded(isOpen ? null : s.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7 shrink-0">
                            <AvatarFallback className="text-[9px] font-bold bg-[#0a192f]/10 dark:bg-sky-900/30 text-[#0a192f] dark:text-sky-400">
                              {s.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground truncate max-w-[140px]">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{s.organisation}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{s.role}</td>
                      <td className="px-4 py-3 text-center font-mono text-foreground font-semibold">{s.influence}/5</td>
                      <td className="px-4 py-3 text-center font-mono text-foreground font-semibold">{s.interest}/5</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                          style={{ background: `${eng.color}20`, color: eng.color }}
                        >
                          <span className="size-1.5 rounded-full" style={{ background: eng.color }} />
                          {eng.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{quad}</td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </td>
                    </motion.tr>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.tr
                          key={`${s.id}-detail`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <td colSpan={8} className="px-6 pb-4 bg-muted/10">
                            <p className="text-sm text-muted-foreground leading-relaxed pt-2">
                              {s.notes ?? 'No notes.'}
                            </p>
                            <div className="flex gap-3 mt-3">
                              <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                <Mail className="size-3.5" />Email
                              </button>
                              <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                <MessageSquare className="size-3.5" />Log Communication
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                )
              })}
            </AnimatePresence>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No stakeholders match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {isLive ? 'Live' : 'Illustrative'} · {filtered.length} of {stakeholders.length} stakeholders
      </p>
    </div>
  )
}

// ─── Tab: Matrix ──────────────────────────────────────────────

function MatrixTab({ stakeholders }: { stakeholders: Stakeholder[] }) {
  const data = stakeholders.map((s) => ({
    x: s.interest,
    y: s.influence,
    name: s.name,
    engagement: s.engagement,
    id: s.id,
  }))

  const byRole = React.useMemo(() => {
    const m: Record<string, number> = {}
    stakeholders.forEach((s) => { m[s.role] = (m[s.role] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  }, [stakeholders])

  const ROLE_COLORS = ['#64ffda', '#3b82f6', '#f97316', '#a855f7', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scatter matrix */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Influence / Interest Matrix
          </p>
          <div className="bg-card border border-border rounded-xl p-4">
            {/* Quadrant labels overlay */}
            <div className="relative">
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none z-10" style={{ margin: '20px 16px 40px 48px' }}>
                <div className="flex items-start justify-start p-2">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Keep Satisfied</span>
                </div>
                <div className="flex items-start justify-end p-2">
                  <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">Manage Closely</span>
                </div>
                <div className="flex items-end justify-start p-2">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Monitor</span>
                </div>
                <div className="flex items-end justify-end p-2">
                  <span className="text-[9px] font-semibold text-sky-500 uppercase tracking-wider">Keep Informed</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 20, right: 16, bottom: 40, left: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number" dataKey="x" domain={[0.5, 5.5]} ticks={[1,2,3,4,5]}
                    label={{ value: 'Interest →', position: 'insideBottom', offset: -8, fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis
                    type="number" dataKey="y" domain={[0.5, 5.5]} ticks={[1,2,3,4,5]}
                    label={{ value: 'Influence', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  />
                  <ReferenceLine x={3} stroke="var(--border)" strokeDasharray="4 2" />
                  <ReferenceLine y={3} stroke="var(--border)" strokeDasharray="4 2" />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                    content={({ payload }) => {
                      if (!payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-card border border-border rounded-lg p-2.5 text-xs shadow-lg">
                          <p className="font-semibold text-foreground">{d.name}</p>
                          <p className="text-muted-foreground">Influence: {d.y} · Interest: {d.x}</p>
                          <p className="text-muted-foreground capitalize">Engagement: {d.engagement}</p>
                          <p className="text-muted-foreground">{quadrantLabel(d.y, d.x)}</p>
                        </div>
                      )
                    }}
                  />
                  <Scatter
                    data={data}
                    fill="#64ffda"
                    shape={(props: any) => {
                      const eng = ENGAGEMENT_META[props.payload.engagement] ?? ENGAGEMENT_META.medium
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={8}
                          fill={`${eng.color}40`}
                          stroke={eng.color}
                          strokeWidth={2}
                        />
                      )
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {Object.entries(ENGAGEMENT_META).map(([key, meta]) => (
                <div key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground capitalize">
                  <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
                  {meta.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* By role chart */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Stakeholders by Role
          </p>
          <div className="bg-card border border-border rounded-xl p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byRole} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} width={95} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v) => [v, 'Count']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {byRole.map((_, i) => (
                    <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quadrant summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Manage Closely', desc: 'High influence + High interest', color: '#22c55e', minInf: 3, minInt: 3 },
          { label: 'Keep Satisfied', desc: 'High influence + Low interest',  color: '#3b82f6', minInf: 3, minInt: 0 },
          { label: 'Keep Informed',  desc: 'Low influence + High interest',  color: '#f59e0b', minInf: 0, minInt: 3 },
          { label: 'Monitor',        desc: 'Low influence + Low interest',   color: '#94a3b8', minInf: 0, minInt: 0 },
        ].map((q) => {
          const count = stakeholders.filter((s) => quadrantLabel(s.influence, s.interest) === q.label).length
          return (
            <div key={q.label} className="rounded-xl border border-border bg-card p-4" style={{ borderLeftColor: q.color, borderLeftWidth: 3 }}>
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider mt-1" style={{ color: q.color }}>{q.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{q.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Engagement Plan ─────────────────────────────────────

function EngagementTab({ stakeholders, plans }: { stakeholders: Stakeholder[]; plans: EngagementPlan[] }) {
  const nameMap = React.useMemo(() => Object.fromEntries(stakeholders.map((s) => [s.id, s.name])), [stakeholders])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{plans.length} engagement plans defined</p>
        <Button size="sm" variant="outline">
          <Download className="size-3.5 mr-1.5" />Export Plan
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Stakeholder','Strategy','Frequency','Method','Owner','Next Action','Due'].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((p, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{nameMap[p.stakeholderId] ?? p.stakeholderId}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.strategy}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{p.frequency}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.method}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.owner}</td>
                <td className="px-4 py-3 text-foreground max-w-[200px] truncate">{p.nextAction}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs whitespace-nowrap">{p.nextActionDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Communication Log ───────────────────────────────────

function CommsTab({ logs }: { logs: CommLog[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{logs.length} communications logged</p>
        <Button size="sm" variant="outline">
          <Plus className="size-3.5 mr-1.5" />Log Communication
        </Button>
      </div>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" aria-hidden />
        <div className="space-y-4">
          {logs.map((log, i) => {
            const outcome = OUTCOME_META[log.outcome]
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                className="flex gap-4 pl-10 relative"
              >
                {/* Dot */}
                <span
                  className="absolute left-3.5 top-1.5 size-3 rounded-full border-2 border-background"
                  style={{ background: outcome.cls.includes('emerald') ? '#22c55e' : outcome.cls.includes('red') ? '#ef4444' : '#94a3b8' }}
                />
                <div className="flex-1 bg-card border border-border rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{log.stakeholder}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{log.method} · {log.date}</p>
                    </div>
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', outcome.cls)}>
                      {outcome.label}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-2 leading-relaxed">{log.summary}</p>
                  {log.followUp && (
                    <p className="text-xs text-amber-400 mt-2 flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      Follow-up: {log.followUp}
                    </p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Issues & Escalations ────────────────────────────────

function IssuesTab({ issues }: { issues: Issue[] }) {
  const open = issues.filter((i) => i.status !== 'resolved').length
  const critical = issues.filter((i) => i.severity === 'critical').length

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open Issues',   value: open,          color: '#ef4444' },
          { label: 'Critical',      value: critical,      color: '#f97316' },
          { label: 'Total Issues',  value: issues.length, color: '#64ffda' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center" style={{ borderTopColor: s.color, borderTopWidth: 2 }}>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Issues table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Issue','Stakeholder','Severity','Status','Raised','Owner'].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {issues.map((iss) => {
              const sev = SEVERITY_META[iss.severity]
              const st  = STATUS_META[iss.status]
              return (
                <tr key={iss.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{iss.title}</p>
                    {iss.resolution && (
                      <p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
                        <Shield className="size-3" />Resolution: {iss.resolution}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{iss.stakeholder}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', sev.cls)}>{sev.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', st.cls)}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{iss.raised}</td>
                  <td className="px-4 py-3 text-muted-foreground">{iss.owner}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function StakeholderManagementPage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const id      = params?.id ?? 'demo'

  const { data, isLoading, mutate } = useSWR(
    id ? `stakeholders-${id}` : null,
    () => loadStakeholdersDashboard(id),
    { revalidateOnFocus: false },
  )

  const [addOpen, setAddOpen]   = React.useState(false)
  const [seeding, setSeeding]   = React.useState(false)

  const stakeholders: Stakeholder[] = (data?.items?.length ?? 0) > 0 ? (data?.items ?? []) : MOCK_STAKEHOLDERS
  const isLive = (data?.items?.length ?? 0) > 0
  const engComplete = stakeholders.filter((s) => s.engagement === 'high').length
  const completePct = Math.round((engComplete / Math.max(stakeholders.length, 1)) * 100)

  async function handleSeed() {
    setSeeding(true)
    await seedStakeholdersDemoData(id)
    await mutate()
    setSeeding(false)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={() => router.push(`/projects/${id}`)} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="size-4" />Project
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">Stakeholder Management</span>
        <span className="ml-auto flex items-center gap-2">
          <span className={cn('text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full',
            isLive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400')}>
            {isLive ? 'Live' : 'Illustrative'}
          </span>
          {!isLive && (
            <button type="button" onClick={handleSeed} disabled={seeding}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50">
              <Database className="size-3.5" />
              {seeding ? 'Seeding…' : 'Seed Demo'}
            </button>
          )}
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="size-6 text-sky-500" />
            Stakeholder Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">G1 Gate — Development Phase</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">High Engagement</p>
            <p className="text-sm font-semibold text-foreground">{engComplete} / {stakeholders.length}</p>
          </div>
          <div className="w-32">
            <Progress value={completePct} className="h-2" aria-label={`${completePct}% high engagement`} />
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: stakeholders.length,                                             color: '#64ffda' },
          { label: 'High Engage', value: stakeholders.filter((s) => s.engagement === 'high').length,     color: '#22c55e' },
          { label: 'Manage Closely', value: stakeholders.filter((s) => quadrantLabel(s.influence, s.interest) === 'Manage Closely').length, color: '#3b82f6' },
          { label: 'Issues',      value: MOCK_ISSUES.filter((i) => i.status !== 'resolved').length,      color: '#f97316' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4" style={{ borderLeftColor: k.color, borderLeftWidth: 3 }}>
            <p className="text-2xl font-bold text-foreground">{k.value}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="register">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="register">Register</TabsTrigger>
            <TabsTrigger value="matrix">Matrix</TabsTrigger>
            <TabsTrigger value="engagement">Engagement Plan</TabsTrigger>
            <TabsTrigger value="comms">Comms Log</TabsTrigger>
            <TabsTrigger value="issues">Issues &amp; Escalations</TabsTrigger>
          </TabsList>

          <TabsContent value="register">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <RegisterTab
                stakeholders={stakeholders}
                onAdd={() => setAddOpen(true)}
                projectId={id}
                onRefresh={() => mutate()}
                isLive={isLive}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="matrix">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <MatrixTab stakeholders={stakeholders} />
            </motion.div>
          </TabsContent>

          <TabsContent value="engagement">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <EngagementTab stakeholders={stakeholders} plans={MOCK_PLANS} />
            </motion.div>
          </TabsContent>

          <TabsContent value="comms">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <CommsTab logs={MOCK_COMMS} />
            </motion.div>
          </TabsContent>

          <TabsContent value="issues">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <IssuesTab issues={MOCK_ISSUES} />
            </motion.div>
          </TabsContent>
        </Tabs>
      )}

      {/* Add Stakeholder Modal */}
      <AddStakeholderModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        projectId={id}
        onCreated={() => mutate()}
      />
    </div>
  )
}
