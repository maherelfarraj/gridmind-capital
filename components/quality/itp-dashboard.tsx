'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR, { mutate as globalMutate } from 'swr'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, Percent, Plus, Trash2,
  ChevronDown, ChevronUp, ChevronRight, Lock, Loader2, GripVertical, Flame,
  Eye, ShieldCheck, FileSearch, ArrowLeft, X, Clock, AlertOctagon,
  ShieldAlert, Info,
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
  getNcrRegister, createNcr, setNcrDisposition, updateNcrStatus,
  type ItpPlan, type ItpActivity, type InspectionType, type ActivityStatus, type PlanStatus,
  type QualityNcr, type NcrCategory, type NcrSeverity,
} from '@/app/actions/quality'

// ─── Constants ────────────────────────────────────────────────────────────────

const INSPECTION_TYPES: InspectionType[] = ['HOLD', 'WITNESS', 'SURVEILLANCE', 'REVIEW']

const TYPE_META: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  HOLD:        { label: 'Hold',        color: '#ef4444', icon: Flame,        description: 'Work must stop until signed off' },
  WITNESS:     { label: 'Witness',     color: '#f59e0b', icon: Eye,          description: 'Inspector must be present' },
  SURVEILLANCE:{ label: 'Surveillance',color: '#64748b', icon: ShieldCheck,  description: 'Monitor and verify' },
  REVIEW:      { label: 'Review',      color: '#3b82f6', icon: FileSearch,   description: 'Document review required' },
}
const TYPE_FALLBACK = (raw: string) => ({ label: raw || 'Unknown', color: '#94a3b8', icon: ShieldCheck, description: '' })

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#94a3b8' },
  passed:  { label: 'Passed',  color: '#22c55e' },
  failed:  { label: 'Failed',  color: '#ef4444' },
  waived:  { label: 'Waived',  color: '#8b5cf6' },
}
const STATUS_FALLBACK = (raw: string) => ({ label: raw || 'Unknown', color: '#94a3b8' })

const PLAN_STATUS_META: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: '#94a3b8' },
  active:   { label: 'Active',   color: '#22c55e' },
  complete: { label: 'Complete', color: '#3b82f6' },
  void:     { label: 'Void',     color: '#6b7280' },
}
const PLAN_STATUS_FALLBACK = (raw: string) => ({ label: raw || 'Unknown', color: '#94a3b8' })



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

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? TYPE_FALLBACK(type)
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

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_FALLBACK(status)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
    >
      {meta.label}
    </span>
  )
}

function PlanStatusBadge({ status }: { status: string }) {
  const meta = PLAN_STATUS_META[status] ?? PLAN_STATUS_FALLBACK(status)
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
  const meta = TYPE_META[act.inspection_type] ?? TYPE_FALLBACK(act.inspection_type)

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
  const { fields, append, remove, move } = useFieldArray({ control, name: 'activities' })

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
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-1">
                          <GripVertical className="size-3.5 text-muted-foreground shrink-0" aria-hidden />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => move(idx, idx - 1)}
                              disabled={idx === 0}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label={`Move activity ${idx + 1} up`}
                              title="Move up"
                            >
                              <ChevronUp className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => move(idx, idx + 1)}
                              disabled={idx === fields.length - 1}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label={`Move activity ${idx + 1} down`}
                              title="Move down"
                            >
                              <ChevronDown className="size-3.5" />
                            </button>
                          </div>
                        </div>
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

      {/* ── NCR Register ────────────────────────────────────────────────── */}
      <NcrSection projectId={projectId} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NCR Section
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',    icon: AlertOctagon },
  major:    { label: 'Major',    color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: ShieldAlert  },
  minor:    { label: 'Minor',    color: '#64748b', bg: 'bg-slate-50 dark:bg-slate-800/40', icon: Info         },
}
const SEVERITY_FALLBACK = (raw: string) => ({
  label: raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown',
  color: '#94a3b8', bg: 'bg-slate-50 dark:bg-slate-800/40', icon: Info,
})

const CATEGORY_LABELS: Record<string, string> = {
  failed_inspection: 'Failed Inspection',
  audit:             'Audit',
  site_observation:  'Site Observation',
}

