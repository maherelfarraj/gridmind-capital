'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowLeft, Loader2, X, Check, Send, RefreshCw, AlertTriangle,
  CircleDot, CheckCircle2, Clock, Ban, Hammer, DollarSign, Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useSession } from '@/lib/session-context'
import {
  getVariationOrder, updateVariationOrder, submitVariationOrder,
  decideVariationOrder, updateVariationBaselines, markVariationExecuted,
  type VariationOrder, type VoOrigin,
} from '@/app/actions/variation-orders'
import {
  ORIGIN_LABELS, STATUS_LABELS, STATUS_COLORS, formatUsd, formatDate,
} from '@/lib/variation-orders/ui'

// ─── Role gating (UX convenience; server enforces the real rules) ──

const PM_ROLES = ['project_manager', 'project_director', 'pmo_director', 'tenant_admin', 'system_admin']
const FINANCE_ROLES = ['finance_manager', 'finance_controller']
// Roles allowed to approve/reject a submitted VO (mirrors the server guard in decideVariationOrder).
const DECISION_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'finance_manager']

// ─── Stepper ──────────────────────────────────────────────────

type StepState = 'done' | 'current' | 'todo' | 'rejected'

function Stepper({ vo }: { vo: VariationOrder }) {
  const terminalNegative = vo.status === 'rejected' || vo.status === 'withdrawn'
  const steps: { key: string; label: string; state: StepState; sub?: string }[] = [
    {
      key: 'draft', label: 'Draft',
      state: 'done',
      sub: formatDate(vo.created_at),
    },
    {
      key: 'submitted', label: 'Submitted',
      state: vo.submitted_at ? 'done' : vo.status === 'draft' ? 'current' : 'todo',
      sub: formatDate(vo.submitted_at),
    },
    {
      key: 'decided', label: 'Decided',
      state: terminalNegative ? 'rejected'
        : vo.status === 'approved' ? 'done'
        : vo.status === 'submitted' ? 'current' : 'todo',
      sub: vo.decided_at ? `${STATUS_LABELS[vo.status]} · ${formatDate(vo.decided_at)}` : undefined,
    },
    {
      key: 'baseline', label: 'Baseline Updated',
      state: vo.baseline_updated ? 'done'
        : vo.status === 'approved' ? 'current' : 'todo',
      sub: vo.baseline_updated ? 'Confirmed' : undefined,
    },
  ]

  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const color = s.state === 'done' ? '#22c55e'
          : s.state === 'current' ? '#64ffda'
          : s.state === 'rejected' ? '#ef4444'
          : '#475569'
        const Icon = s.state === 'done' ? CheckCircle2
          : s.state === 'rejected' ? Ban
          : s.state === 'current' ? CircleDot : Clock
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1.5 min-w-[84px]">
              <div className="flex items-center justify-center size-9 rounded-full border-2"
                style={{ borderColor: color, color, background: `${color}15` }}>
                <Icon className="size-4" />
              </div>
              <span className="text-xs font-medium text-foreground text-center">{s.label}</span>
              {s.sub && <span className="text-[10px] text-muted-foreground text-center leading-tight">{s.sub}</span>}
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 mb-6 min-w-[16px]"
                style={{ background: steps[i + 1].state === 'todo' ? '#475569' : color }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Decision modal ───────────────────────────────────────────

function DecisionModal({ open, onClose, vo, onDone }: {
  open: boolean; onClose: () => void; vo: VariationOrder; onDone: () => void
}) {
  const { toast } = useToast()
  const [decision, setDecision] = React.useState<'approved' | 'rejected' | 'withdrawn'>('approved')
  const [comment, setComment] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function submit() {
    setLoading(true)
    const { error } = await decideVariationOrder(vo.id, decision, comment.trim() || undefined)
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: `${vo.vo_number} ${decision}`, variant: 'success' })
    onDone(); onClose()
  }

  if (!open) return null
  const opts = [
    { key: 'approved' as const, label: 'Approved', color: '#22c55e' },
    { key: 'rejected' as const, label: 'Rejected', color: '#ef4444' },
    { key: 'withdrawn' as const, label: 'Withdrawn', color: '#64748b' },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Record Client Decision</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="flex gap-2">
          {opts.map((o) => (
            <button key={o.key} type="button" onClick={() => setDecision(o.key)}
              className={cn('flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                decision === o.key ? 'border-transparent' : 'border-border text-muted-foreground hover:text-foreground')}
              style={decision === o.key ? { background: `${o.color}20`, color: o.color } : undefined}
            >{o.label}</button>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Decision note {decision !== 'approved' && <span className="text-muted-foreground/70">(recommended)</span>}</label>
          <textarea value={comment} rows={3} onChange={(e) => setComment(e.target.value)}
            placeholder="Client rationale, conditions, or reference…"
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 resize-none" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />} Record Decision
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Baseline update modal ────────────────────────────────────

function BaselineModal({ open, onClose, vo, onDone }: {
  open: boolean; onClose: () => void; vo: VariationOrder; onDone: () => void
}) {
  const { toast } = useToast()
  const [adjustBudget, setAdjustBudget] = React.useState(true)
  const [budget, setBudget] = React.useState('')
  const [adjustDate, setAdjustDate] = React.useState(false)
  const [targetDate, setTargetDate] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function submit() {
    setLoading(true)
    const { error } = await updateVariationBaselines(vo.id, {
      newBudgetUsd: adjustBudget && budget !== '' ? Number(budget) : null,
      newTargetCompletion: adjustDate && targetDate ? targetDate : null,
    })
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Baselines updated', variant: 'success' })
    onDone(); onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Update Baselines</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="rounded-lg bg-[#64ffda]/5 border border-[#64ffda]/20 p-3 text-xs text-muted-foreground">
          Confirming will mark this VO&apos;s baselines as updated and adjust the project&apos;s CAPEX budget and target completion.
          This is required before the VO work can be marked executed.
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={adjustBudget} onChange={(e) => setAdjustBudget(e.target.checked)} className="accent-[#64ffda]" />
          Adjust project CAPEX budget
        </label>
        {adjustBudget && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">New project budget (USD)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
              placeholder={vo.cost_impact != null ? `Add ${formatUsd(vo.cost_impact)} to current budget` : 'New total budget'}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={adjustDate} onChange={(e) => setAdjustDate(e.target.checked)} className="accent-[#64ffda]" />
          Adjust target completion date
        </label>
        {adjustDate && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">New target completion</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />} Confirm Baseline Update
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit draft modal ─────────────────────────────────────────

function EditModal({ open, onClose, vo, canEditAll, canEditCost, onDone }: {
  open: boolean; onClose: () => void; vo: VariationOrder
  canEditAll: boolean; canEditCost: boolean; onDone: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = React.useState({
    title: vo.title, description: vo.description ?? '', origin: vo.origin,
    cost_impact: vo.cost_impact?.toString() ?? '', time_impact_days: vo.time_impact_days?.toString() ?? '',
  })
  const [loading, setLoading] = React.useState(false)
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit() {
    setLoading(true)
    const patch: Parameters<typeof updateVariationOrder>[1] = {}
    if (canEditAll) {
      patch.title = form.title
      patch.description = form.description
      patch.origin = form.origin
      patch.time_impact_days = form.time_impact_days === '' ? null : Number(form.time_impact_days)
    }
    if (canEditCost) {
      patch.cost_impact = form.cost_impact === '' ? null : Number(form.cost_impact)
    }
    const { error } = await updateVariationOrder(vo.id, patch)
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Variation order updated', variant: 'success' })
    onDone(); onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Edit {vo.vo_number}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
          <input type="text" value={form.title} disabled={!canEditAll} onChange={(e) => set('title', e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <textarea value={form.description} rows={3} disabled={!canEditAll} onChange={(e) => set('description', e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Origin</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ORIGIN_LABELS) as VoOrigin[]).map((o) => (
              <button key={o} type="button" disabled={!canEditAll} onClick={() => set('origin', o)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50',
                  form.origin === o ? 'bg-[#64ffda]/10 text-[#64ffda] border-[#64ffda]/30' : 'border-border text-muted-foreground hover:text-foreground')}
              >{ORIGIN_LABELS[o]}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Cost Impact (USD) {canEditCost && !canEditAll && <span className="text-[#64ffda]">· editable</span>}
            </label>
            <input type="number" value={form.cost_impact} disabled={!canEditCost} onChange={(e) => set('cost_impact', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Time Impact (days)</label>
            <input type="number" value={form.time_impact_days} disabled={!canEditAll} onChange={(e) => set('time_impact_days', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />} Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export function VariationDetail({ projectId, voId }: { projectId: string; voId: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const session = useSession()

  const roles = session.roles ?? []
  const canEditAll = session.isSuperAdmin || roles.some((r) => PM_ROLES.includes(r))
  const canEditCost = canEditAll || roles.some((r) => FINANCE_ROLES.includes(r))
  const canApprove = session.isSuperAdmin || roles.some((r) => DECISION_ROLES.includes(r))

  const { data: vo, isLoading, mutate } = useSWR(
    `variation-${voId}`,
    () => getVariationOrder(voId),
    { revalidateOnFocus: true },
  )

  const [busy, setBusy] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [decisionOpen, setDecisionOpen] = React.useState(false)
  const [baselineOpen, setBaselineOpen] = React.useState(false)

  async function handleSubmit() {
    if (!vo) return
    setBusy(true)
    const { error } = await submitVariationOrder(vo.id)
    setBusy(false)
    if (error) { toast({ title: 'Cannot submit', description: error, variant: 'danger' }); return }
    toast({ title: `${vo.vo_number} submitted to client`, variant: 'success' })
    mutate()
  }

  async function handleExecute() {
    if (!vo) return
    setBusy(true)
    const { error } = await markVariationExecuted(vo.id)
    setBusy(false)
    if (error) { toast({ title: 'Cannot execute', description: error, variant: 'danger' }); return }
    toast({ title: `${vo.vo_number} marked executed`, variant: 'success' })
    mutate()
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground gap-2"><Loader2 className="size-5 animate-spin" /> Loading variation order…</div>
  }
  if (!vo) {
    return (
      <div className="space-y-4">
        <Link href={`/projects/${projectId}/variations`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to register</Link>
        <p className="text-sm text-foreground">Variation order not found.</p>
      </div>
    )
  }

  const canSubmit = vo.status === 'draft'
  const canDecide = vo.status === 'submitted' && canApprove
  const canUpdateBaseline = vo.status === 'approved' && !vo.baseline_updated
  const canExecute = vo.status === 'approved' && vo.baseline_updated && !vo.executed
  const submitBlocked = canSubmit && (vo.cost_impact == null || vo.time_impact_days == null)
  const statusColor = STATUS_COLORS[vo.status]

  return (
    <>
      <EditModal open={editOpen} onClose={() => setEditOpen(false)} vo={vo}
        canEditAll={canEditAll} canEditCost={canEditCost} onDone={() => mutate()} />
      <DecisionModal open={decisionOpen} onClose={() => setDecisionOpen(false)} vo={vo} onDone={() => mutate()} />
      <BaselineModal open={baselineOpen} onClose={() => setBaselineOpen(false)} vo={vo} onDone={() => mutate()} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/projects/${projectId}/variations`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="size-3.5" /> Back to register
            </Link>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm bg-muted/40 px-2 py-0.5 rounded text-foreground">{vo.vo_number}</span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: `${statusColor}20`, color: statusColor }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
                {STATUS_LABELS[vo.status]}
              </span>
              {vo.executed && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-[#22c55e]/10 text-[#22c55e]">
                  <Hammer className="size-3" /> Executed
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-2 text-balance">{vo.title}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh"><RefreshCw className="size-3.5" /></Button>
            {vo.status === 'draft' && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="size-3.5" /> Edit</Button>
            )}
          </div>
        </div>

        {/* Stepper */}
        <Card>
          <CardContent className="py-6 overflow-x-auto">
            <Stepper vo={vo} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Details */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Detail label="Origin" value={ORIGIN_LABELS[vo.origin]} />
                <Detail label="Cost Impact" value={formatUsd(vo.cost_impact)} accent={vo.cost_impact != null ? '#64ffda' : undefined} />
                <Detail label="Time Impact" value={vo.time_impact_days == null ? '—' : `${vo.time_impact_days} days`} />
                <Detail label="Baseline" value={vo.baseline_updated ? 'Updated' : 'Not updated'} accent={vo.baseline_updated ? '#22c55e' : undefined} />
              </div>
              {vo.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{vo.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border/50">
                <Detail label="Created by" value={vo.created_by_name ?? '—'} />
                <Detail label="Created" value={formatDate(vo.created_at)} />
                <Detail label="Submitted" value={formatDate(vo.submitted_at)} />
                <Detail label="Decided" value={formatDate(vo.decided_at)} />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Workflow Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Step 1: Submit */}
              {canSubmit && (
                <div className="space-y-2">
                  {submitBlocked && (
                    <div className="flex items-start gap-2 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 p-2.5 text-xs text-[#f59e0b]">
                      <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                      Cost impact and time impact are required before submission. Use Edit to add them.
                    </div>
                  )}
                  <Button className="w-full" size="sm" disabled={busy || submitBlocked} onClick={handleSubmit}>
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Submit to Client
                  </Button>
                </div>
              )}

              {/* Step 2: Decision */}
              {canDecide && (
                <Button className="w-full" size="sm" onClick={() => setDecisionOpen(true)}>
                  <Check className="size-3.5" /> Record Client Decision
                </Button>
              )}

              {/* Step 3: Baseline update */}
              {canUpdateBaseline && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 rounded-lg bg-[#64ffda]/5 border border-[#64ffda]/20 p-2.5 text-xs text-muted-foreground">
                    <DollarSign className="size-3.5 mt-0.5 shrink-0 text-[#64ffda]" />
                    Approved — update project baselines (budget &amp; target completion) to proceed.
                  </div>
                  <Button className="w-full" size="sm" onClick={() => setBaselineOpen(true)}>
                    Update Baselines
                  </Button>
                </div>
              )}

              {/* Step 4: Execute */}
              {canExecute && (
                <Button className="w-full" size="sm" variant="outline" disabled={busy} onClick={handleExecute}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Hammer className="size-3.5" />} Mark VO Work Executed
                </Button>
              )}

              {/* Terminal / info states */}
              {vo.status === 'approved' && vo.baseline_updated && vo.executed && (
                <p className="text-sm text-[#22c55e] flex items-center gap-1.5"><CheckCircle2 className="size-4" /> VO fully executed and baselined.</p>
              )}
              {(vo.status === 'rejected' || vo.status === 'withdrawn') && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Ban className="size-4" /> This VO was {STATUS_LABELS[vo.status].toLowerCase()} — no further actions.</p>
              )}
              {vo.status === 'submitted' && !canApprove && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Clock className="size-4" /> Submitted — awaiting a client decision from an authorized approver.</p>
              )}
              {vo.status === 'approved' && !vo.baseline_updated && !canUpdateBaseline && (
                <p className="text-xs text-muted-foreground">Awaiting baseline update.</p>
              )}

              <div className="pt-2 border-t border-border/50">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Your role: <span className="text-foreground font-medium">{canEditAll ? 'full edit' : canEditCost ? 'cost impact only' : 'read only'}</span>.
                  VO work cannot be executed before approval and baseline update.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function Detail({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold" style={{ color: accent ?? 'var(--foreground)' }}>{value}</p>
    </div>
  )
}
