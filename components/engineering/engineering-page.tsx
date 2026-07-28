'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Plus, RefreshCw, Loader2, Wrench, FileText, AlertTriangle, CheckCircle2,
  ChevronDown, X, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  loadEngineeringDashboard, createRFI, closeRFI,
} from '@/app/actions/engineering'
import { getProjects } from '@/app/actions/projects'
import type { IFCPackage, RFIRecord } from '@/lib/types/action-types'

// ─── Constants ────────────────────────────────────────────────

const IFC_STATUS_META: Record<string, { label: string; color: string }> = {
  draft:      { label: 'Draft',      color: '#94a3b8' },
  in_review:  { label: 'In Review',  color: '#f59e0b' },
  approved:   { label: 'Approved',   color: '#22c55e' },
  rejected:   { label: 'Rejected',   color: '#ef4444' },
  superseded: { label: 'Superseded', color: '#64748b' },
}

// ─── New RFI modal ─────────────────────────────────────────────

function NewRFIModal({ open, onClose, onCreated, projects }: {
  open: boolean; onClose: () => void; onCreated: () => void; projects: any[]
}) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({ title: '', discipline: 'Civil', description: '', projectId: '' })
  const DISCS = ['Civil', 'Structural', 'Mechanical', 'Electrical', 'Instrumentation', 'Architectural']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title) { toast({ title: 'Title required', variant: 'danger' }); return }
    if (!form.projectId) { toast({ title: 'Project required', variant: 'danger' }); return }
    setLoading(true)
    // For now, tenant-wide pages cannot call actions without project context
    // Project-scoped pages would pass projectId here
    const { error } = await createRFI({ ...form, projectId: '' })
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'RFI submitted', variant: 'success' })
    onCreated(); onClose()
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">New RFI</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Project *</label>
            <select value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Select a project...</option>
              {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Discipline</label>
            <select value={form.discipline} onChange={(e) => setForm((f) => ({ ...f, discipline: e.target.value }))}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40">
              {DISCS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>{loading && <Loader2 className="size-3.5 animate-spin" />} Submit RFI</Button>
        </div>
      </form>
    </div>
  )
}

// ─── IFC Package row ───────────────────────────────────────────

function PackageRow({ pkg }: { pkg: IFCPackage }) {
  const sm = IFC_STATUS_META[pkg.status] ?? IFC_STATUS_META.draft
  return (
    <tr className="border-b border-border hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{pkg.package_number}</td>
      <td className="px-4 py-3 text-sm font-medium text-foreground">{pkg.discipline}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{pkg.title}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{pkg.revision}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full min-w-[60px]">
            <div className="h-1.5 rounded-full" style={{ width: `${pkg.completion_pct}%`, backgroundColor: sm.color }} />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{pkg.completion_pct}%</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
          style={{ color: sm.color, backgroundColor: `${sm.color}15` }}>{sm.label}</span>
      </td>
    </tr>
  )
}

// ─── RFI row ───────────────────────────────────────────────────

