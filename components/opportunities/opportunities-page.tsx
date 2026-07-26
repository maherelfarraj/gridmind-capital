'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Plus, Search, RefreshCw, Loader2, Zap, MapPin, DollarSign,
  CheckCircle2, Clock, AlertCircle, XCircle, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  loadOpportunitiesDashboard,
  createOpportunity,
  submitOpportunityForReview,
} from '@/app/actions/opportunities'
import type { Opportunity } from '@/lib/types/action-types'

// ─── Constants ────────────────────────────────────────────────

const TECH_COLORS = ['#64ffda', '#3b82f6', '#f59e0b', '#a855f7', '#22c55e', '#06b6d4']
const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', planning: '#3b82f6', active: '#22c55e',
  on_hold: '#f59e0b', cancelled: '#64748b', completed: '#10b981',
}
const HEALTH_META: Record<string, { color: string; label: string }> = {
  green: { color: '#22c55e', label: 'On Track'  },
  amber: { color: '#f59e0b', label: 'At Risk'   },
  red:   { color: '#ef4444', label: 'Off Track' },
}

// ─── New opportunity modal ─────────────────────────────────────

function NewOpportunityModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    name: '', code: '', technology: 'Solar PV', capacity_mw: '',
    country: '', location: '', budget_usd: '', description: '',
  })

  const TECH_OPTIONS = ['Solar PV', 'Wind', 'BESS', 'Hydrogen', 'Hydro', 'Hybrid']

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.code || !form.country) {
      toast({ title: 'Required fields missing', variant: 'danger' }); return
    }
    setLoading(true)
    const { error } = await createOpportunity({
      name: form.name, code: form.code, technology: form.technology,
      capacity_mw: Number(form.capacity_mw) || 0,
      country: form.country, location: form.location,
      budget_usd: Number(form.budget_usd) || 0,
      description: form.description,
    })
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Opportunity created', description: 'G0 review approval triggered.', variant: 'success' })
    onCreated(); onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="New Opportunity">
      <form onSubmit={handleSubmit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">New G0 Opportunity</h2>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Project Name *', key: 'name', span: true },
            { label: 'Code (e.g. SOL-001) *', key: 'code' },
            { label: 'Country *', key: 'country' },
            { label: 'Location / Site', key: 'location' },
            { label: 'Capacity (MW)', key: 'capacity_mw', type: 'number' },
            { label: 'Budget (USD)', key: 'budget_usd', type: 'number' },
          ].map(({ label, key, type, span }) => (
            <div key={key} className={span ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
              <input
                type={type ?? 'text'}
                value={form[key as keyof typeof form]}
                onChange={(e) => set(key as keyof typeof form, e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40"
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Technology</label>
            <select
              value={form.technology}
              onChange={(e) => set('technology', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40"
            >
              {TECH_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            Create Opportunity
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Opportunity card ──────────────────────────────────────────

function OpportunityCard({ item, onSubmit }: { item: Opportunity; onSubmit: (id: string) => void }) {
  const health  = HEALTH_META[item.health] ?? HEALTH_META.green
  const budgetM = item.budget_usd ? (Number(item.budget_usd) / 1_000_000).toFixed(0) : '—'
  const approvalIcon = {
    pending:      <Clock   className="size-3.5 text-[#f59e0b]" />,
    under_review: <Clock   className="size-3.5 text-[#3b82f6]" />,
    approved:     <CheckCircle2 className="size-3.5 text-[#22c55e]" />,
    rejected:     <XCircle className="size-3.5 text-[#ef4444]" />,
  }[item.approvalStatus ?? 'none'] ?? <AlertCircle className="size-3.5 text-muted-foreground" />

  return (
    <div className="rounded-xl bg-card border border-border p-4 hover:border-[#64ffda]/30 transition-colors space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-mono text-xs text-[#64ffda]">{item.code}</span>
          <h3 className="text-sm font-semibold text-foreground mt-0.5 leading-tight">{item.name}</h3>
        </div>
        <span className="h-2 w-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: health.color }} aria-label={health.label} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Zap className="size-3" />{item.technology}</span>
        <span className="flex items-center gap-1"><TrendingUp className="size-3" />{item.capacity_mw} MW</span>
        <span className="flex items-center gap-1"><MapPin className="size-3" />{item.country}</span>
        <span className="flex items-center gap-1"><DollarSign className="size-3" />${budgetM}M</span>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {approvalIcon}
          <span>{item.approvalStatus ? `Approval: ${item.approvalStatus.replace('_', ' ')}` : 'No approval yet'}</span>
        </div>
        {!item.approvalStatus && (
          <button
            onClick={() => onSubmit(item.id)}
            className="text-xs px-2.5 py-1 rounded-lg bg-[#64ffda]/10 text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors font-medium"
          >
            Submit for G0
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function OpportunitiesPage() {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = React.useState(false)
  const [search, setSearch]       = React.useState('')
  const { data, isLoading, mutate } = useSWR('opportunities-dashboard', loadOpportunitiesDashboard, { revalidateOnFocus: true })

  const filtered = React.useMemo(() => {
    const items = data?.items ?? []
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter((p: any) =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q) ||
      p.technology.toLowerCase().includes(q),
    )
  }, [data, search])

  async function handleSubmit(id: string) {
    const { error } = await submitOpportunityForReview(id)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Submitted for G0 review', variant: 'success' })
    mutate()
  }

  const kpis = [
    { label: 'Total',       value: data?.total       ?? 0, color: '#64ffda', icon: FolderKanban },
    { label: 'Under Review',value: data?.underReview ?? 0, color: '#f59e0b', icon: Clock        },
    { label: 'Approved',    value: data?.approved    ?? 0, color: '#22c55e', icon: CheckCircle2 },
    { label: 'Rejected',    value: data?.rejected    ?? 0, color: '#ef4444', icon: XCircle      },
  ]

  // chart data (convert Record to array format)
  const byTech   = Object.entries(data?.byTechnology ?? {}).map(([name, value]) => ({ name, value }))
  const byStatus = Object.entries(data?.byStatus ?? {}).map(([name, value]: [string, number]) => ({ 
    name, 
    value, 
    color: STATUS_COLORS[name] ?? '#94a3b8' 
  }))

  return (
    <>
      <NewOpportunityModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => mutate()} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Opportunities</h1>
            <p className="text-sm text-muted-foreground mt-0.5">G0 · Intake pipeline — project opportunities awaiting gate approval</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh">
              <RefreshCw className="size-3.5" />
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" /> New Opportunity
            </Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-card border border-border p-4" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
                <Icon className="size-4" style={{ color }} aria-hidden />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Opportunities by Technology</CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              ) : byTech.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data — seed demo first</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byTech} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                      {byTech.map((_: any, i: number) => <Cell key={i} fill={TECH_COLORS[i % TECH_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Pipeline Status</CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              ) : byStatus.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {byStatus.map((entry: any, i: number) => <Cell key={i} fill={entry.color ?? STATUS_COLORS[entry.name] ?? '#94a3b8'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live / Illustrative badge */}
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            (data?.total ?? 0) > 0
              ? 'bg-[#22c55e]/10 text-[#22c55e]'
              : 'bg-muted text-muted-foreground',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', (data?.total ?? 0) > 0 ? 'bg-[#22c55e]' : 'bg-muted-foreground')} />
            {(data?.total ?? 0) > 0 ? 'Live data' : 'Illustrative — seed demo to populate'}
          </span>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search opportunities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-8 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40"
          />
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-card border border-border p-4 animate-pulse h-32" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Zap className="size-12 text-muted-foreground/30 mb-3" />
            <p className="text-base font-semibold text-foreground">No opportunities</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first opportunity or seed demo data.</p>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4" /> New Opportunity</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <OpportunityCard key={item.id} item={item} onSubmit={handleSubmit} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// missing import
import { FolderKanban } from 'lucide-react'
