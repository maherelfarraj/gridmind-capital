'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  ArrowLeft, Plus, Loader2, FileText, DollarSign, CheckCircle2, Landmark,
  Receipt, Send, Stamp, FileCheck2, BanknoteArrowUp, X,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { formatUsd } from '@/lib/variation-orders/ui'
import { getProject } from '@/app/actions/projects'
import {
  getPaymentCertificates, draftPaymentCertificate, updatePaymentCertificateStatus,
  canCertifyPayments,
  type PaymentCertificate, type PcStatus,
} from '@/app/actions/payments'

// ─── Status metadata ────────────────────────────────────────────────────────

const STATUS_META: Record<PcStatus, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: '#94a3b8' },
  submitted: { label: 'Submitted', color: '#f59e0b' },
  certified: { label: 'Certified', color: '#3b82f6' },
  invoiced:  { label: 'Invoiced',  color: '#8b5cf6' },
  paid:      { label: 'Paid',      color: '#22c55e' },
}

/** Next-status action buttons per current status. */
const NEXT_ACTION: Record<PcStatus, { next: PcStatus; label: string; icon: React.ElementType; privileged: boolean } | null> = {
  draft:     { next: 'submitted', label: 'Submit',        icon: Send,             privileged: false },
  submitted: { next: 'certified', label: 'Certify',       icon: Stamp,            privileged: true  },
  certified: { next: 'invoiced',  label: 'Mark invoiced', icon: FileCheck2,       privileged: false },
  invoiced:  { next: 'paid',      label: 'Mark paid',     icon: BanknoteArrowUp,  privileged: true  },
  paid:      null,
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

function StatusBadge({ status }: { status: PcStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
    >
      {meta.label}
    </span>
  )
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-1" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="size-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="size-3.5" style={{ color }} aria-hidden />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  )
}

// ─── New certificate dialog ────────────────────────────────────────────────────

