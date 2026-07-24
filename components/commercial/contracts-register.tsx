'use client'

import * as React from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  FileText, Plus, ChevronRight, X, Loader2, AlertTriangle,
  CheckCircle2, Clock, DollarSign, Gavel, Trash2, ArrowLeft,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  getContractsRegister, createContract, updateMilestoneStatus,
  type Contract, type ContractType, type ContractStatus, type MilestoneStatus,
  type ContractsRegister,
} from '@/app/actions/contracts'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function fmtUsdFull(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

// ─── Type metadata ────────────────────────────────────────────────────────────

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  epc:              'EPC',
  lump_sum:         'Lump Sum',
  cost_reimbursable:'Cost Reimb.',
  framework:        'Framework',
  supply:           'Supply',
  service:          'Service',
  other:            'Other',
}

const CONTRACT_TYPE_COLORS: Record<ContractType, string> = {
  epc:              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  lump_sum:         'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  cost_reimbursable:'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  framework:        'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  supply:           'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  service:          'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-400',
  other:            'bg-muted text-muted-foreground',
}

const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  draft:      'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
  active:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  terminated: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  suspended:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  pending:  'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
  achieved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  missed:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  paid:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

const CONTRACT_TYPE_OPTIONS = [
  { value: 'epc',              label: 'EPC' },
  { value: 'lump_sum',         label: 'Lump Sum' },
  { value: 'cost_reimbursable',label: 'Cost Reimbursable' },
  { value: 'framework',        label: 'Framework' },
  { value: 'supply',           label: 'Supply' },
  { value: 'service',          label: 'Service' },
  { value: 'other',            label: 'Other' },
]

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: 'red' | 'amber' | 'green' }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-1 min-w-0">
      <p className={cn(
        'text-2xl font-bold tabular-nums',
        accent === 'red'   ? 'text-red-600 dark:text-red-400'   :
        accent === 'amber' ? 'text-amber-600 dark:text-amber-400' :
        accent === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
        'text-foreground',
      )}>{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/70">{sub}</p>}
    </div>
  )
}

// ─── Contract detail panel ────────────────────────────────────────────────────

