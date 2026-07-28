'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Plus, RefreshCw, Loader2, ClipboardList, DollarSign, Package, X, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  loadProcurementDashboard, issueRFQ, advancePOStatus,
} from '@/app/actions/procurement'
import { getProjects } from '@/app/actions/projects'
import type { RFQRecord, PORecord } from '@/lib/types/action-types'

// ─── Constants ────────────────────────────────────────────────

const RFQ_STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: '#94a3b8' },
  issued:    { label: 'Issued',    color: '#3b82f6' },
  closed:    { label: 'Closed',    color: '#f59e0b' },
  evaluated: { label: 'Evaluated', color: '#a855f7' },
  awarded:   { label: 'Awarded',   color: '#22c55e' },
  cancelled: { label: 'Cancelled', color: '#64748b' },
}
const PO_STATUS_META: Record<string, { label: string; color: string }> = {
  draft:        { label: 'Draft',        color: '#94a3b8' },
  issued:       { label: 'Issued',       color: '#3b82f6' },
  acknowledged: { label: 'Acknowledged', color: '#a855f7' },
  delivered:    { label: 'Delivered',    color: '#22c55e' },
  closed:       { label: 'Closed',       color: '#10b981' },
  disputed:     { label: 'Disputed',     color: '#ef4444' },
}
const BAR_COLORS = ['#64ffda', '#3b82f6', '#f97316', '#a855f7', '#22c55e', '#f59e0b', '#06b6d4', '#ef4444']

// ─── Issue RFQ modal ───────────────────────────────────────────

