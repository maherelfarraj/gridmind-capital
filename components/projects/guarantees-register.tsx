'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  RefreshCw, Plus, Lock, Pencil, Trash2, ShieldCheck, AlertTriangle, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  loadGuarantees, upsertGuarantee, deleteGuarantee, setGuaranteeStatus, seedGuaranteesDemo,
  type GuaranteesData, type Guarantee, type GuaranteeType, type GuaranteeStatus,
} from '@/app/actions/guarantees'

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

const TYPE_LABEL: Record<GuaranteeType, string> = {
  bid_bond: 'Bid Bond',
  performance_bond: 'Performance Bond',
  advance_payment_guarantee: 'Advance Payment Guarantee',
  retention_bond: 'Retention Bond',
}
const TYPE_OPTIONS = (Object.keys(TYPE_LABEL) as GuaranteeType[]).map((v) => ({ value: v, label: TYPE_LABEL[v] }))

const STATUS_BADGE: Record<GuaranteeStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  released: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  expired: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  called: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}
const STATUS_LABEL: Record<GuaranteeStatus, string> = {
  active: 'Active', released: 'Released', expired: 'Expired', called: 'Called',
}
const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as GuaranteeStatus[]).map((v) => ({ value: v, label: STATUS_LABEL[v] }))

/** Expiry countdown badge: red < 30d, amber < 60d, muted otherwise. */
function ExpiryBadge({ days, status }: { days: number | null; status: GuaranteeStatus }) {
  if (status !== 'active' || days == null) return <span className="text-xs text-muted-foreground">—</span>
  if (days < 0) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 px-2 py-0.5 text-xs font-medium"><AlertTriangle className="size-3" />{Math.abs(days)}d overdue</span>
  }
  const tone = days < 30
    ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
    : days < 60
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300'
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tone)}><Clock className="size-3" />{days}d</span>
}

