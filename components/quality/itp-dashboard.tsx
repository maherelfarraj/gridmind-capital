'use client'

import * as React from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, Percent, Plus, Trash2,
  ChevronDown, ChevronRight, Lock, Loader2, GripVertical, Flame,
  Eye, ShieldCheck, FileSearch, ArrowLeft, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
  getItpDashboard, createItpPlan, updateActivityResult, activateItpPlan, voidItpPlan, seedItpDemoData,
  type ItpPlan, type ItpActivity, type InspectionType, type ActivityStatus, type PlanStatus,
} from '@/app/actions/quality'

// ─── Constants ────────────────────────────────────────────────────────────────

const INSPECTION_TYPES: InspectionType[] = ['HOLD', 'WITNESS', 'SURVEILLANCE', 'REVIEW']

const TYPE_META: Record<InspectionType, { label: string; color: string; icon: React.ElementType; description: string }> = {
  HOLD:        { label: 'Hold',        color: '#ef4444', icon: Flame,        description: 'Work must stop until signed off' },
  WITNESS:     { label: 'Witness',     color: '#f59e0b', icon: Eye,          description: 'Inspector must be present' },
  SURVEILLANCE:{ label: 'Surveillance',color: '#64748b', icon: ShieldCheck,  description: 'Monitor and verify' },
  REVIEW:      { label: 'Review',      color: '#3b82f6', icon: FileSearch,   description: 'Document review required' },
}

const STATUS_META: Record<ActivityStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#94a3b8' },
  passed:  { label: 'Passed',  color: '#22c55e' },
  failed:  { label: 'Failed',  color: '#ef4444' },
  waived:  { label: 'Waived',  color: '#8b5cf6' },
}

const PLAN_STATUS_META: Record<PlanStatus, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: '#94a3b8' },
  active:   { label: 'Active',   color: '#22c55e' },
  complete: { label: 'Complete', color: '#3b82f6' },
  void:     { label: 'Void',     color: '#6b7280' },
}

// ─── Zod schema ────────────────────────────────────────────────────────────────

const activitySchema = z.object({
  description:     z.string().min(1, 'Required'),
  inspection_type: z.enum(['HOLD', 'WITNESS', 'SURVEILLANCE', 'REVIEW']),
  reference_doc:   z.string().optional(),
  responsible:     z.string().optional(),
})

const newPlanSchema = z.object({
  title:        z.string().min(2, 'Title must be at least 2 characters'),
  work_package: z.string().optional(),
  discipline:   z.string().optional(),
  activities:   z.array(activitySchema).min(1, 'Add at least one activity'),
})

type NewPlanForm = z.infer<typeof newPlanSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-1" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="size-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="size-3.5" style={{ color }} aria-hidden />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Activity type badge ───────────────────────────────────────────────────────