function NewCertificateDialog({ projectId, open, onOpenChange, onCreated }: {
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [start, setStart] = React.useState('')
  const [end, setEnd] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) { setStart(''); setEnd(''); setBusy(false) }
  }, [open])

  async function submit() {
    if (!start || !end) { toast({ title: 'Enter both period dates', variant: 'warning' }); return }
    if (end < start) { toast({ title: 'Period end must be after start', variant: 'warning' }); return }
    setBusy(true)
    const res = await draftPaymentCertificate({ projectId, period_start: start, period_end: end })
    setBusy(false)
    if (res.error) { toast({ title: 'Could not create certificate', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Draft certificate created', description: 'Progress was pulled from the schedule.', variant: 'success' })
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Payment Certificate</DialogTitle>
          <DialogDescription>
            Select the valuation period. Progress is pulled automatically from the project schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pc-start">Period start</Label>
            <Input id="pc-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pc-end">Period end</Label>
            <Input id="pc-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-[#64ffda]/8 border border-[#64ffda]/20 p-3">
          <FileText className="size-4 text-[#0891b2] shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-muted-foreground">
            Progress is pulled automatically from the project schedule — the gross valuation is computed as contract value &times; weighted completion.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />} Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Receipt-style detail panel ────────────────────────────────────────────────

function ReceiptLine({ label, value, strong, negative, muted }: {
  label: string; value: string; strong?: boolean; negative?: boolean; muted?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between py-1.5', strong && 'border-t border-border mt-1 pt-2')}>
      <span className={cn('text-sm', muted ? 'text-muted-foreground' : 'text-foreground', strong && 'font-semibold')}>{label}</span>
      <span className={cn(
        'font-mono text-sm tabular-nums',
        strong ? 'text-base font-bold text-foreground' : 'text-foreground',
        negative && 'text-[#ef4444]',
      )}>
        {negative ? `(${value})` : value}
      </span>
    </div>
  )
}

function DetailPanel({ cert, canCertify, onClose, onChanged }: {
  cert: PaymentCertificate
  canCertify: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)
  const action = NEXT_ACTION[cert.status]
  const blocked = action?.privileged && !canCertify

  async function advance() {
    if (!action) return
    setBusy(true)
    const res = await updatePaymentCertificateStatus(cert.id, action.next)
    setBusy(false)
    if (res.error) { toast({ title: 'Action failed', description: res.error, variant: 'danger' }); return }
    toast({ title: `Certificate ${action.label.toLowerCase()}`, variant: 'success' })
    onChanged()
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-[#64ffda]" aria-hidden />
          <h3 className="font-mono text-sm font-semibold text-foreground">{cert.pc_number}</h3>
          <StatusBadge status={cert.status} />
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close detail">
          <X className="size-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>Period: <span className="text-foreground">{fmtDate(cert.period_start)} – {fmtDate(cert.period_end)}</span></span>
          <span>Progress: <span className="text-foreground font-semibold">{cert.progress_pct}%</span></span>
        </div>

        {/* Receipt-style calculation breakdown */}
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <ReceiptLine label="Contract value" value={formatUsd(cert.contract_value)} muted />
          <ReceiptLine label={`Gross valuation (× ${cert.progress_pct}% complete)`} value={formatUsd(cert.gross_amount)} />
          <ReceiptLine label="Less: previously certified" value={formatUsd(cert.previous_certified)} negative muted />
          <ReceiptLine label="This period (gross)" value={formatUsd(cert.this_period)} strong />
          <ReceiptLine label={`Less: retention (${cert.retention_pct}%)`} value={formatUsd(cert.retention_amount)} negative muted />
          <ReceiptLine label="Less: advance recovery" value={formatUsd(cert.advance_recovery)} negative muted />
          <ReceiptLine label="Net amount payable" value={formatUsd(cert.net_amount)} strong />
        </div>

        {/* Lifecycle dates */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div><p className="text-muted-foreground">Submitted</p><p className="text-foreground font-medium">{fmtDate(cert.submitted_date)}</p></div>
          <div><p className="text-muted-foreground">Certified</p><p className="text-foreground font-medium">{fmtDate(cert.certified_date)}</p></div>
          <div><p className="text-muted-foreground">Paid</p><p className="text-foreground font-medium">{fmtDate(cert.paid_date)}</p></div>
        </div>

        {/* Status action */}
        {action && (
          <div className="flex items-center gap-3 border-t border-border pt-3">
            <Button size="sm" onClick={advance} disabled={busy || blocked}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <action.icon className="size-3.5" />}
              {action.label}
            </Button>
            {blocked && (
              <p className="text-xs text-muted-foreground">
                Only Finance Manager, Project Director or Tenant Admin can {action.label.toLowerCase()}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main dashboard ────────────────────────────────────────────────────────────

export function PaymentsDashboard({ projectId }: { projectId: string }) {
  const { data, isLoading, mutate } = useSWR(`payments-${projectId}`, () => getPaymentCertificates(projectId))
  const { data: project } = useSWR(`project-head-${projectId}`, () => getProject(projectId))
  const { data: canCertify } = useSWR('can-certify-payments', () => canCertifyPayments())
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const rows = data?.rows ?? []
  const kpis = data?.kpis
  const curve = data?.curve ?? []
  const selected = rows.find(r => r.id === selectedId) ?? null

  const kpiCards = [
    { label: 'Contract Value',   value: formatUsd(kpis?.contractValue ?? 0),   icon: DollarSign,   color: '#64ffda' },
    { label: 'Certified to Date', value: formatUsd(kpis?.certifiedToDate ?? 0), icon: CheckCircle2, color: '#3b82f6' },
    { label: 'Paid to Date',     value: formatUsd(kpis?.paidToDate ?? 0),      icon: BanknoteArrowUp, color: '#22c55e' },
    { label: 'Retention Held',   value: formatUsd(kpis?.retentionHeld ?? 0),   icon: Landmark,     color: '#f59e0b' },
  ]

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="size-3.5" /> Back to project
          </Link>
          <h1 className="text-2xl font-semibold text-balance">Payment Certificates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {project ? <>{project.name} <span className="font-mono text-[#64ffda]">{project.code}</span></> : 'Interim payment certificates'}
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> New Certificate (draft)
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="region" aria-label="Payment KPIs">
        {kpiCards.map((c) => <KpiCard key={c.label} {...c} />)}
      </div>

      {/* Payment curve */}
      {curve.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Payment Curve — cumulative certified vs paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={curve} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${(Number(v) / 1_000_000).toFixed(0)}M`}
                  />
                  <Tooltip
                    formatter={(v) => formatUsd(v as number)}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="certified" name="Cumulative certified" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="paid" name="Cumulative paid" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          cert={selected}
          canCertify={!!canCertify}
          onClose={() => setSelectedId(null)}
          onChanged={() => { mutate() }}
        />
      )}

      {/* Certificates table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm" role="table" aria-label="Payment certificates">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">Certificate</th>
                <th className="px-4 py-2.5 text-left font-semibold">Period</th>
                <th className="px-4 py-2.5 text-center font-semibold">Progress</th>
                <th className="px-4 py-2.5 text-right font-semibold">This Period</th>
                <th className="px-4 py-2.5 text-right font-semibold">Retention</th>
                <th className="px-4 py-2.5 text-right font-semibold">Net Amount</th>
                <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold">Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading certificates…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Receipt className="size-8 mx-auto text-muted-foreground/50 mb-3" aria-hidden />
                    <p className="text-sm font-medium text-foreground">No certificates yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Certificates pull progress from your schedule automatically.
                    </p>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                  className={cn(
                    'border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-muted/30',
                    r.id === selectedId && 'bg-muted/40',
                  )}
                >
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">{r.pc_number}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDate(r.period_start)} – {fmtDate(r.period_end)}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-foreground">{r.progress_pct}%</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">{formatUsd(r.this_period)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{formatUsd(r.retention_amount)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-foreground">{formatUsd(r.net_amount)}</td>
                  <td className="px-4 py-2.5 text-center"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{fmtDate(r.paid_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <NewCertificateDialog
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => { mutate() }}
      />
    </main>
  )
}
