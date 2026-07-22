'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowLeft, Plus, RefreshCw, Loader2, X, FileText,
  CheckCircle2, Clock, DollarSign, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  getVariationOrders, createVariationOrder, seedVariationDemo,
  type VoOrigin,
} from '@/app/actions/variation-orders'
import {
  ORIGIN_LABELS, STATUS_LABELS, STATUS_COLORS,
  formatUsd, formatUsdCompact, formatDate,
} from '@/lib/variation-orders/ui'
import { ExcelExportButton } from '@/components/shared/excel-export-button'

// ─── Create modal ─────────────────────────────────────────────

function CreateVoModal({ open, onClose, projectId, onCreated }: {
  open: boolean; onClose: () => void; projectId: string; onCreated: (id: string) => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    title: '', description: '', origin: 'client_request' as VoOrigin,
    cost_impact: '', time_impact_days: '',
  })
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast({ title: 'Title is required', variant: 'danger' }); return }
    setLoading(true)
    const { data, error } = await createVariationOrder({
      project_id: projectId,
      title: form.title,
      description: form.description,
      origin: form.origin,
      cost_impact: form.cost_impact === '' ? null : Number(form.cost_impact),
      time_impact_days: form.time_impact_days === '' ? null : Number(form.time_impact_days),
    })
    setLoading(false)
    if (error || !data) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: `${data.vo_number} created`, variant: 'success' })
    setForm({ title: '', description: '', origin: 'client_request', cost_impact: '', time_impact_days: '' })
    onCreated(data.id); onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">New Variation Order</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Title <span className="text-[#ef4444]">*</span></label>
          <input type="text" value={form.title} placeholder="e.g. Revised cable trench routing"
            onChange={(e) => set('title', e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <textarea value={form.description} rows={3} placeholder="Scope, cause, and justification"
            onChange={(e) => set('description', e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 resize-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Origin</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ORIGIN_LABELS) as VoOrigin[]).map((o) => (
              <button key={o} type="button" onClick={() => set('origin', o)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  form.origin === o
                    ? 'bg-[#64ffda]/10 text-[#64ffda] border-[#64ffda]/30'
                    : 'border-border text-muted-foreground hover:text-foreground')}
              >{ORIGIN_LABELS[o]}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cost Impact (USD)</label>
            <input type="number" value={form.cost_impact} placeholder="Optional at draft"
              onChange={(e) => set('cost_impact', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Time Impact (days)</label>
            <input type="number" value={form.time_impact_days} placeholder="Optional at draft"
              onChange={(e) => set('time_impact_days', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Cost and time impact are required before the VO can be submitted to the client.</p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />} Create Draft
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: keyof typeof STATUS_LABELS }) {
  const color = STATUS_COLORS[status]
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${color}20`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────

export function VariationsRegister({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [modalOpen, setModalOpen] = React.useState(false)
  const [seeding, setSeeding] = React.useState(false)

  const { data, isLoading, mutate } = useSWR(
    `variations-${projectId}`,
    () => getVariationOrders(projectId),
    { revalidateOnFocus: true },
  )

  const rows = data?.rows ?? []
  const kpis = data?.kpis

  async function handleSeed() {
    setSeeding(true)
    const { error } = await seedVariationDemo(projectId)
    setSeeding(false)
    if (error) { toast({ title: 'Seed skipped', description: error, variant: 'danger' }); return }
    toast({ title: 'Demo variation orders seeded', variant: 'success' })
    mutate()
  }

  const statCards = [
    { label: 'Approved VO Value', value: formatUsdCompact(kpis?.approvedValue ?? 0), icon: CheckCircle2, color: '#22c55e' },
    { label: 'Pending VO Value',  value: formatUsdCompact(kpis?.pendingValue ?? 0),  icon: Clock,        color: '#f59e0b' },
    { label: 'Total VOs',         value: String(kpis?.totalCount ?? 0),              icon: ClipboardList,color: '#64ffda' },
    { label: 'Approved / Pending',value: `${kpis?.byStatus.find(s => s.name === 'approved')?.value ?? 0} / ${kpis?.byStatus.find(s => s.name === 'submitted')?.value ?? 0}`, icon: DollarSign, color: '#3b82f6' },
  ]

  return (
    <>
      <CreateVoModal open={modalOpen} onClose={() => setModalOpen(false)} projectId={projectId}
        onCreated={(id) => { mutate(); router.push(`/projects/${projectId}/variations/${id}`) }} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="size-3.5" /> Back to project
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Variation Orders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Change control register — cost &amp; time impact, client decisions, and baseline updates</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh"><RefreshCw className="size-3.5" /></Button>
            <ExcelExportButton
              projectId={projectId}
              register="variation-orders"
              rowCount={rows.length}
              disabled={rows.length === 0}
              buildSheets={() => [{
                name: 'Variation Orders',
                rows,
                columns: [
                  { header: 'VO Number', key: 'vo_number', type: 'text', width: 14 },
                  { header: 'Title', key: 'title', type: 'text', width: 40 },
                  { header: 'Origin', key: (r: (typeof rows)[number]) => ORIGIN_LABELS[r.origin], type: 'text', width: 18 },
                  { header: 'Cost Impact', key: 'cost_impact', type: 'currency', width: 16 },
                  { header: 'Time Impact (days)', key: 'time_impact_days', type: 'number', width: 18 },
                  { header: 'Status', key: (r: (typeof rows)[number]) => STATUS_LABELS[r.status], type: 'text', width: 14 },
                  { header: 'Submitted', key: 'submitted_at', type: 'date', width: 14 },
                  { header: 'Decided', key: 'decided_at', type: 'date', width: 14 },
                  { header: 'Baseline Updated', key: (r: (typeof rows)[number]) => (r.baseline_updated ? 'Yes' : 'No'), type: 'text', width: 16 },
                ],
              }]}
            />
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="size-3.5 animate-spin" /> : 'Seed Demo'}
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4" /> New VO</Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl bg-card border border-border p-4" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
                <Icon className="size-4" style={{ color }} aria-hidden />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            rows.length > 0 ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-muted text-muted-foreground',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', rows.length > 0 ? 'bg-[#22c55e]' : 'bg-muted-foreground')} />
            {rows.length > 0 ? 'Live data' : 'No variation orders yet — create one or seed demo'}
          </span>
        </div>

        {/* Register table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">VO Register</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
              ))}</div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="size-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold text-foreground">No variation orders</p>
                <p className="text-xs text-muted-foreground mt-1">Create a VO draft or seed demo data to get started.</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>Seed Demo</Button>
                  <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="size-3.5" /> New VO</Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['VO #', 'Title', 'Origin', 'Cost Impact', 'Time', 'Status', 'Decision Date'].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}
                        onClick={() => router.push(`/projects/${projectId}/variations/${r.id}`)}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer">
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-xs bg-muted/40 px-1.5 py-0.5 rounded">{r.vo_number}</span>
                        </td>
                        <td className="py-2.5 px-3 text-foreground font-medium max-w-[260px] truncate">
                          {r.title}
                          {r.executed && <span className="ml-2 text-[10px] uppercase tracking-wide text-[#22c55e]">Executed</span>}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{ORIGIN_LABELS[r.origin]}</td>
                        <td className="py-2.5 px-3 text-foreground font-semibold font-mono whitespace-nowrap">{formatUsd(r.cost_impact)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{r.time_impact_days == null ? '—' : `${r.time_impact_days}d`}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={r.status} /></td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{formatDate(r.decided_at)}</td>
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