function TypeBadge({ type }: { type: InspectionType }) {
  const meta = TYPE_META[type]
  const Icon = meta.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border"
      style={{ color: meta.color, borderColor: meta.color, backgroundColor: `${meta.color}10` }}
      title={meta.description}
    >
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: ActivityStatus }) {
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

function PlanStatusBadge({ status }: { status: PlanStatus }) {
  const meta = PLAN_STATUS_META[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
    >
      {meta.label}
    </span>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const color = pct === 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  )
}

// ─── Activity result panel ─────────────────────────────────────────────────────

function ActivityRow({
  act, canRecordResult, onResult, loading,
}: {
  act: ItpActivity
  canRecordResult: boolean
  onResult: (id: string, status: ActivityStatus, notes?: string) => void
  loading: boolean
}) {
  const [noteOpen, setNoteOpen] = React.useState(false)
  const [noteText, setNoteText] = React.useState(act.notes ?? '')
  const isHold = act.inspection_type === 'HOLD'
  const meta = TYPE_META[act.inspection_type]

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-3 px-3 w-8 text-center">
        <span className="text-[11px] font-mono text-muted-foreground">{act.seq}</span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-start gap-2">
          {isHold && <Lock className="size-3.5 text-red-500 mt-0.5 shrink-0" aria-label="Hold point" />}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{act.description}</p>
            {act.reference_doc && (
              <p className="text-xs text-muted-foreground mt-0.5">{act.reference_doc}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-3 whitespace-nowrap">
        <TypeBadge type={act.inspection_type} />
      </td>
      <td className="py-3 px-3 text-sm text-muted-foreground whitespace-nowrap">
        {act.responsible ?? '—'}
      </td>
      <td className="py-3 px-3 whitespace-nowrap">
        <StatusBadge status={act.status} />
      </td>
      <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
        {fmtDate(act.result_date)}
      </td>
      <td className="py-3 px-3">
        {act.status === 'pending' ? (
          <div className="flex items-center gap-1 flex-wrap">
            {isHold && !canRecordResult ? (
              <span
                className="text-xs text-amber-600 flex items-center gap-1 cursor-default"
                title="Hold points require PM, HSE or Commissioning Manager role"
              >
                <Lock className="size-3" />
                Role restricted
              </span>
            ) : (
              <>
                <Button
                  size="sm" variant="outline"
                  className="h-7 px-2 text-xs border-green-400 text-green-700 hover:bg-green-50"
                  disabled={loading}
                  onClick={() => onResult(act.id, 'passed', noteText || undefined)}
                >
                  Pass
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="h-7 px-2 text-xs border-red-400 text-red-700 hover:bg-red-50"
                  disabled={loading}
                  onClick={() => onResult(act.id, 'failed', noteText || undefined)}
                >
                  Fail
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  disabled={loading}
                  onClick={() => onResult(act.id, 'waived', noteText || undefined)}
                >
                  Waive
                </Button>
                <button
                  type="button"
                  className="h-7 px-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setNoteOpen(v => !v)}
                  title="Add note"
                >
                  {noteOpen ? 'hide note' : '+ note'}
                </button>
              </>
            )}
          </div>
        ) : (
          act.notes && (
            <p className="text-xs text-muted-foreground max-w-[200px] truncate" title={act.notes}>
              {act.notes}
            </p>
          )
        )}
        {noteOpen && act.status === 'pending' && (
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add a note…"
            className="mt-1.5 text-xs h-16 resize-none"
          />
        )}
      </td>
    </tr>
  )
}

// ─── Plan detail panel ────────────────────────────────────────────────────────

function PlanDetail({
  plan, onBack, projectId, canManage,
}: {
  plan: ItpPlan
  onBack: () => void
  projectId: string
  canManage: boolean
}) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [actionLoading, setActionLoading] = React.useState(false)
  const swrKey = `itp-dashboard-${projectId}`

  async function handleResult(id: string, status: ActivityStatus, notes?: string) {
    setLoading(true)
    const res = await updateActivityResult(id, { status, notes })
    setLoading(false)
    if ('error' in res && res.error) {
      toast({ title: 'Error', description: res.error, variant: 'danger' })
    } else {
      toast({ title: status === 'passed' ? 'Passed' : status === 'failed' ? 'Failed' : 'Waived', description: 'Activity result recorded.', variant: 'success' })
      globalMutate(swrKey)
    }
  }

  async function handleActivate() {
    setActionLoading(true)
    const res = await activateItpPlan(plan.id)
    setActionLoading(false)
    if ('error' in res && res.error) {
      toast({ title: 'Error', description: res.error, variant: 'danger' })
    } else {
      toast({ title: 'Plan activated', variant: 'success' })
      globalMutate(swrKey)
    }
  }

  async function handleVoid() {
    if (!confirm('Void this ITP plan? This cannot be undone.')) return
    setActionLoading(true)
    const res = await voidItpPlan(plan.id)
    setActionLoading(false)
    if ('error' in res && res.error) {
      toast({ title: 'Error', description: res.error, variant: 'danger' })
    } else {
      toast({ title: 'Plan voided', variant: 'success' })
      onBack()
      globalMutate(swrKey)
    }
  }

  // HOLD points require a specific role check — we pass `canManage` as the proxy.
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-muted-foreground">{plan.itp_no}</span>
              <h2 className="text-base font-bold text-foreground">{plan.title}</h2>
              <PlanStatusBadge status={plan.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {plan.work_package && <span>Package: {plan.work_package}</span>}
              {plan.discipline && <span>Discipline: {plan.discipline}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan.status === 'draft' && canManage && (
            <Button size="sm" variant="outline" onClick={handleActivate} disabled={actionLoading}>
              {actionLoading && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              Activate
            </Button>
          )}
          {plan.status === 'active' && canManage && (
            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 border-red-200" onClick={handleVoid} disabled={actionLoading}>
              Void
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Completion</p>
          <ProgressBar pct={plan.completion_pct} />
        </div>
        <div className="flex items-center gap-4 text-sm">
          {(['passed', 'failed', 'waived', 'pending'] as ActivityStatus[]).map(s => (
            <div key={s} className="text-center">
              <p className="font-bold text-foreground">{plan.activities.filter(a => a.status === s).length}</p>
              <p className="text-[10px] uppercase text-muted-foreground">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Activities */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/40">
          <h3 className="text-sm font-semibold text-foreground">Inspection Activities</h3>
        </div>
        {plan.activities.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No activities on this plan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground w-8">#</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground">Description</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground">Responsible</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {plan.activities.map(act => (
                  <ActivityRow
                    key={act.id}
                    act={act}
                    canRecordResult={canManage}
                    onResult={handleResult}
                    loading={loading}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── New ITP Plan dialog ───────────────────────────────────────────────────────

function NewPlanDialog({
  open, onClose, projectId,
}: {
  open: boolean; onClose: () => void; projectId: string
}) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = React.useState(false)
  const swrKey = `itp-dashboard-${projectId}`

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<NewPlanForm>({
    resolver: zodResolver(newPlanSchema),
    defaultValues: {
      title: '', work_package: '', discipline: '',
      activities: [{ description: '', inspection_type: 'REVIEW', reference_doc: '', responsible: '' }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'activities' })

  async function onSubmit(values: NewPlanForm) {
    setSubmitting(true)
    const res = await createItpPlan({
      projectId,
      title: values.title,
      work_package: values.work_package || undefined,
      discipline: values.discipline || undefined,
      activities: values.activities.map(a => ({
        description: a.description,
        inspection_type: a.inspection_type,
        reference_doc: a.reference_doc || undefined,
        responsible: a.responsible || undefined,
      })),
    })
    setSubmitting(false)
    if ('error' in res && res.error) {
      toast({ title: 'Error', description: res.error, variant: 'danger' })
    } else {
      toast({ title: 'ITP plan created', variant: 'success' })
      reset()
      onClose()
      globalMutate(swrKey)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New ITP Plan</DialogTitle>
          <DialogDescription>Define inspection and test activities for a work package.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
          {/* Plan fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="itp-title">Title <span className="text-red-500">*</span></Label>
              <Input id="itp-title" placeholder="e.g. Pile Foundation Inspection" {...register('title')} />
              {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="itp-wp">Work Package</Label>
              <Input id="itp-wp" placeholder="Civil, Electrical…" {...register('work_package')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="itp-disc">Discipline</Label>
              <Input id="itp-disc" placeholder="Structural, BESS…" {...register('discipline')} />
            </div>
          </div>

          {/* Activities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Activities <span className="text-red-500">*</span></Label>
              <Button
                type="button" size="sm" variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => append({ description: '', inspection_type: 'REVIEW', reference_doc: '', responsible: '' })}
              >
                <Plus className="size-3" /> Add row
              </Button>
            </div>

            {errors.activities?.root && (
              <p className="text-xs text-red-500">{errors.activities.root.message}</p>
            )}

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-2 px-2 text-left text-xs font-semibold text-muted-foreground w-8"></th>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-muted-foreground">Description *</th>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-muted-foreground w-36">Type</th>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-muted-foreground w-28">Ref. doc</th>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-muted-foreground w-28">Responsible</th>
                    <th className="py-2 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, idx) => (
                    <tr key={field.id} className="border-b border-border last:border-0">
                      <td className="py-1.5 px-2 text-center">
                        <GripVertical className="size-3.5 text-muted-foreground mx-auto" aria-hidden />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          {...register(`activities.${idx}.description`)}
                          placeholder="Describe activity"
                          className="h-8 text-xs"
                        />
                        {errors.activities?.[idx]?.description && (
                          <p className="text-[10px] text-red-500 mt-0.5">{errors.activities[idx]?.description?.message}</p>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        <select
                          {...register(`activities.${idx}.inspection_type`)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {INSPECTION_TYPES.map(t => (
                            <option key={t} value={t}>{TYPE_META[t].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <Input {...register(`activities.${idx}.reference_doc`)} placeholder="DWG-xxx" className="h-8 text-xs" />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input {...register(`activities.${idx}.responsible`)} placeholder="Role / name" className="h-8 text-xs" />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button" onClick={() => remove(idx)}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="size-3.5" aria-label="Remove row" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Type legend */}
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {INSPECTION_TYPES.map(t => {
                const meta = TYPE_META[t]
                const Icon = meta.icon
                return (
                  <span key={t} className="flex items-center gap-1">
                    <Icon className="size-3" style={{ color: meta.color }} />
                    <strong style={{ color: meta.color }}>{meta.label}</strong> — {meta.description}
                  </span>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              Create Plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main dashboard ────────────────────────────────────────────────────────────

export function ItpDashboard({ projectId, canManage }: { projectId: string; canManage?: boolean }) {
  const { toast } = useToast()
  const swrKey = `itp-dashboard-${projectId}`
  const { data, isLoading } = useSWR(swrKey, () => getItpDashboard(projectId))
  const [selectedPlan, setSelectedPlan] = React.useState<ItpPlan | null>(null)
  const [newPlanOpen, setNewPlanOpen] = React.useState(false)
  const [seeding, setSeeding] = React.useState(false)

  // Keep selected plan in sync after SWR revalidation
  React.useEffect(() => {
    if (selectedPlan && data?.plans) {
      const fresh = data.plans.find(p => p.id === selectedPlan.id)
      if (fresh) setSelectedPlan(fresh)
    }
  }, [data])

  async function handleSeed() {
    setSeeding(true)
    const res = await seedItpDemoData(projectId)
    setSeeding(false)
    if ('error' in res && res.error) {
      toast({ title: 'Seed error', description: res.error, variant: 'danger' })
    } else if (res.seeded === false) {
      toast({ title: 'Already seeded', description: 'Demo data already exists.', variant: 'warning' })
    } else {
      toast({ title: 'Demo data seeded', variant: 'success' })
      globalMutate(swrKey)
    }
  }

  const kpis = data?.kpis
  const plans = data?.plans ?? []
  const isLive = !isLoading && plans.length > 0

  // ── plan detail view ─────────────────────────────────────────────────────────
  if (selectedPlan) {
    const fresh = plans.find(p => p.id === selectedPlan.id) ?? selectedPlan
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                isLive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200',
              )}
            >
              <span className={cn('size-1.5 rounded-full', isLive ? 'bg-green-500' : 'bg-amber-400')} />
              {isLive ? 'Live data' : 'Illustrative'}
            </span>
          </div>
        </div>
        <PlanDetail
          plan={fresh}
          onBack={() => setSelectedPlan(null)}
          projectId={projectId}
          canManage={canManage ?? false}
        />
      </div>
    )
  }

  // ── plan list view ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">Quality — ITP Register</h1>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              isLive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200',
            )}
          >
            <span className={cn('size-1.5 rounded-full', isLive ? 'bg-green-500' : 'bg-amber-400')} />
            {isLive ? 'Live data' : 'Illustrative'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isLive && !isLoading && (
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
              {seeding && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              Seed demo data
            </Button>
          )}
          {canManage && (
            <Button size="sm" className="gap-1.5" onClick={() => setNewPlanOpen(true)}>
              <Plus className="size-4" /> New ITP Plan
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Active ITPs"
          value={isLoading ? '…' : String(kpis?.active_plans ?? 0)}
          icon={ClipboardCheck}
          color="#0f766e"
        />
        <KpiCard
          label="Hold points pending"
          value={isLoading ? '…' : String(kpis?.hold_points_pending ?? 0)}
          sub={kpis?.hold_points_pending ? 'Require sign-off' : 'None pending'}
          icon={AlertTriangle}
          color={(kpis?.hold_points_pending ?? 0) > 0 ? '#f59e0b' : '#64748b'}
        />
        <KpiCard
          label="Open NCRs"
          value={isLoading ? '…' : String(kpis?.open_ncrs ?? 0)}
          sub={kpis?.critical_or_major_ncrs ? `${kpis.critical_or_major_ncrs} from failed inspections` : undefined}
          icon={AlertTriangle}
          color={(kpis?.critical_or_major_ncrs ?? 0) > 0 ? '#ef4444' : (kpis?.open_ncrs ?? 0) > 0 ? '#f59e0b' : '#64748b'}
        />
        <KpiCard
          label="Inspection pass rate"
          value={isLoading ? '…' : `${kpis?.pass_rate_pct ?? 0}%`}
          icon={Percent}
          color={(kpis?.pass_rate_pct ?? 0) >= 80 ? '#22c55e' : '#f59e0b'}
        />
      </div>

      {/* ITP plans table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" /> Loading…
        </div>
      ) : plans.length === 0 ? (
        // Empty state
        <div className="rounded-xl border border-dashed border-border py-20 text-center space-y-3">
          <ClipboardCheck className="size-10 text-muted-foreground mx-auto opacity-40" />
          <p className="text-base font-semibold text-foreground">No ITPs yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first Inspection &amp; Test Plan to start tracking quality hold points.
          </p>
          {canManage && (
            <Button size="sm" className="gap-1.5 mt-2" onClick={() => setNewPlanOpen(true)}>
              <Plus className="size-4" /> New ITP Plan
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">ITP No.</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">Title</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">Package</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">Discipline</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground w-40">Completion</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
                >
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs font-semibold text-muted-foreground">{plan.itp_no}</span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-foreground group-hover:text-primary transition-colors">{plan.title}</p>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{plan.work_package ?? '—'}</td>
                  <td className="py-3 px-4 text-muted-foreground">{plan.discipline ?? '—'}</td>
                  <td className="py-3 px-4">
                    <ProgressBar pct={plan.completion_pct} />
                  </td>
                  <td className="py-3 px-4">
                    <PlanStatusBadge status={plan.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewPlanDialog open={newPlanOpen} onClose={() => setNewPlanOpen(false)} projectId={projectId} />
    </div>
  )
}
