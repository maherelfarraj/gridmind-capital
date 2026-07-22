'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  RefreshCw, Plus, Lock, Pencil, Trash2, Landmark, HandCoins, CheckCircle2,
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
import {
  loadRetention, upsertRetention, deleteRetention, requestRelease, confirmRelease, requestReleaseAllHeld,
  type RetentionData, type RetentionRow, type RetentionStatus,
} from '@/app/actions/retention'

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

const STATUS_BADGE: Record<RetentionStatus, string> = {
  held: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  release_requested: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  released: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}
const STATUS_LABEL: Record<RetentionStatus, string> = {
  held: 'Held', release_requested: 'Release requested', released: 'Released',
}

interface DraftForm {
  id?: string
  invoice_ref: string
  invoice_amount: string
  retention_pct: string
  retention_amount: string
}
const EMPTY_FORM: DraftForm = { invoice_ref: '', invoice_amount: '', retention_pct: '5', retention_amount: '' }

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

export function RetentionRegister({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const { data, isLoading, mutate } = useSWR<RetentionData>(
    ['retention', projectId],
    () => loadRetention(projectId),
  )

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [facOpen, setFacOpen] = useState(false)

  const canEdit = data?.canEdit ?? false
  const entries = data?.entries ?? []
  const k = data?.kpis
  const heldCount = entries.filter((e) => e.status === 'held').length

  function openCreate() { setForm(EMPTY_FORM); setFormOpen(true) }
  function openEdit(r: RetentionRow) {
    setForm({
      id: r.id,
      invoice_ref: r.invoice_ref ?? '',
      invoice_amount: r.invoice_amount ? String(r.invoice_amount) : '',
      retention_pct: r.retention_pct ? String(r.retention_pct) : '',
      retention_amount: r.retention_amount ? String(r.retention_amount) : '',
    })
    setFormOpen(true)
  }

  // Live-preview the auto-computed retention amount unless the user overrides it.
  const previewAmount = (() => {
    const inv = Number(form.invoice_amount.replace(/[^0-9.-]/g, '')) || 0
    const pct = Number(form.retention_pct.replace(/[^0-9.-]/g, '')) || 0
    return Math.round((inv * pct) / 100 * 100) / 100
  })()

  async function handleSave() {
    setBusy(true)
    const overrideAmt = form.retention_amount.trim() === '' ? undefined : Number(form.retention_amount.replace(/[^0-9.-]/g, ''))
    const res = await upsertRetention({
      id: form.id,
      project_id: projectId,
      invoice_ref: form.invoice_ref || null,
      invoice_amount: Number(form.invoice_amount.replace(/[^0-9.-]/g, '')) || 0,
      retention_pct: Number(form.retention_pct.replace(/[^0-9.-]/g, '')) || 0,
      retention_amount: overrideAmt,
    })
    setBusy(false)
    if (res.error) { toast({ title: 'Could not save', description: res.error, variant: 'danger' }); return }
    toast({ title: form.id ? 'Retention updated' : 'Retention added', variant: 'success' })
    setFormOpen(false)
    mutate()
  }

  async function handleDelete(r: RetentionRow) {
    if (!confirm('Delete this retention entry?')) return
    const res = await deleteRetention(r.id, projectId)
    if (res.error) { toast({ title: 'Could not delete', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Retention deleted', variant: 'success' })
    mutate()
  }

  async function handleRequest(r: RetentionRow) {
    const res = await requestRelease({ id: r.id, projectId })
    if (res.error) { toast({ title: 'Could not request release', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Release requested', description: 'Financial team notified.', variant: 'success' })
    mutate()
  }

  async function handleConfirm(r: RetentionRow) {
    const res = await confirmRelease({ id: r.id, projectId })
    if (res.error) { toast({ title: 'Could not confirm release', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Retention released', variant: 'success' })
    mutate()
  }

  async function handleFac() {
    setBusy(true)
    const res = await requestReleaseAllHeld(projectId)
    setBusy(false)
    setFacOpen(false)
    if (res.error) { toast({ title: 'Could not request FAC release', description: res.error, variant: 'danger' }); return }
    toast({ title: `FAC release requested`, description: `${res.data?.requested ?? 0} entr${(res.data?.requested ?? 0) === 1 ? 'y' : 'ies'} moved to release requested.`, variant: 'success' })
    mutate()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        {canEdit && heldCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => setFacOpen(true)}>
            <HandCoins className="size-3.5 mr-1.5" /> FAC release ({heldCount})
          </Button>
        )}
        {canEdit ? (
          <Button size="sm" onClick={openCreate}><Plus className="size-3.5 mr-1.5" /> Add retention</Button>
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
        <KpiCard label="Retention Held" value={fmt(k?.totalHeld ?? 0)} icon={<Landmark className="size-3.5" />} />
        <KpiCard label="Release Requested" value={fmt(k?.releaseRequested ?? 0)} tone={(k?.releaseRequested ?? 0) > 0 ? 'warn' : 'neutral'} />
        <KpiCard label="Released" value={fmt(k?.released ?? 0)} tone="good" />
        <KpiCard label="Entries" value={String(k?.count ?? 0)} />
      </div>

      {/* Register table */}
      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Retention Register</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Invoice / Milestone</th>
                <th className="px-3 py-2.5 font-medium text-right">Invoice Amount</th>
                <th className="px-3 py-2.5 font-medium text-right">Retention %</th>
                <th className="px-3 py-2.5 font-medium text-right">Retention Held</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Released</th>
                {canEdit && <th className="px-3 py-2.5 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={canEdit ? 7 : 6} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && entries.length === 0 && (
                <tr><td colSpan={canEdit ? 7 : 6} className="px-4 py-10 text-center text-muted-foreground">
                  No retention entries yet. They are created automatically from the Cash Flow tracker when an invoice amount and retention % are set, or add one manually.
                </td></tr>
              )}
              {entries.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{r.milestone_title ?? r.invoice_ref ?? 'Retention entry'}</div>
                    {r.milestone_title && r.invoice_ref && r.invoice_ref !== r.milestone_title && (
                      <div className="text-xs text-muted-foreground">{r.invoice_ref}</div>
                    )}
                    {r.payment_milestone_id && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Linked to milestone</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtFull(r.invoice_amount)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.retention_pct}%</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">{fmtFull(r.retention_amount)}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[r.status])}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(r.release_date)}</td>
                  {canEdit && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {r.status === 'held' && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleRequest(r)}>Request</Button>
                        )}
                        {r.status === 'release_requested' && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600" onClick={() => handleConfirm(r)}>
                            <CheckCircle2 className="size-3.5 mr-1" /> Release
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => handleDelete(r)}>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? 'Edit retention entry' : 'Add retention entry'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-ref" className="text-xs">Invoice reference</Label>
              <Input id="r-ref" value={form.invoice_ref} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} placeholder="e.g. INV-2026-014" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Invoice amount" type="number" value={form.invoice_amount} onChange={(v) => setForm({ ...form, invoice_amount: v })} placeholder="0" />
              <Field label="Retention %" type="number" value={form.retention_pct} onChange={(v) => setForm({ ...form, retention_pct: v })} placeholder="5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-amt" className="text-xs">Retention amount (override optional)</Label>
              <Input id="r-amt" type="number" value={form.retention_amount} onChange={(e) => setForm({ ...form, retention_amount: e.target.value })} placeholder={String(previewAmount)} />
              <p className="text-xs text-muted-foreground">Auto-computed: <span className="font-mono">{fmtFull(previewAmount)}</span> (leave blank to use this)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FAC bulk release dialog */}
      <Dialog open={facOpen} onOpenChange={setFacOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Final acceptance (FAC) retention release</DialogTitle></DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-2">
            <p>
              This requests release for all <strong className="text-foreground">{heldCount}</strong> held retention entr{heldCount === 1 ? 'y' : 'ies'}
              {' '}totalling <span className="font-mono text-foreground">{fmtFull(k?.totalHeld ?? 0)}</span>.
            </p>
            <p>Financial and project management teams will be notified. Each entry then requires a final release confirmation.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFacOpen(false)}>Cancel</Button>
            <Button onClick={handleFac} disabled={busy}>{busy ? 'Requesting…' : 'Request FAC release'}</Button>
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
  label: string; value: string; tone?: 'good' | 'bad' | 'warn' | 'neutral'; icon?: React.ReactNode
}) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-foreground'
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