const NCR_STATUS_LABELS: Record<string, string> = {
  open:              'Open',
  in_rectification:  'In Rectification',
  're_inspection':   'Re-Inspection',
  closed:            'Closed',
}

const NCR_STATUS_COLORS: Record<string, string> = {
  open:             'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  in_rectification: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  're_inspection':  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  closed:           'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

function AgingBadge({ aging, daysOpen }: { aging: QualityNcr['aging']; daysOpen: number }) {
  if (aging === 'none') return null
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium',
      aging === 'red'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    )}>
      <Clock className="size-3" aria-hidden />
      {daysOpen}d
    </span>
  )
}

function NcrDetailPanel({
  ncr,
  onClose,
  onRefresh,
}: {
  ncr: QualityNcr
  onClose: () => void
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [rootCause, setRootCause] = React.useState(ncr.root_cause ?? '')
  const [disposition, setDisposition] = React.useState(ncr.disposition ?? '')
  const [costImpact, setCostImpact] = React.useState(ncr.cost_impact != null ? String(ncr.cost_impact) : '')
  const [saving, setSaving] = React.useState(false)

  const canClose = rootCause.trim().length > 0 && disposition.trim().length > 0
  const isClosed = ncr.status === 'closed'
  const isOpen = ncr.status === 'open'

  function parsedCost(): number | undefined {
    const t = costImpact.trim()
    if (!t) return undefined
    const n = Number(t)
    return Number.isNaN(n) ? undefined : n
  }

  function persistDisposition() {
    return setNcrDisposition(ncr.id, { root_cause: rootCause, disposition, cost_impact: parsedCost() })
  }

  async function handleSaveDisposition() {
    setSaving(true)
    const res = await persistDisposition()
    setSaving(false)
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Saved', description: 'Root cause and disposition updated.', variant: 'success' })
    onRefresh()
  }

  async function handleStartProgress() {
    setSaving(true)
    const res = await updateNcrStatus(ncr.id, 'in_progress')
    setSaving(false)
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'danger' }); return }
    toast({ title: 'NCR in progress', description: 'Rectification started.', variant: 'success' })
    onRefresh()
  }

  async function handleClose() {
    setSaving(true)
    // Persist root cause + disposition first so the server-side close guard passes.
    const save = await persistDisposition()
    if (save.error) { setSaving(false); toast({ title: 'Error', description: save.error, variant: 'danger' }); return }
    const res = await updateNcrStatus(ncr.id, 'closed')
    setSaving(false)
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'danger' }); return }
    toast({ title: 'NCR closed', description: 'Non-conformance resolved and closed.', variant: 'success' })
    onRefresh()
  }

  const meta = SEVERITY_META[ncr.severity] ?? SEVERITY_FALLBACK(ncr.severity)
  const Icon = meta.icon

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn('size-9 rounded-lg flex items-center justify-center shrink-0', meta.bg)}>
            <Icon className="size-4.5" style={{ color: meta.color }} aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="font-mono text-xs font-semibold text-muted-foreground">{ncr.ncr_number}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', NCR_STATUS_COLORS[ncr.status])}>
                {NCR_STATUS_LABELS[ncr.status]}
              </span>
              <AgingBadge aging={ncr.aging} daysOpen={ncr.days_open} />
            </div>
            <p className="font-semibold text-foreground text-sm">{ncr.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {CATEGORY_LABELS[ncr.category]} · {meta.label} severity · {ncr.days_open}d open
              {ncr.cost_impact != null && ncr.cost_impact > 0
                ? ` · $${ncr.cost_impact.toLocaleString('en-US')} cost impact`
                : ''}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Close detail">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* Description */}
      {ncr.description && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
          <p className="text-sm text-foreground">{ncr.description}</p>
        </div>
      )}

      {/* Root Cause + Disposition */}
      {!isClosed && (
        <div className="space-y-3 pt-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Required to close
          </p>
          <div className="space-y-1">
            <Label htmlFor={`rc-${ncr.id}`} className="text-xs">Root Cause</Label>
            <Textarea
              id={`rc-${ncr.id}`}
              value={rootCause}
              onChange={e => setRootCause(e.target.value)}
              placeholder="Describe the root cause..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`disp-${ncr.id}`} className="text-xs">Disposition</Label>
              <Select
                id={`disp-${ncr.id}`}
                value={disposition}
                onValueChange={v => setDisposition(v ?? '')}
                placeholder="Select disposition..."
                options={[
                  { value: 'use_as_is',           label: 'Use As-Is' },
                  { value: 'repair',               label: 'Repair' },
                  { value: 'rework',               label: 'Rework' },
                  { value: 'reject',               label: 'Reject & Replace' },
                  { value: 'accept_with_deviation', label: 'Accept with Deviation' },
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`cost-${ncr.id}`} className="text-xs">Cost Impact ($)</Label>
              <Input
                id={`cost-${ncr.id}`}
                type="number"
                min={0}
                step={100}
                value={costImpact}
                onChange={e => setCostImpact(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={saving || (!rootCause.trim() && !disposition)}
              onClick={handleSaveDisposition}
            >
              {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Save
            </Button>
            {isOpen && (
              <Button size="sm" variant="outline" disabled={saving} onClick={handleStartProgress}>
                <Clock className="size-3.5 mr-1.5" aria-hidden />
                Start progress
              </Button>
            )}
            <Button
              size="sm"
              disabled={saving || !canClose}
              title={!canClose ? 'Record a root cause and disposition first' : undefined}
              onClick={handleClose}
            >
              <CheckCircle2 className="size-3.5 mr-1.5" aria-hidden />
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Closed details */}
      {isClosed && (
        <div className="space-y-2 rounded-lg bg-muted/30 px-3 py-2.5 text-sm">
          {ncr.root_cause && <p><span className="font-medium text-muted-foreground">Root Cause: </span>{ncr.root_cause}</p>}
          {ncr.disposition && <p><span className="font-medium text-muted-foreground">Disposition: </span>{ncr.disposition}</p>}
          {ncr.cost_impact != null && ncr.cost_impact > 0 && (
            <p><span className="font-medium text-muted-foreground">Cost Impact: </span>${ncr.cost_impact.toLocaleString('en-US')}</p>
          )}
        </div>
      )}

      {/* Linked hold-point note */}
      {ncr.linked_activity_id && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="size-3.5" aria-hidden />
          Auto-created from failed ITP hold point
        </p>
      )}
    </div>
  )
}

const newNcrSchema = z.object({
  title:       z.string().min(3, 'Title required'),
  category:    z.enum(['failed_inspection', 'audit', 'site_observation']),
  severity:    z.enum(['critical', 'major', 'minor']),
  description: z.string().optional(),
})
type NewNcrFormValues = z.infer<typeof newNcrSchema>

function NewNcrDialog({
  open, onClose, projectId,
}: { open: boolean; onClose: () => void; projectId: string }) {
  const { toast } = useToast()
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<NewNcrFormValues>({
    resolver: zodResolver(newNcrSchema),
    defaultValues: { category: 'site_observation', severity: 'minor' },
  })
  const [costImpact, setCostImpact] = React.useState('')

  async function onSubmit(values: NewNcrFormValues) {
    const cost = costImpact.trim() ? Number(costImpact) : undefined
    const res = await createNcr({
      projectId,
      ...values,
      cost_impact: cost != null && !Number.isNaN(cost) ? cost : undefined,
    })
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'danger' }); return }
    toast({ title: 'NCR raised', description: 'NCR created successfully.', variant: 'success' })
    reset()
    setCostImpact('')
    onClose()
    globalMutate(`ncr-register-${projectId}`)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Raise New NCR</DialogTitle>
          <DialogDescription>Non-Conformance Report — fills the NCR register for this project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1">
            <Label htmlFor="ncr-title">Title</Label>
            <Input id="ncr-title" {...register('title')} placeholder="Describe the non-conformance" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ncr-category">Category</Label>
            <Select
              id="ncr-category"
              value={watch('category')}
              onValueChange={v => v && setValue('category', v as NcrCategory)}
              options={[
                { value: 'failed_inspection', label: 'Failed Inspection' },
                { value: 'audit',             label: 'Audit' },
                { value: 'site_observation',  label: 'Site Observation' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ncr-severity">Severity</Label>
              <Select
                id="ncr-severity"
                value={watch('severity')}
                onValueChange={v => v && setValue('severity', v as NcrSeverity)}
                options={[
                  { value: 'critical', label: 'Critical' },
                  { value: 'major',    label: 'Major' },
                  { value: 'minor',    label: 'Minor' },
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ncr-cost">Cost Impact <span className="text-muted-foreground">($)</span></Label>
              <Input
                id="ncr-cost"
                type="number"
                min={0}
                step={100}
                value={costImpact}
                onChange={e => setCostImpact(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ncr-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="ncr-desc" {...register('description')} rows={3} placeholder="Detailed description..." className="resize-none" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Raise NCR
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NcrSection({ projectId }: { projectId: string }) {
  const { data, mutate } = useSWR(`ncr-register-${projectId}`, () => getNcrRegister(projectId))
  const [selected, setSelected] = React.useState<QualityNcr | null>(null)
  const [newOpen, setNewOpen] = React.useState(false)
  const detailRef = React.useRef<HTMLDivElement | null>(null)

  const rows = data?.rows ?? []
  const isLive = rows.length > 0

  // Deep-link support: /projects/[id]/quality?ncr=<id> (e.g. from a notification)
  // auto-opens that NCR's detail panel once the register has loaded. Runs once
  // per id so the user can freely close the panel afterwards.
  const searchParams = useSearchParams()
  const ncrParam = searchParams.get('ncr')
  const openedParamRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!ncrParam || openedParamRef.current === ncrParam) return
    const match = rows.find(r => r.id === ncrParam)
    if (match) {
      openedParamRef.current = ncrParam
      setSelected(match)
      // Defer scroll until the panel has rendered.
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }, [ncrParam, rows])

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">NCR Register</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Non-conformance reports for this project</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            isLive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                   : 'bg-muted text-muted-foreground',
          )}>
            {isLive ? 'Live' : 'Illustrative'}
          </span>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="size-3.5 mr-1.5" aria-hidden />
            New NCR
          </Button>
        </div>
      </div>

      {/* Selected NCR detail */}
      {selected && (
        <div ref={detailRef} className="scroll-mt-4">
          <NcrDetailPanel
            ncr={selected}
            onClose={() => setSelected(null)}
            onRefresh={() => { mutate(); setSelected(null) }}
          />
        </div>
      )}

      {/* Table or empty state */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
          <ClipboardCheck className="size-8 text-muted-foreground/40 mx-auto mb-3" aria-hidden />
          <p className="text-sm font-medium text-muted-foreground">No NCRs yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Raise an NCR to start tracking non-conformances</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">NCR No.</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">Title</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">Category</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">Severity</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">Raised</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground">Cost Impact</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">Age</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(ncr => {
                const meta = SEVERITY_META[ncr.severity] ?? SEVERITY_FALLBACK(ncr.severity)
                const Icon = meta.icon
                return (
                  <tr
                    key={ncr.id}
                    onClick={() => setSelected(ncr)}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">{ncr.ncr_number}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{ncr.title}</p>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{CATEGORY_LABELS[ncr.category]}</td>
                    <td className="py-3 px-4">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium', meta.bg)}>
                        <Icon className="size-3" style={{ color: meta.color }} aria-hidden />
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', NCR_STATUS_COLORS[ncr.status])}>
                        {NCR_STATUS_LABELS[ncr.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(ncr.raised_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right text-xs tabular-nums text-foreground">
                      {ncr.cost_impact != null && ncr.cost_impact > 0
                        ? `$${ncr.cost_impact.toLocaleString('en-US')}`
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <AgingBadge aging={ncr.aging} daysOpen={ncr.days_open} />
                      {ncr.aging === 'none' && ncr.status !== 'closed' && (
                        <span className="text-xs text-muted-foreground">{ncr.days_open}d</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewNcrDialog open={newOpen} onClose={() => setNewOpen(false)} projectId={projectId} />
    </div>
  )
}