interface DraftForm {
  id?: string
  type: GuaranteeType
  bank_name: string
  amount: string
  issue_date: string
  expiry_date: string
  status: GuaranteeStatus
  notes: string
}
const EMPTY_FORM: DraftForm = {
  type: 'performance_bond', bank_name: '', amount: '', issue_date: '', expiry_date: '', status: 'active', notes: '',
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

export function GuaranteesRegister({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const { data, isLoading, mutate } = useSWR<GuaranteesData>(
    ['guarantees', projectId],
    () => loadGuarantees(projectId),
  )

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)

  const canEdit = data?.canEdit ?? false
  const guarantees = data?.guarantees ?? []
  const k = data?.kpis

  function openCreate() { setForm(EMPTY_FORM); setFormOpen(true) }
  function openEdit(g: Guarantee) {
    setForm({
      id: g.id,
      type: g.type,
      bank_name: g.bank_name ?? '',
      amount: g.amount ? String(g.amount) : '',
      issue_date: g.issue_date ?? '',
      expiry_date: g.expiry_date ?? '',
      status: g.status,
      notes: g.notes ?? '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    setBusy(true)
    const res = await upsertGuarantee({
      id: form.id,
      project_id: projectId,
      type: form.type,
      bank_name: form.bank_name || null,
      amount: Number(form.amount.replace(/[^0-9.-]/g, '')) || 0,
      issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null,
      status: form.status,
      notes: form.notes || null,
    })
    setBusy(false)
    if (res.error) { toast({ title: 'Could not save', description: res.error, variant: 'danger' }); return }
    toast({ title: form.id ? 'Guarantee updated' : 'Guarantee added', variant: 'success' })
    setFormOpen(false)
    mutate()
  }

  async function handleDelete(g: Guarantee) {
    if (!confirm(`Delete this ${TYPE_LABEL[g.type]}?`)) return
    const res = await deleteGuarantee(g.id, projectId)
    if (res.error) { toast({ title: 'Could not delete', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Guarantee deleted', variant: 'success' })
    mutate()
  }

  async function handleStatus(g: Guarantee, status: GuaranteeStatus) {
    const res = await setGuaranteeStatus({ id: g.id, projectId, status })
    if (res.error) { toast({ title: 'Could not update', description: res.error, variant: 'danger' }); return }
    toast({ title: `Marked ${STATUS_LABEL[status].toLowerCase()}`, variant: 'success' })
    mutate()
  }

  async function handleSeed() {
    setBusy(true)
    const res = await seedGuaranteesDemo(projectId)
    setBusy(false)
    if (res.error) { toast({ title: 'Seed skipped', description: res.error, variant: 'warning' }); return }
    toast({ title: 'Demo guarantees added', variant: 'success' })
    mutate()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        {canEdit && guarantees.length === 0 && (
          <Button size="sm" variant="outline" onClick={handleSeed} disabled={busy}>Seed demo</Button>
        )}
        {canEdit ? (
          <Button size="sm" onClick={openCreate}><Plus className="size-3.5 mr-1.5" /> Add guarantee</Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded-md border border-border">
            <Lock className="size-3" /> Read only
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={() => mutate()} disabled={isLoading}>
          <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Active Value" value={fmt(k?.totalActiveValue ?? 0)} icon={<ShieldCheck className="size-3.5" />} />
        <KpiCard label="Active Count" value={String(k?.activeCount ?? 0)} />
        <KpiCard label="Expiring ≤60d" value={String(k?.expiringSoon ?? 0)} tone={(k?.expiringSoon ?? 0) > 0 ? 'bad' : 'neutral'} />
        <KpiCard label="Released / Expired" value={String(k?.releasedOrExpired ?? 0)} />
      </div>

      {/* Discharge status banner */}
      {guarantees.length > 0 && (
        data?.allDischarged ? (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="size-4" /> All guarantees released or expired — G6 closeout requirement satisfied.
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4" /> {data?.outstanding.length} guarantee(s) still outstanding — must be released or expired before G6 closeout.
          </div>
        )
      )}

      {/* Register table */}
      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Bank Guarantees &amp; Bonds</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Bank</th>
                <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                <th className="px-3 py-2.5 font-medium">Issued</th>
                <th className="px-3 py-2.5 font-medium">Expiry</th>
                <th className="px-3 py-2.5 font-medium">Countdown</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                {canEdit && <th className="px-3 py-2.5 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={canEdit ? 8 : 7} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && guarantees.length === 0 && (
                <tr><td colSpan={canEdit ? 8 : 7} className="px-4 py-10 text-center text-muted-foreground">No guarantees recorded yet.</td></tr>
              )}
              {guarantees.map((g) => (
                <tr key={g.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium text-foreground">{TYPE_LABEL[g.type]}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{g.bank_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtFull(g.amount)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(g.issue_date)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(g.expiry_date)}</td>
                  <td className="px-3 py-2.5"><ExpiryBadge days={g.days_to_expiry} status={g.status} /></td>
                  <td className="px-3 py-2.5">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[g.status])}>
                      {STATUS_LABEL[g.status]}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {g.status === 'active' && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleStatus(g, 'released')}>Release</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(g)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => handleDelete(g)}>
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
          <DialogHeader><DialogTitle>{form.id ? 'Edit guarantee' : 'Add guarantee'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select options={TYPE_OPTIONS} value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v as GuaranteeType })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="g-bank" className="text-xs">Issuing bank</Label>
              <Input id="g-bank" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. HSBC" />
            </div>
            <Field label="Amount (USD)" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="0" />
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select options={STATUS_OPTIONS} value={form.status} onValueChange={(v) => v && setForm({ ...form, status: v as GuaranteeStatus })} />
            </div>
            <Field label="Issue date" type="date" value={form.issue_date} onChange={(v) => setForm({ ...form, issue_date: v })} />
            <Field label="Expiry date" type="date" value={form.expiry_date} onChange={(v) => setForm({ ...form, expiry_date: v })} />
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="g-notes" className="text-xs">Notes</Label>
              <Textarea id="g-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional reference / conditions" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Active guarantees past their expiry date are shown as expired automatically. Expiry countdown turns amber within 60 days and red within 30 days.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={busy}>{busy ? 'Saving…' : 'Save guarantee'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
