'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  RefreshCw, Plus, Lock, AlertTriangle, Copy, Check, ChevronUp, Landmark, TrendingUp, Pencil, Trash2, Eye, EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { ExcelExportButton } from '@/components/shared/excel-export-button'
import {
  loadCashFlow, upsertMilestone, deleteMilestone, escalateMilestone, requestRetentionRelease,
  seedCashFlowDemo, ESCALATION_LADDER,
  type CashFlowData, type PaymentMilestone, type MilestoneStatus,
} from '@/app/actions/cash-flow'
import { toggleMilestoneClientVisible } from '@/app/actions/external-access'

// ─────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────

function fmt(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}
function fmtFull(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<MilestoneStatus, string> = {
  planned: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  invoiced: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}
const STATUS_LABEL: Record<MilestoneStatus, string> = {
  planned: 'Planned', invoiced: 'Invoiced', overdue: 'Overdue', paid: 'Paid',
}

interface DraftForm {
  id?: string
  title: string
  planned_date: string
  planned_amount: string
  invoiced_at: string
  invoice_amount: string
  due_date: string
  paid_at: string
  paid_amount: string
  retention_pct: string
}
const EMPTY_FORM: DraftForm = {
  title: '', planned_date: '', planned_amount: '', invoiced_at: '', invoice_amount: '',
  due_date: '', paid_at: '', paid_amount: '', retention_pct: '',
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

export function CashFlowTracker({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const { data, isLoading, mutate } = useSWR<CashFlowData>(
    ['cash-flow', projectId],
    () => loadCashFlow(projectId),
  )

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [escalateFor, setEscalateFor] = useState<PaymentMilestone | null>(null)

  const canEdit = data?.canEdit ?? false
  const milestones = data?.milestones ?? []
  const k = data?.kpis

  function openCreate() { setForm(EMPTY_FORM); setFormOpen(true) }
  function openEdit(m: PaymentMilestone) {
    setForm({
      id: m.id,
      title: m.title,
      planned_date: m.planned_date ?? '',
      planned_amount: m.planned_amount ? String(m.planned_amount) : '',
      invoiced_at: m.invoiced_at ? m.invoiced_at.slice(0, 10) : '',
      invoice_amount: m.invoice_amount != null ? String(m.invoice_amount) : '',
      due_date: m.due_date ?? '',
      paid_at: m.paid_at ? m.paid_at.slice(0, 10) : '',
      paid_amount: m.paid_amount != null ? String(m.paid_amount) : '',
      retention_pct: m.retention_pct ? String(m.retention_pct) : '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: 'Title required', description: 'Enter a milestone title.', variant: 'danger' })
      return
    }
    setBusy(true)
    const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s.replace(/[^0-9.-]/g, '')))
    const res = await upsertMilestone({
      id: form.id,
      project_id: projectId,
      title: form.title,
      planned_date: form.planned_date || null,
      planned_amount: Number(form.planned_amount.replace(/[^0-9.-]/g, '')) || 0,
      invoiced_at: form.invoiced_at ? new Date(form.invoiced_at).toISOString() : null,
      invoice_amount: numOrNull(form.invoice_amount),
      due_date: form.due_date || null,
      paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null,
      paid_amount: numOrNull(form.paid_amount),
      retention_pct: Number(form.retention_pct.replace(/[^0-9.-]/g, '')) || 0,
    })
    setBusy(false)
    if (res.error) { toast({ title: 'Could not save', description: res.error, variant: 'danger' }); return }
    toast({ title: form.id ? 'Milestone updated' : 'Milestone added', variant: 'success' })
    setFormOpen(false)
    mutate()
  }

  async function handleDelete(m: PaymentMilestone) {
    if (!confirm(`Delete milestone "${m.title}"? This also unlinks its retention entry.`)) return
    const res = await deleteMilestone(m.id, projectId)
    if (res.error) { toast({ title: 'Could not delete', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Milestone deleted', variant: 'success' })
    mutate()
  }

  async function handleSeed() {
    setBusy(true)
    const res = await seedCashFlowDemo(projectId)
    setBusy(false)
    if (res.error) { toast({ title: 'Seed skipped', description: res.error, variant: 'warning' }); return }
    toast({ title: 'Demo milestones added', variant: 'success' })
    mutate()
  }

  async function handleRequestRelease(m: PaymentMilestone) {
    if (!m.retention) return
    const res = await requestRetentionRelease({ id: m.retention.id, projectId })
    if (res.error) { toast({ title: 'Could not request release', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Retention release requested', description: 'Financial team notified.', variant: 'success' })
    mutate()
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-balance">Cash Flow Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.projectName ?? 'Project'} — payment milestones, invoicing, receipts, and collection escalation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && milestones.length === 0 && (
            <Button size="sm" variant="outline" onClick={handleSeed} disabled={busy}>Seed demo</Button>
          )}
          {canEdit ? (
            <Button size="sm" onClick={openCreate}><Plus className="size-3.5 mr-1.5" /> Add milestone</Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded-md border border-border">
              <Lock className="size-3" /> Read only
            </span>
          )}
          <ExcelExportButton
            projectId={projectId}
            register="payment-milestones"
            rowCount={milestones.length}
            disabled={milestones.length === 0}
            buildSheets={() => [{
              name: 'Payment Milestones',
              rows: milestones,
              columns: [
                { header: 'Milestone', key: 'title', type: 'text', width: 34 },
                { header: 'Planned Date', key: 'planned_date', type: 'date', width: 14 },
                { header: 'Planned Amount', key: 'planned_amount', type: 'currency', width: 16 },
                { header: 'Invoiced Date', key: 'invoiced_at', type: 'date', width: 14 },
                { header: 'Invoice Amount', key: 'invoice_amount', type: 'currency', width: 16 },
                { header: 'Due Date', key: 'due_date', type: 'date', width: 14 },
                { header: 'Paid Date', key: 'paid_at', type: 'date', width: 14 },
                { header: 'Paid Amount', key: 'paid_amount', type: 'currency', width: 16 },
                { header: 'Days Overdue', key: 'days_overdue', type: 'number', width: 14 },
                { header: 'Status', key: (m: PaymentMilestone) => STATUS_LABEL[m.status], type: 'text', width: 12 },
                { header: 'Escalation Level', key: 'escalation_level', type: 'number', width: 14 },
              ],
            }]}
          />
          <Button size="sm" variant="ghost" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Contract Value" value={fmt(k?.totalContractValue ?? 0)} />
        <KpiCard label="Invoiced to Date" value={fmt(k?.invoicedToDate ?? 0)} />
        <KpiCard label="Received to Date" value={fmt(k?.receivedToDate ?? 0)} tone="good" />
        <KpiCard label="Overdue Amount" value={fmt(k?.overdueAmount ?? 0)} tone={(k?.overdueAmount ?? 0) > 0 ? 'bad' : 'neutral'} />
        <KpiCard label="Retention Held" value={fmt(k?.retentionHeld ?? 0)} icon={<Landmark className="size-3.5" />} />
      </div>

      {/* Cash flow curve */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Cumulative Cash Flow Curve</h2>
        </div>
        {(data?.chart.length ?? 0) === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No dated milestones yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data!.chart} margin={{ left: 12, right: 24, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => fmt(v as number)} />
              <Legend />
              <Line type="monotone" dataKey="planned" name="Cumulative Planned" stroke="#94a3b8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="invoiced" name="Cumulative Invoiced" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="received" name="Cumulative Received" stroke="#22c55e" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Timeline table */}
      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Payment Milestones</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Milestone</th>
                <th className="px-3 py-2.5 font-medium text-right">Planned</th>
                <th className="px-3 py-2.5 font-medium text-right">Invoiced</th>
                <th className="px-3 py-2.5 font-medium">Due</th>
                <th className="px-3 py-2.5 font-medium text-right">Paid</th>
                <th className="px-3 py-2.5 font-medium text-right">Days Overdue</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Escalation</th>
                <th className="px-3 py-2.5 font-medium">Retention</th>
                {canEdit && <th className="px-3 py-2.5 font-medium text-center">Client</th>}
                {canEdit && <th className="px-3 py-2.5 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={canEdit ? 11 : 9} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && milestones.length === 0 && (
                <tr><td colSpan={canEdit ? 11 : 9} className="px-4 py-10 text-center text-muted-foreground">No payment milestones yet.</td></tr>
              )}
              {milestones.map((m) => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{m.title}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(m.planned_date)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtFull(m.planned_amount)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {fmtFull(m.invoice_amount)}
                    {m.invoiced_at && <div className="text-xs text-muted-foreground">{fmtDate(m.invoiced_at)}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(m.due_date)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {fmtFull(m.paid_amount)}
                    {m.paid_at && <div className="text-xs text-muted-foreground">{fmtDate(m.paid_at)}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {m.days_overdue > 0
                      ? <span className="text-red-600 dark:text-red-400 font-semibold">{m.days_overdue}d</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[m.status])}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {m.escalation_level > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                        L{m.escalation_level}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {m.retention ? (
                      <div className="text-xs">
                        <div className="font-mono">{fmtFull(m.retention.retention_amount)}</div>
                        <div className="text-muted-foreground capitalize">{m.retention.status.replace('_', ' ')}</div>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        title={m.client_visible ? 'Visible to client — click to hide' : 'Hidden from client — click to share'}
                        aria-label={m.client_visible ? 'Hide from client' : 'Share with client'}
                        onClick={async () => {
                          await toggleMilestoneClientVisible(m.id, !m.client_visible)
                          mutate()
                        }}
                        className={`p-1 rounded transition-colors ${
                          m.client_visible
                            ? 'text-[#64ffda] hover:bg-[#64ffda]/10'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {m.client_visible
                          ? <Eye className="size-3.5" aria-hidden />
                          : <EyeOff className="size-3.5" aria-hidden />
                        }
                      </button>
                    </td>
                  )}
                  {canEdit && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {(m.status === 'overdue' || m.escalation_level > 0) && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-600" onClick={() => setEscalateFor(m)}>
                            <ChevronUp className="size-3.5 mr-1" /> Escalate
                          </Button>
                        )}
                        {m.retention?.status === 'held' && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleRequestRelease(m)}>
                            Release
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(m)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => handleDelete(m)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? 'Edit milestone' : 'Add payment milestone'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="m-title">Title</Label>
              <Input id="m-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mechanical completion — Block A" />
            </div>
            <Field label="Planned date"   type="date"   value={form.planned_date}   onChange={(v) => setForm({ ...form, planned_date: v })} />
            <Field label="Planned amount" type="number" value={form.planned_amount} onChange={(v) => setForm({ ...form, planned_amount: v })} placeholder="0" />
            <Field label="Invoiced date"  type="date"   value={form.invoiced_at}    onChange={(v) => setForm({ ...form, invoiced_at: v })} />
            <Field label="Invoice amount" type="number" value={form.invoice_amount} onChange={(v) => setForm({ ...form, invoice_amount: v })} placeholder="0" />
            <Field label="Due date"       type="date"   value={form.due_date}       onChange={(v) => setForm({ ...form, due_date: v })} />
            <Field label="Retention %"    type="number" value={form.retention_pct}  onChange={(v) => setForm({ ...form, retention_pct: v })} placeholder="5" />
            <Field label="Paid date"      type="date"   value={form.paid_at}        onChange={(v) => setForm({ ...form, paid_at: v })} />
            <Field label="Paid amount"    type="number" value={form.paid_amount}    onChange={(v) => setForm({ ...form, paid_amount: v })} placeholder="0" />
          </div>
          <p className="text-xs text-muted-foreground">
            Status is derived automatically from these dates. When an invoice amount and retention %
            are both set, a linked retention entry is created (held) automatically.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={busy}>{busy ? 'Saving…' : 'Save milestone'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalation dialog */}
      <EscalationDialog
        milestone={escalateFor}
        onClose={() => setEscalateFor(null)}
        onEscalated={() => { setEscalateFor(null); mutate() }}
        projectId={projectId}
      />
    </main>
  )
}

// ─────────────────────────────────────────────────────────────
// Escalation dialog with copyable templates
// ─────────────────────────────────────────────────────────────

function EscalationDialog({
  milestone, projectId, onClose, onEscalated,
}: {
  milestone: PaymentMilestone | null
  projectId: string
  onClose: () => void
  onEscalated: () => void
}) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  const suggestedLevel = useMemo(() => {
    if (!milestone) return 1
    const overdue = milestone.days_overdue
    // Highest ladder step whose triggerDays threshold has been crossed.
    const eligible = ESCALATION_LADDER.filter((s) => overdue >= s.triggerDays)
    return eligible.length ? eligible[eligible.length - 1].level : 1
  }, [milestone])

  if (!milestone) return null

  function fillTemplate(body: string) {
    return body
      .replaceAll('{{invoiceRef}}', milestone!.title)
      .replaceAll('{{amount}}', fmtFull(milestone!.invoice_amount))
      .replaceAll('{{dueDate}}', fmtDate(milestone!.due_date))
      .replaceAll('{{today}}', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))
      .replaceAll('{{daysOverdue}}', String(milestone!.days_overdue))
  }

  async function handleCopy(level: number, body: string) {
    try {
      await navigator.clipboard.writeText(fillTemplate(body))
      setCopied(level)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      toast({ title: 'Copy failed', description: 'Select and copy the text manually.', variant: 'warning' })
    }
  }

  async function handleEscalate(level: number) {
    setBusy(true)
    const res = await escalateMilestone({ id: milestone!.id, projectId, toLevel: level })
    setBusy(false)
    if (res.error) { toast({ title: 'Escalation failed', description: res.error, variant: 'danger' }); return }
    toast({ title: `Escalated to L${level}`, description: level >= 3 ? 'Legal + Financial notified.' : 'PM + Financial notified.', variant: 'success' })
    onEscalated()
  }

  return (
    <Dialog open={!!milestone} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Collection escalation — {milestone.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            <span>
              {milestone.days_overdue > 0
                ? <>Currently <strong className="text-red-600">{milestone.days_overdue} days overdue</strong>. Current level: L{milestone.escalation_level}. Suggested: <strong>L{suggestedLevel}</strong>.</>
                : <>Current level: L{milestone.escalation_level}. Escalate manually as needed.</>}
            </span>
          </div>

          {ESCALATION_LADDER.map((step) => {
            const isCurrent = milestone.escalation_level === step.level
            const isSuggested = suggestedLevel === step.level && milestone.escalation_level < step.level
            return (
              <div key={step.level} className={cn(
                'rounded-lg border p-3',
                isSuggested ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'border-border',
              )}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex size-6 items-center justify-center rounded-full text-xs font-bold',
                      milestone.escalation_level >= step.level ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground')}>
                      {step.level}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{step.label}</p>
                      <p className="text-xs text-muted-foreground">Suggested at due date + {step.triggerDays} days{step.level >= 3 ? ' • notifies Legal + Financial' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleCopy(step.level, step.templateBody)}>
                      {copied === step.level ? <Check className="size-3.5 mr-1 text-emerald-600" /> : <Copy className="size-3.5 mr-1" />}
                      {copied === step.level ? 'Copied' : 'Copy'}
                    </Button>
                    <Button size="sm" className="h-7 px-2" disabled={busy || isCurrent} onClick={() => handleEscalate(step.level)}>
                      {isCurrent ? 'Current' : `Set L${step.level}`}
                    </Button>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground font-sans leading-relaxed max-h-32 overflow-y-auto">
                  {fillTemplate(step.templateBody)}
                </pre>
              </div>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────
// Small pieces
// ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, tone, icon }: {
  label: string; value: string; tone?: 'good' | 'bad' | 'neutral'; icon?: React.ReactNode
}) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : 'text-foreground'
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {icon}{label}
      </div>
      <p className={cn('mt-1 text-lg font-bold font-mono', color)}>{value}</p>
    </Card>
  )
}

function Field({
  label, type, value, onChange, placeholder,
}: {
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}