function IssueRFQModal({ open, onClose, onCreated, projects }: {
  open: boolean; onClose: () => void; onCreated: () => void; projects: any[]
}) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({ title: '', vendor: '', amount_usd: '', close_date: '', projectId: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.vendor) { toast({ title: 'Required fields missing', variant: 'danger' }); return }
    if (!form.projectId) { toast({ title: 'Project required', variant: 'danger' }); return }
    setLoading(true)
    // For now, tenant-wide pages cannot call actions without project context
    // Project-scoped pages would pass projectId here
    const { error } = await issueRFQ({ ...form, amount_usd: Number(form.amount_usd) || 0, projectId: '' })
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'RFQ issued', variant: 'success' })
    onCreated(); onClose()
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Issue RFQ</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Project *</label>
          <select value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40">
            <option value="">Select a project...</option>
            {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        {[
          { label: 'Title *', key: 'title', type: 'text' },
          { label: 'Vendor *', key: 'vendor', type: 'text' },
          { label: 'Estimated Value (USD)', key: 'amount_usd', type: 'number' },
          { label: 'Bid Close Date', key: 'close_date', type: 'date' },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input type={type} value={form[key as keyof typeof form]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>{loading && <Loader2 className="size-3.5 animate-spin" />} Issue RFQ</Button>
        </div>
      </form>
    </div>
  )
}

// ─── PO status stepper ─────────────────────────────────────────

const PO_LIFECYCLE = ['draft', 'issued', 'acknowledged', 'delivered', 'closed']

function POStatusStepper({ status }: { status: string }) {
  const idx = PO_LIFECYCLE.indexOf(status)
  return (
    <div className="flex items-center gap-0.5">
      {PO_LIFECYCLE.map((s, i) => (
        <React.Fragment key={s}>
          <div className={cn('h-1.5 w-5 rounded-full transition-colors', i <= idx ? 'bg-[#64ffda]' : 'bg-muted')} />
          {i < PO_LIFECYCLE.length - 1 && <div className="h-px w-1 bg-border" />}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function ProcurementPage() {
  const { toast } = useToast()
  const [tab, setTab]         = React.useState<'rfqs' | 'pos'>('rfqs')
  const [rfqModal, setRfqModal] = React.useState(false)
  const { data, isLoading, mutate } = useSWR('procurement-dashboard', loadProcurementDashboard, { revalidateOnFocus: true })
  const { data: projects = [] } = useSWR('projects-for-rfq', () => getProjects())

  async function handleAdvancePO(id: string) {
    const { error } = await advancePOStatus(id)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'PO status advanced', variant: 'success' })
    mutate()
  }

  const poValueM = ((data?.poValue ?? 0) / 1_000_000).toFixed(1)
  const kpis = [
    { label: 'Total RFQs',   value: data?.totalRFQs ?? 0, color: '#64ffda', icon: ClipboardList },
    { label: 'Open RFQs',    value: data?.openRFQs  ?? 0, color: '#f59e0b', icon: ClipboardList },
    { label: 'Total POs',    value: data?.totalPOs  ?? 0, color: '#a855f7', icon: Package       },
    { label: 'PO Value ($M)',value: poValueM,             color: '#22c55e', icon: DollarSign    },
  ]

  return (
    <>
      <IssueRFQModal open={rfqModal} onClose={() => setRfqModal(false)} onCreated={() => mutate()} projects={projects} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Procurement</h1>
            <p className="text-sm text-muted-foreground mt-0.5">G3 · RFQ management, vendor scorecards, and purchase order lifecycle</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()}><RefreshCw className="size-3.5" /></Button>
            <Button size="sm" onClick={() => setRfqModal(true)}><Plus className="size-4" /> Issue RFQ</Button>
          </div>
        </div>

        {/* KPIs */}
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
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">RFQ Status Distribution</CardTitle></CardHeader>
            <CardContent className="h-48">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.rfqStatus?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data — seed demo first</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data!.rfqStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {(data?.rfqStatus ?? []).map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">PO Value by Vendor ($M)</CardTitle></CardHeader>
            <CardContent className="h-48">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.poByVendor?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No POs yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.poByVendor} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => [`$${v}M`, 'Value']} />
                    <Bar dataKey="value" name="Value ($M)" radius={[0, 4, 4, 0]}>
                      {(data?.poByVendor ?? []).map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live badge */}
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
          (data?.totalRFQs ?? 0) > 0 ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-muted text-muted-foreground')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', (data?.totalRFQs ?? 0) > 0 ? 'bg-[#22c55e]' : 'bg-muted-foreground')} />
          {(data?.totalRFQs ?? 0) > 0 ? 'Live data' : 'Illustrative — seed demo to populate'}
        </span>

        {/* Tabs */}
        <div role="tablist" className="flex gap-1 border-b border-border">
          {[
            { id: 'rfqs' as const, label: `RFQs (${data?.totalRFQs ?? 0})` },
            { id: 'pos'  as const, label: `Purchase Orders (${data?.totalPOs ?? 0})` },
          ].map(({ id, label }) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === id ? 'border-[#64ffda] text-[#64ffda]' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>

        {/* RFQ table */}
        {tab === 'rfqs' && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.rfqs?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <ClipboardList className="size-12 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground">No RFQs issued</p>
                  <Button size="sm" className="mt-1" onClick={() => setRfqModal(true)}><Plus className="size-4" /> Issue RFQ</Button>
                </div>
              ) : (
                <table className="w-full min-w-[700px] text-sm" role="table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {['RFQ No.', 'Title', 'Vendor', 'Value (USD)', 'Score', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data!.rfqs.map((r) => {
                      const sm = RFQ_STATUS_META[r.status] ?? RFQ_STATUS_META.draft
                      return (
                        <tr key={r.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{r.rfq_number}</td>
                          <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[180px] truncate">{r.title}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{r.vendor}</td>
                          <td className="px-4 py-3 text-sm text-foreground">${(r.amount_usd / 1_000_000).toFixed(1)}M</td>
                          <td className="px-4 py-3">
                            {r.score != null ? (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 bg-muted rounded-full">
                                  <div className="h-1.5 rounded-full bg-[#64ffda]" style={{ width: `${r.score}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-foreground">{r.score}</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                              style={{ color: sm.color, backgroundColor: `${sm.color}15` }}>{sm.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* PO table */}
        {tab === 'pos' && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.pos?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Package className="size-12 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground">No purchase orders</p>
                  <p className="text-xs text-muted-foreground">Purchase orders appear here once issued.</p>
                </div>
              ) : (
                <table className="w-full min-w-[760px] text-sm" role="table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {['PO Number', 'Vendor', 'Description', 'Value (USD)', 'Lifecycle', 'Status', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data!.pos.map((p) => {
                      const sm = PO_STATUS_META[p.status] ?? PO_STATUS_META.draft
                      const isDone = p.status === 'closed' || p.status === 'delivered'
                      return (
                        <tr key={p.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{p.po_number}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{p.vendor}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground max-w-[180px] truncate">{p.description}</td>
                          <td className="px-4 py-3 text-sm font-medium text-foreground">${(p.amount_usd / 1_000_000).toFixed(1)}M</td>
                          <td className="px-4 py-3"><POStatusStepper status={p.status} /></td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                              style={{ color: sm.color, backgroundColor: `${sm.color}15` }}>{sm.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            {!isDone && (
                              <button onClick={() => handleAdvancePO(p.id)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                <ChevronRight className="size-3" /> Advance
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