function RFIRow({ item, onClose }: { item: RFIRecord; onClose: (id: string) => void }) {
  return (
    <tr className="border-b border-border hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{item.ref}</td>
      <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[200px] truncate">{item.title}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{item.discipline}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs">
          {item.is_overdue ? (
            <span className="flex items-center gap-1 text-[#ef4444]"><Clock className="size-3" />{item.days_open}d overdue</span>
          ) : (
            <span className="text-muted-foreground">{item.days_open}d open</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold',
          item.status === 'closed' ? 'bg-[#22c55e]/10 text-[#22c55e]' :
          item.is_overdue ? 'bg-[#ef4444]/10 text-[#ef4444]' :
          'bg-[#f59e0b]/10 text-[#f59e0b]')}>
          {item.status === 'closed' ? 'Closed' : item.is_overdue ? 'Overdue' : 'Open'}
        </span>
      </td>
      <td className="px-4 py-3">
        {item.status !== 'closed' && (
          <button onClick={() => onClose(item.id)}
            className="text-xs px-2 py-1 rounded bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Close
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Main page ─────────────────────────────────────���─────��────

export function EngineeringPage() {
  const { toast } = useToast()
  const [tab, setTab] = React.useState<'packages' | 'rfis' | 'drawings'>('packages')
  const [rfiModal, setRfiModal] = React.useState(false)
  const { data, isLoading, mutate } = useSWR('engineering-dashboard', loadEngineeringDashboard, { revalidateOnFocus: true })
  const { data: projects = [] } = useSWR('projects-for-rfi', () => getProjects())

  async function handleCloseRFI(id: string) {
    const { error } = await closeRFI(id)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'RFI closed', variant: 'success' })
    mutate()
  }

  const kpis = [
    { label: 'IFC Packages', value: data?.totalPackages    ?? 0, color: '#64ffda', icon: FileText     },
    { label: 'Approved',     value: data?.approvedPackages ?? 0, color: '#22c55e', icon: CheckCircle2 },
    { label: 'Open RFIs',    value: data?.openRFIs         ?? 0, color: '#f59e0b', icon: Wrench       },
    { label: 'Overdue RFIs', value: data?.overdueRFIs      ?? 0, color: '#ef4444', icon: AlertTriangle},
  ]

  return (
    <>
      <NewRFIModal open={rfiModal} onClose={() => setRfiModal(false)} onCreated={() => mutate()} projects={projects} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Engineering</h1>
            <p className="text-sm text-muted-foreground mt-0.5">G2 · IFC packages, drawing register, and RFI management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()}><RefreshCw className="size-3.5" /></Button>
            <Button size="sm" onClick={() => setRfiModal(true)}><Plus className="size-4" /> New RFI</Button>
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
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">IFC Progress by Discipline</CardTitle></CardHeader>
            <CardContent className="h-48">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.byDiscipline?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data — seed demo first</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.byDiscipline} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" name="Packages" radius={[4, 4, 0, 0]}>
                      {(data?.byDiscipline ?? []).map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">RFI Status</CardTitle></CardHeader>
            <CardContent className="h-48">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.rfiStatus?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No RFIs yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data!.rfiStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {(data?.rfiStatus ?? []).map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live badge */}
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
          (data?.totalPackages ?? 0) > 0 ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-muted text-muted-foreground')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', (data?.totalPackages ?? 0) > 0 ? 'bg-[#22c55e]' : 'bg-muted-foreground')} />
          {(data?.totalPackages ?? 0) > 0 ? 'Live data' : 'Illustrative — seed demo to populate'}
        </span>

        {/* Tabs */}
        <div role="tablist" className="flex gap-1 border-b border-border">
          {[
            { id: 'packages' as const,  label: `IFC Packages (${data?.totalPackages ?? 0})` },
            { id: 'rfis'     as const,  label: `RFIs (${data?.openRFIs ?? 0} open)` },
            { id: 'drawings' as const,  label: `Drawings (${data?.drawings?.length ?? 0})` },
          ].map(({ id, label }) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === id ? 'border-[#64ffda] text-[#64ffda]' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>

        {/* IFC Packages table */}
        {tab === 'packages' && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.packages?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FileText className="size-12 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground">No IFC packages</p>
                  <p className="text-xs text-muted-foreground">Upload packages via the Engineering cockpit.</p>
                </div>
              ) : (
                <table className="w-full min-w-[640px] text-sm" role="table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {['Package No.', 'Discipline', 'Title', 'Rev', 'Progress', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data!.packages.map((p) => <PackageRow key={p.id} pkg={p} />)}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* RFIs table */}
        {tab === 'rfis' && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.rfis?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Wrench className="size-12 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground">No RFIs raised</p>
                  <Button size="sm" onClick={() => setRfiModal(true)}><Plus className="size-4" /> New RFI</Button>
                </div>
              ) : (
                <table className="w-full min-w-[640px] text-sm" role="table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {['RFI Ref', 'Title', 'Discipline', 'Age', 'Status', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data!.rfis.map((r) => <RFIRow key={r.id} item={r} onClose={handleCloseRFI} />)}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Drawings table */}
        {tab === 'drawings' && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {(data?.drawings?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FileText className="size-12 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground">No drawings registered</p>
                  <p className="text-xs text-muted-foreground">Upload drawings via the Document Control module.</p>
                </div>
              ) : (
                <table className="w-full min-w-[640px] text-sm" role="table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {['Drawing No.', 'Title', 'Discipline', 'Rev', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data!.drawings.map((d) => (
                      <tr key={d.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{d.drawing_number}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[200px] truncate">{d.title}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{d.discipline}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{d.revision}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold',
                            d.status === 'approved' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#f59e0b]/10 text-[#f59e0b]')}>
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))}
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
