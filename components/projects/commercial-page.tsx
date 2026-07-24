'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  ArrowLeft, Plus, RefreshCw, Loader2, DollarSign, FileText,
  CheckCircle2, AlertCircle, X, ChevronRight, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  loadCommercialDashboard,
  createCommercialRecord,
  seedCommercialDemoData,
} from '@/app/actions/projects'
import type { CommercialRecord } from '@/app/actions/projects'

// ─── Constants ────────────────────────────────────────────────

const CAT_COLORS = ['#64ffda', '#3b82f6', '#f97316', '#a855f7', '#22c55e', '#f59e0b', '#06b6d4']
const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', committed: '#3b82f6', approved: '#22c55e',
  paid: '#10b981', cancelled: '#ef4444',
}
const STATUS_ICONS: Record<string, React.ReactNode> = {
  approved: <CheckCircle2 className="size-3.5 text-[#22c55e]" />,
  paid:     <CheckCircle2 className="size-3.5 text-[#10b981]" />,
  committed:<AlertCircle  className="size-3.5 text-[#3b82f6]" />,
  draft:    <AlertCircle  className="size-3.5 text-[#94a3b8]" />,
}

function fmtM(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

// ─── Add Record Modal ─────────────────────────────────────────

function AddRecordModal({ open, onClose, projectId, onCreated }: {
  open: boolean; onClose: () => void; projectId: string; onCreated: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    type: 'budget' as const, category: 'Civil Works',
    description: '', amount: '', status: 'draft',
  })
  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description || !form.amount) {
      toast({ title: 'Description and amount are required', variant: 'danger' }); return
    }
    setLoading(true)
    const { error } = await createCommercialRecord({
      project_id: projectId, type: form.type, category: form.category,
      description: form.description, amount: Number(form.amount), status: form.status,
    })
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Record created', variant: 'success' })
    onCreated(); onClose()
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Add Commercial Record</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
          <div className="flex gap-2">
            {(['budget', 'contract', 'cashflow'] as const).map((t) => (
              <button key={t} type="button"
                onClick={() => set('type', t)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
                  form.type === t
                    ? 'bg-[#64ffda]/10 text-[#64ffda] border-[#64ffda]/30'
                    : 'border-border text-muted-foreground hover:text-foreground')}
              >{t}</button>
            ))}
          </div>
        </div>
        {/* Category + Description */}
        {[
          { label: 'Category', key: 'category' as const, placeholder: 'e.g. Civil Works' },
          { label: 'Description', key: 'description' as const, placeholder: 'Short description' },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input type="text" value={form[key]} placeholder={placeholder}
              onChange={(e) => set(key, e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
        ))}
        {/* Amount + Status side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (USD)</label>
            <input type="number" value={form.amount} placeholder="0"
              onChange={(e) => set('amount', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40">
              {['draft', 'committed', 'approved', 'paid', 'cancelled'].map((s) => (
                <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            Add Record
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export function CommercialPage({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = React.useState(false)
  const [seeding, setSeeding]     = React.useState(false)

  const { data, isLoading, mutate } = useSWR(
    `commercial-${projectId}`,
    () => loadCommercialDashboard(projectId),
    { revalidateOnFocus: true },
  )

  async function handleSeed() {
    setSeeding(true)
    const { error } = await seedCommercialDemoData(projectId)
    setSeeding(false)
    if (error) { toast({ title: 'Seed failed', description: error, variant: 'danger' }); return }
    toast({ title: 'Demo data seeded', variant: 'success' })
    mutate()
  }

  const kpis = [
    { label: 'Total Budget',   value: fmtM(data?.totalBudget ?? 0), icon: DollarSign,   color: '#64ffda' },
    { label: 'Committed',      value: fmtM(data?.committed   ?? 0), icon: AlertCircle,  color: '#3b82f6' },
    { label: 'Contracts',      value: String(data?.contracts  ?? 0), icon: FileText,    color: '#f59e0b' },
    { label: 'Records',        value: String(data?.records?.length ?? 0), icon: CheckCircle2, color: '#22c55e' },
  ]

  const byCategory = data?.byCategory ?? []
  const byStatus   = data?.byStatus   ?? []
  const records    = data?.records    ?? []

  return (
    <>
      <AddRecordModal open={modalOpen} onClose={() => setModalOpen(false)} projectId={projectId} onCreated={() => mutate()} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="size-3.5" /> Back to project
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Commercial Charter</h1>
            <p className="text-sm text-muted-foreground mt-0.5">G1 · Budget breakdown, contracts, and cashflow records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh"><RefreshCw className="size-3.5" /></Button>
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="size-3.5 animate-spin" /> : 'Seed Demo'}
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4" /> Add Record</Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl bg-card border border-border p-4" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
                <Icon className="size-4" style={{ color }} aria-hidden />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Contracts register link */}
        <Link
          href={`/projects/${projectId}/contracts`}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-[#f59e0b]/50 hover:bg-muted/30"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f59e0b]/10">
            <ShieldCheck className="size-5 text-[#f59e0b]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Contracts Register</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track EPC and subcontract milestones, liquidated damages and bonds
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Budget by Category</CardTitle>
            </CardHeader>
            <CardContent className="h-52">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : byCategory.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data — seed demo first</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCategory} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`$${(Number(v) / 1e6).toFixed(1)}M`, 'Amount']} />
                    <Bar dataKey="value" name="Amount" radius={[0, 4, 4, 0]}>
                      {byCategory.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Records by Status</CardTitle>
            </CardHeader>
            <CardContent className="h-52">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : byStatus.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {byStatus.map((entry, i) => <Cell key={i} fill={entry.color ?? STATUS_COLORS[entry.name] ?? '#94a3b8'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            records.length > 0 ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-muted text-muted-foreground',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', records.length > 0 ? 'bg-[#22c55e]' : 'bg-muted-foreground')} />
            {records.length > 0 ? 'Live data' : 'Illustrative — seed demo to populate'}
          </span>
        </div>

        {/* Records table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Commercial Records</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-muted/40 animate-pulse" />
              ))}</div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="size-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold text-foreground">No records yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add a record or seed demo data.</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>Seed Demo</Button>
                  <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="size-3.5" /> Add Record</Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Type', 'Category', 'Description', 'Amount', 'Status'].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-xs bg-muted/40 px-1.5 py-0.5 rounded capitalize">{r.type}</span>
                        </td>
                        <td className="py-2.5 px-3 text-foreground font-medium">{r.category}</td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-[220px] truncate">{r.description}</td>
                        <td className="py-2.5 px-3 text-foreground font-semibold font-mono">{fmtM(r.amount ?? 0)}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                            style={{ background: `${STATUS_COLORS[r.status] ?? '#94a3b8'}20`, color: STATUS_COLORS[r.status] ?? '#94a3b8' }}>
                            {STATUS_ICONS[r.status]}
                            <span className="capitalize">{r.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
