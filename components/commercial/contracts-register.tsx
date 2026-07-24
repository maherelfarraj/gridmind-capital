'use client'

import * as React from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  FileText, Plus, ChevronRight, X, Loader2, AlertTriangle,
  CheckCircle2, Clock, DollarSign, Gavel, Trash2, ArrowLeft,
  ShieldCheck, Shield, ShieldAlert, ShieldOff, BadgeDollarSign,
  RefreshCw, XCircle, LinkIcon,
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
  getSecuritiesRegister, createSecurity, releaseSecurity, claimSecurity,
  type Contract, type ContractType, type ContractStatus, type MilestoneStatus,
  type ContractsRegister, type Security, type SecurityType, type SecurityStatus,
  type SecuritiesRegister,
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

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITIES
// ═══════════════════════════════════════════════════════════════════════════════

const SECURITY_TYPE_META: Record<SecurityType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  performance_bond:       { label: 'Performance Bond',       icon: Shield,           color: '#1d4ed8', bg: 'bg-blue-100 dark:bg-blue-900/30'    },
  advance_payment_bond:   { label: 'Advance Payment Bond',   icon: BadgeDollarSign,  color: '#0891b2', bg: 'bg-cyan-100 dark:bg-cyan-900/30'    },
  retention_bond:         { label: 'Retention Bond',         icon: ShieldCheck,      color: '#0f766e', bg: 'bg-teal-100 dark:bg-teal-900/30'    },
  bid_bond:               { label: 'Bid Bond',               icon: Gavel,            color: '#7c3aed', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  warranty_bond:          { label: 'Warranty Bond',          icon: ShieldAlert,      color: '#d97706', bg: 'bg-amber-100 dark:bg-amber-900/30'  },
  letter_of_credit:       { label: 'Letter of Credit',       icon: FileText,         color: '#be185d', bg: 'bg-pink-100 dark:bg-pink-900/30'    },
  other:                  { label: 'Other',                  icon: ShieldOff,        color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-800/50'  },
}

const SECURITY_STATUS_META: Record<SecurityStatus, { label: string; color: string }> = {
  active:   { label: 'Active',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  expired:  { label: 'Expired',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'               },
  released: { label: 'Released', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400'       },
  claimed:  { label: 'Claimed',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'   },
}

const SECURITY_TYPE_OPTIONS = [
  { value: 'performance_bond',      label: 'Performance Bond'      },
  { value: 'advance_payment_bond',  label: 'Advance Payment Bond'  },
  { value: 'retention_bond',        label: 'Retention Bond'        },
  { value: 'bid_bond',              label: 'Bid Bond'              },
  { value: 'warranty_bond',         label: 'Warranty Bond'         },
  { value: 'letter_of_credit',      label: 'Letter of Credit'      },
  { value: 'other',                 label: 'Other'                 },
]

/** Green >90d, amber ≤90d, red ≤30d, black "EXPIRED" */
function ExpiryCell({ days, status }: { days: number | null; status: SecurityStatus }) {
  if (status !== 'active' && status !== 'expired') return <span className="text-xs text-muted-foreground/50">—</span>
  if (status === 'expired' || (days !== null && days < 0)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-gray-100 dark:text-gray-900">
        EXPIRED
      </span>
    )
  }
  if (days === null) return <span className="text-xs text-muted-foreground">—</span>
  const isRed   = days <= 30
  const isAmber = days <= 90
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
      isRed   ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'     :
      isAmber ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    )}>
      <Clock className="size-2.5" aria-hidden />
      {days}d
    </span>
  )
}

// ─── Security detail inline panel ────────────────────────────────────────────

function SecurityDetail({
  security, contracts, projectId, onClose, onRefresh,
}: {
  security: Security
  contracts: Contract[]
  projectId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [acting, setActing] = React.useState<'release' | 'claim' | null>(null)

  const meta   = SECURITY_TYPE_META[security.type]
  const Icon   = meta.icon
  const days   = security.days_to_expiry
  const isExpiredActive = security.status === 'expired' || (security.status === 'active' && days !== null && days < 0)
  const linked = contracts.find(c => c.id === security.contract_id)

  async function handleRelease() {
    setActing('release')
    const res = await releaseSecurity(security.id)
    setActing(null)
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Released', description: 'Security instrument marked as released.', variant: 'success' })
    onRefresh()
    onClose()
  }

  async function handleClaim() {
    setActing('claim')
    const res = await claimSecurity(security.id)
    setActing(null)
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Claimed', description: 'Security instrument marked as claimed.', variant: 'success' })
    onRefresh()
    onClose()
  }

  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn('size-10 rounded-lg flex items-center justify-center shrink-0', meta.bg)}>
            <Icon className="size-5" style={{ color: meta.color }} aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', SECURITY_STATUS_META[security.status].color)}>
                {SECURITY_STATUS_META[security.status].label}
              </span>
              <ExpiryCell days={days} status={security.status} />
            </div>
            <p className="font-semibold text-foreground">{meta.label}</p>
            {security.issuer && <p className="text-xs text-muted-foreground mt-0.5">{security.issuer}</p>}
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Close detail">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* Renewal reminder alert */}
      {isExpiredActive && (
        <div className="px-5 py-3 bg-red-50 dark:bg-red-900/10 flex items-start gap-3">
          <AlertTriangle className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-red-700 dark:text-red-400">Renew or release required</p>
            <p className="text-red-600/80 dark:text-red-400/70 text-xs mt-0.5">
              This security has expired but is still recorded as active. Obtain a renewed instrument from the issuer, or release it to clear the register.
            </p>
          </div>
        </div>
      )}

      {/* Terms grid */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Instrument details</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-3">
          <div>
            <span className="text-xs text-muted-foreground block">Reference</span>
            <span className="font-semibold text-foreground font-mono text-xs">{security.reference ?? '—'}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Amount</span>
            <span className="font-semibold text-foreground">{fmtUsdFull(security.amount)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Currency</span>
            <span className="font-semibold text-foreground">{security.currency}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Issue date</span>
            <span className="font-semibold text-foreground">{fmtDate(security.issue_date)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Expiry date</span>
            <span className="font-semibold text-foreground">{fmtDate(security.expiry_date)}</span>
          </div>
          {linked && (
            <div>
              <span className="text-xs text-muted-foreground block">Linked contract</span>
              <span className="font-semibold text-foreground flex items-center gap-1">
                <LinkIcon className="size-3 text-muted-foreground" aria-hidden />
                {linked.contract_no}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {(security.status === 'active' || security.status === 'expired') && (
        <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
          <Button
            size="sm" variant="outline"
            disabled={acting !== null}
            onClick={handleRelease}
          >
            {acting === 'release' ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="size-3.5 mr-1.5" aria-hidden />}
            Release
          </Button>
          {security.status === 'active' && (
            <Button
              size="sm" variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
              disabled={acting !== null}
              onClick={handleClaim}
            >
              {acting === 'claim' ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <XCircle className="size-3.5 mr-1.5" aria-hidden />}
              Mark claimed
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── New security dialog ──────────────────────────────────────────────────────

const newSecuritySchema = z.object({
  type:        z.enum(['performance_bond','advance_payment_bond','retention_bond','bid_bond','warranty_bond','letter_of_credit','other']),
  issuer:      z.string().optional(),
  reference:   z.string().optional(),
  amount:      z.coerce.number().min(1, 'Amount must be > 0'),
  currency:    z.string().optional(),
  issue_date:  z.string().optional(),
  expiry_date: z.string().optional(),
  contract_id: z.string().optional(),
})

type NewSecurityFormValues = z.infer<typeof newSecuritySchema>

function NewSecurityDialog({
  open, onClose, projectId, contracts,
}: { open: boolean; onClose: () => void; projectId: string; contracts: Contract[] }) {
  const { toast } = useToast()
  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<NewSecurityFormValues>({
    resolver: zodResolver(newSecuritySchema),
    defaultValues: { type: 'performance_bond', currency: 'USD' },
  })

  async function onSubmit(values: NewSecurityFormValues) {
    const res = await createSecurity(projectId, {
      type:        values.type as SecurityType,
      issuer:      values.issuer || undefined,
      reference:   values.reference || undefined,
      amount:      values.amount,
      currency:    values.currency ?? 'USD',
      issue_date:  values.issue_date || null,
      expiry_date: values.expiry_date || null,
      contract_id: values.contract_id && values.contract_id !== '__none__' ? values.contract_id : null,
    })
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Security added', description: 'Security instrument registered.', variant: 'success' })
    reset()
    onClose()
    globalMutate(`securities-register-${projectId}`)
  }

  const contractOptions = [
    { value: '__none__', label: 'No linked contract' },
    ...contracts.map(c => ({ value: c.id, label: `${c.contract_no} — ${c.title}` })),
  ]

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Security Instrument</DialogTitle>
          <DialogDescription>Register a bond, guarantee, or letter of credit for this project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={watch('type')}
              onValueChange={v => v && setValue('type', v as SecurityType)}
              options={SECURITY_TYPE_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ns-issuer">Issuer / Bank</Label>
              <Input id="ns-issuer" {...register('issuer')} placeholder="e.g. HSBC Middle East" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-ref">Reference No.</Label>
              <Input id="ns-ref" {...register('reference')} placeholder="Bond / guarantee number" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ns-amount">Amount</Label>
              <Input id="ns-amount" type="number" min="0" step="1000" {...register('amount')} placeholder="0" />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-currency">Currency</Label>
              <Input id="ns-currency" {...register('currency')} placeholder="USD" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ns-issue">Issue date</Label>
              <Input id="ns-issue" type="date" {...register('issue_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-expiry">Expiry date</Label>
              <Input id="ns-expiry" type="date" {...register('expiry_date')} />
            </div>
          </div>

          {contracts.length > 0 && (
            <div className="space-y-1.5">
              <Label>Linked contract</Label>
              <Select
                value={watch('contract_id') ?? '__none__'}
                onValueChange={v => setValue('contract_id', !v || v === '__none__' ? '' : v)}
                options={contractOptions}
                placeholder="Select contract (optional)"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Add security
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Securities register section ─────────────────────────────────────────────

function SecuritiesSection({
  projectId, contracts,
}: { projectId: string; contracts: Contract[] }) {
  const { data, isLoading, mutate } = useSWR<SecuritiesRegister>(
    `securities-register-${projectId}`,
    () => getSecuritiesRegister(projectId),
  )
  const [selected, setSelected] = React.useState<Security | null>(null)
  const [newOpen, setNewOpen]   = React.useState(false)

  const securities = data?.securities ?? []
  const summary    = data?.summary
  const isLive     = securities.length > 0

  // Re-sync selected row after refresh
  React.useEffect(() => {
    if (!selected || !data) return
    const fresh = data.securities.find(s => s.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalBonded     = summary?.total_bonded_value ?? 0
  const expiring30      = summary?.expiring_within_30_days ?? 0
  const expiredNotRel   = summary?.expired_not_released ?? 0

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Securities</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Bonds, guarantees, and letters of credit</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            isLive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                   : 'bg-muted text-muted-foreground',
          )}>
            {isLive ? 'Live' : 'Illustrative'}
          </span>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="size-3.5 mr-1.5" aria-hidden />
            New security
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Total bonded value"
          value={isLoading ? '—' : fmtUsd(totalBonded)}
          sub="Active instruments"
        />
        <KpiCard
          label="Expiring in 30 days"
          value={isLoading ? '—' : String(expiring30)}
          accent={expiring30 > 0 ? 'amber' : undefined}
          sub={expiring30 > 0 ? 'Action required' : undefined}
        />
        <KpiCard
          label="Expired, not released"
          value={isLoading ? '—' : String(expiredNotRel)}
          accent={expiredNotRel > 0 ? 'red' : undefined}
          sub={expiredNotRel > 0 ? 'Renew or release' : undefined}
        />
      </div>

      {/* Selected detail panel */}
      {selected && (
        <SecurityDetail
          security={selected}
          contracts={contracts}
          projectId={projectId}
          onClose={() => setSelected(null)}
          onRefresh={() => mutate()}
        />
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : securities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
          <Shield className="size-9 text-muted-foreground/30 mx-auto mb-3" aria-hidden />
          <p className="text-sm font-semibold text-muted-foreground">No securities registered</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs mx-auto">
            Add performance bonds, guarantees, and letters of credit to track expiry and release status.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Issuer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Reference</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Contract</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 sr-only text-xs">Open</th>
              </tr>
            </thead>
            <tbody>
              {securities.map(s => {
                const meta     = SECURITY_TYPE_META[s.type]
                const Icon     = meta.icon
                const isSelected = selected?.id === s.id
                const linked   = contracts.find(c => c.id === s.contract_id)
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(isSelected ? null : s)}
                    className={cn(
                      'border-b border-border last:border-0 cursor-pointer transition-colors group',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/30',
                    )}
                  >
                    {/* Type badge with icon */}
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', meta.bg)}>
                        <Icon className="size-3 shrink-0" style={{ color: meta.color }} aria-hidden />
                        <span style={{ color: meta.color }}>{meta.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                      {s.issuer ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {s.reference ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fmtUsdFull(s.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {linked ? (
                        <span className="flex items-center gap-1">
                          <LinkIcon className="size-3 shrink-0" aria-hidden />
                          {linked.contract_no}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ExpiryCell days={s.days_to_expiry} status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', SECURITY_STATUS_META[s.status].color)}>
                        {SECURITY_STATUS_META[s.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className={cn('size-4 text-muted-foreground/40 transition-transform', isSelected && 'rotate-90')} aria-hidden />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewSecurityDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        projectId={projectId}
        contracts={contracts}
      />
    </div>
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

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Securities section */}
      <SecuritiesSection projectId={projectId} contracts={contracts} />
    </div>
  )
}