function ContractDetail({
  contract, projectId, onClose, onRefresh,
}: {
  contract: Contract
  projectId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [updating, setUpdating] = React.useState<string | null>(null)

  async function handleMilestone(id: string, status: MilestoneStatus) {
    setUpdating(id)
    const res = await updateMilestoneStatus(id, status)
    setUpdating(null)
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'danger' })
      return
    }
    toast({ title: 'Updated', description: `Milestone marked ${status}.`, variant: 'success' })
    onRefresh()
  }

  const ld = contract.ld_exposure
  const hasLd = ld.days_late > 0

  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-mono text-xs font-semibold text-muted-foreground">{contract.contract_no}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', CONTRACT_TYPE_COLORS[contract.type])}>
              {CONTRACT_TYPE_LABELS[contract.type]}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', CONTRACT_STATUS_COLORS[contract.status])}>
              {contract.status}
            </span>
          </div>
          <h2 className="text-base font-semibold text-foreground">{contract.title}</h2>
          {contract.party && <p className="text-xs text-muted-foreground mt-0.5">{contract.party}</p>}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close contract detail"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* Contract terms */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contract terms</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <span className="text-xs text-muted-foreground block">Value</span>
            <span className="font-semibold text-foreground">{fmtUsdFull(contract.value)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Currency</span>
            <span className="font-semibold text-foreground">{contract.currency}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Signed</span>
            <span className="font-semibold text-foreground">{fmtDate(contract.signed_date)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Commencement</span>
            <span className="font-semibold text-foreground">{fmtDate(contract.commencement)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Completion</span>
            <span className="font-semibold text-foreground">{fmtDate(contract.completion)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Retention</span>
            <span className="font-semibold text-foreground">{contract.retention_pct}%</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">LD rate / day</span>
            <span className="font-semibold text-foreground">{fmtUsdFull(contract.ld_rate_per_day)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">LD cap</span>
            <span className="font-semibold text-foreground">{contract.ld_cap_pct}% of value</span>
          </div>
        </div>
      </div>

      {/* LD exposure breakdown */}
      {hasLd && (
        <div className={cn(
          'px-5 py-4',
          ld.capped ? 'bg-red-50/50 dark:bg-red-900/10' : 'bg-amber-50/50 dark:bg-amber-900/10',
        )}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">LD Exposure breakdown</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
            <span className="text-muted-foreground">
              {ld.days_late} day{ld.days_late !== 1 ? 's' : ''} late
              <span className="mx-1.5 text-muted-foreground/40">×</span>
              {fmtUsdFull(contract.ld_rate_per_day)} / day
              <span className="mx-1.5 text-muted-foreground/40">=</span>
              <span className="font-semibold text-foreground">{fmtUsdFull(ld.days_late * contract.ld_rate_per_day)}</span>
            </span>
            {ld.capped && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                Capped at {fmtUsdFull(ld.ld_amount)} ({contract.ld_cap_pct}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Milestones
          <span className="ml-2 font-normal text-muted-foreground/60">{contract.milestones.length}</span>
        </p>
        {contract.milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No milestones attached.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Title</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Due</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contract.milestones.map(m => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 font-medium text-foreground">{m.title}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(m.due_date)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fmtUsdFull(m.amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', MILESTONE_STATUS_COLORS[m.status])}>
                        {m.status}
                      </span>
                      {m.achieved_date && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">{fmtDate(m.achieved_date)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {m.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleMilestone(m.id, 'achieved')}
                              disabled={updating === m.id}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                            >
                              {updating === m.id ? <Loader2 className="size-2.5 animate-spin" /> : <CheckCircle2 className="size-2.5" />}
                              Achieve
                            </button>
                            <button
                              onClick={() => handleMilestone(m.id, 'missed')}
                              disabled={updating === m.id}
                              className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
                            >
                              <AlertTriangle className="size-2.5" />
                              Miss
                            </button>
                          </>
                        )}
                        {m.status === 'achieved' && (
                          <button
                            onClick={() => handleMilestone(m.id, 'paid')}
                            disabled={updating === m.id}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                          >
                            {updating === m.id ? <Loader2 className="size-2.5 animate-spin" /> : <DollarSign className="size-2.5" />}
                            Mark paid
                          </button>
                        )}
                        {m.status === 'missed' && (
                          <button
                            onClick={() => handleMilestone(m.id, 'achieved')}
                            disabled={updating === m.id}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                          >
                            {updating === m.id ? <Loader2 className="size-2.5 animate-spin" /> : <CheckCircle2 className="size-2.5" />}
                            Achieve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── New contract dialog schema ───────────────────────────────────────────────

const milestoneSchema = z.object({
  title:    z.string().min(1, 'Title required'),
  due_date: z.string().min(1, 'Due date required'),
  amount:   z.coerce.number().min(0, 'Amount must be ≥ 0'),
})

const newContractSchema = z.object({
  title:           z.string().min(3, 'Title required (min 3 chars)'),
  party:           z.string().optional(),
  type:            z.enum(['epc','lump_sum','cost_reimbursable','framework','supply','service','other']),
  value:           z.coerce.number().min(1, 'Value must be > 0'),
  currency:        z.string().optional(),
  signed_date:     z.string().optional(),
  commencement:    z.string().optional(),
  completion:      z.string().optional(),
  retention_pct:   z.coerce.number().min(0).max(100).optional(),
  ld_rate_per_day: z.coerce.number().min(0).optional(),
  ld_cap_pct:      z.coerce.number().min(0).max(100).optional(),
  milestones:      z.array(milestoneSchema).optional(),
})

type NewContractFormValues = z.infer<typeof newContractSchema>

function NewContractDialog({
  open, onClose, projectId,
}: { open: boolean; onClose: () => void; projectId: string }) {
  const { toast } = useToast()
  const {
    register, handleSubmit, reset, watch, setValue,
    control, formState: { errors, isSubmitting },
  } = useForm<NewContractFormValues>({
    resolver: zodResolver(newContractSchema),
    defaultValues: { type: 'epc', currency: 'USD', retention_pct: 5, ld_cap_pct: 10, ld_rate_per_day: 0, milestones: [] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'milestones' as 'milestones' })

  async function onSubmit(values: NewContractFormValues) {
    const res = await createContract(
      projectId,
      {
        title:           values.title,
        party:           values.party || undefined,
        type:            values.type as ContractType,
        value:           values.value,
        currency:        values.currency ?? 'USD',
        signed_date:     values.signed_date || null,
        commencement:    values.commencement || null,
        completion:      values.completion || null,
        retention_pct:   values.retention_pct ?? 5,
        ld_rate_per_day: values.ld_rate_per_day ?? 0,
        ld_cap_pct:      values.ld_cap_pct ?? 10,
      },
      (values.milestones ?? []) as { title: string; due_date: string; amount: number }[],
    )
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'danger' })
      return
    }
    toast({ title: 'Contract created', description: 'Contract registered successfully.', variant: 'success' })
    reset()
    onClose()
    globalMutate(`contracts-register-${projectId}`)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Contract</DialogTitle>
          <DialogDescription>Add an EPC, supply, or service contract to this project. Milestones can be added now or later.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-1">
          {/* Core details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nc-title">Title</Label>
              <Input id="nc-title" {...register('title')} placeholder="e.g. EPC Contract — BESS Balance of Plant" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-party">Counterparty</Label>
              <Input id="nc-party" {...register('party')} placeholder="Contractor / supplier name" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={watch('type')}
                onValueChange={v => v && setValue('type', v as ContractType)}
                options={CONTRACT_TYPE_OPTIONS}
              />
              {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-value">Contract value (USD)</Label>
              <Input id="nc-value" type="number" min="0" step="1" {...register('value')} placeholder="0" />
              {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-currency">Currency</Label>
              <Input id="nc-currency" {...register('currency')} placeholder="USD" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-signed">Signed date</Label>
              <Input id="nc-signed" type="date" {...register('signed_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-start">Commencement</Label>
              <Input id="nc-start" type="date" {...register('commencement')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-end">Completion</Label>
              <Input id="nc-end" type="date" {...register('completion')} />
            </div>
          </div>

          {/* LD + retention terms */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contractual terms</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-ret">Retention %</Label>
                <Input id="nc-ret" type="number" min="0" max="100" step="0.5" {...register('retention_pct')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-ld-rate">LD rate / day (USD)</Label>
                <Input id="nc-ld-rate" type="number" min="0" step="100" {...register('ld_rate_per_day')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-ld-cap">LD cap % of value</Label>
                <Input id="nc-ld-cap" type="number" min="0" max="100" step="0.5" {...register('ld_cap_pct')} />
              </div>
            </div>
          </div>

          {/* Dynamic milestones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Milestones <span className="font-normal">({fields.length})</span>
              </p>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => append({ title: '', due_date: '', amount: 0 })}
              >
                <Plus className="size-3.5 mr-1" aria-hidden />
                Add milestone
              </Button>
            </div>

            {fields.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No milestones added — you can add them after creation too.</p>
            )}

            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="flex items-start gap-2 rounded-lg border border-border bg-background p-3">
                  <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <Input
                        {...register(`milestones.${idx}.title`)}
                        placeholder="Milestone title"
                        className="text-sm"
                      />
                      {errors.milestones?.[idx]?.title && (
                        <p className="mt-0.5 text-xs text-destructive">{errors.milestones[idx]?.title?.message}</p>
                      )}
                    </div>
                    <div>
                      <Input type="date" {...register(`milestones.${idx}.due_date`)} className="text-sm" />
                      {errors.milestones?.[idx]?.due_date && (
                        <p className="mt-0.5 text-xs text-destructive">{errors.milestones[idx]?.due_date?.message}</p>
                      )}
                    </div>
                    <div>
                      <Input
                        type="number" min="0" step="1000"
                        {...register(`milestones.${idx}.amount`)}
                        placeholder="Amount USD"
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="shrink-0 mt-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove milestone ${idx + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Register contract
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main register component ──────────────────────────────────────────────────

export function ContractsRegister({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const { data, isLoading, mutate } = useSWR<ContractsRegister>(
    `contracts-register-${projectId}`,
    () => getContractsRegister(projectId),
  )
  const [selected, setSelected] = React.useState<Contract | null>(null)
  const [newOpen, setNewOpen] = React.useState(false)

  const contracts = data?.contracts ?? []
  const summary   = data?.summary
  const isLive    = contracts.length > 0

  // If selected contract is stale after refresh, re-sync
  React.useEffect(() => {
    if (!selected || !data) return
    const fresh = data.contracts.find(c => c.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalValue = summary?.total_value_by_type.reduce((a, t) => a + t.value, 0) ?? 0
  const activeCount = summary?.active_count ?? 0
  const missedCount = summary?.milestone_missed ?? 0
  const ldTotal     = summary?.total_ld_exposure ?? 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Contracts Register</h1>
          <p className="text-sm text-muted-foreground mt-0.5">EPC, supply, and service contracts — milestones, LDs, and bonds</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            isLive
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground',
          )}>
            {isLive ? 'Live' : 'Illustrative'}
          </span>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4 mr-1.5" aria-hidden />
            New contract
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total contract value"
          value={isLoading ? '—' : fmtUsd(totalValue)}
          sub={summary ? `${summary.total_value_by_type.length} type${summary.total_value_by_type.length !== 1 ? 's' : ''}` : undefined}
        />
        <KpiCard
          label="Active contracts"
          value={isLoading ? '—' : String(activeCount)}
          accent={activeCount > 0 ? 'green' : undefined}
        />
        <KpiCard
          label="Milestones missed"
          value={isLoading ? '—' : String(missedCount)}
          accent={missedCount > 0 ? 'red' : undefined}
          sub={summary ? `${summary.milestone_pending} pending` : undefined}
        />
        <KpiCard
          label="LD exposure"
          value={isLoading ? '—' : fmtUsdFull(ldTotal)}
          accent={ldTotal > 0 ? 'red' : undefined}
          sub={ldTotal > 0 ? 'Liquidated damages accruing' : 'No active LD exposure'}
        />
      </div>

      {/* Contract detail panel (inline, above table) */}
      {selected && (
        <ContractDetail
          contract={selected}
          projectId={projectId}
          onClose={() => setSelected(null)}
          onRefresh={() => mutate()}
        />
      )}

      {/* Contracts table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <ShieldCheck className="size-10 text-muted-foreground/30 mx-auto mb-3" aria-hidden />
          <p className="text-sm font-semibold text-muted-foreground">No contracts yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs mx-auto">
            Register your EPC and subcontracts to track milestones, LDs and bonds
          </p>
          <Button className="mt-5" onClick={() => setNewOpen(true)}>
            <Plus className="size-4 mr-1.5" aria-hidden />
            Register first contract
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Contract</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Party</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Completion</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">LD exposure</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground sr-only">Open</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => {
                const ld = c.ld_exposure
                const isSelected = selected?.id === c.id
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(isSelected ? null : c)}
                    className={cn(
                      'border-b border-border last:border-0 cursor-pointer transition-colors group',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/30',
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-muted-foreground mb-0.5">{c.contract_no}</p>
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{c.title}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                      {c.party ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', CONTRACT_TYPE_COLORS[c.type])}>
                        {CONTRACT_TYPE_LABELS[c.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fmtUsdFull(c.value)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(c.completion)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ld.days_late > 0 ? (
                        <span className={cn(
                          'inline-flex items-center gap-1 font-mono text-xs tabular-nums font-semibold',
                          ld.capped ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
                        )}>
                          {fmtUsdFull(ld.ld_amount)}
                          {ld.capped && (
                            <span className="ml-1 rounded-full bg-red-100 px-1 py-0 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              capped
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', CONTRACT_STATUS_COLORS[c.status])}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className={cn(
                        'size-4 text-muted-foreground/40 transition-transform',
                        isSelected && 'rotate-90',
                      )} aria-hidden />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewContractDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        projectId={projectId}
      />
    </div>
  )
}
