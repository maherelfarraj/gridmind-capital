'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import useSWR from 'swr'
import { Loader2, Plus, Gavel, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { formatUsd, formatDate } from '@/lib/variation-orders/ui'
import {
  getClaims, createClaim, updateClaimStatus,
  type ClaimType, type ClaimStatus,
} from '@/app/actions/claims'

// ─── Display maps ─────────────────────────────────────────────

const TYPE_LABELS: Record<ClaimType, string> = {
  time: 'Extension of Time', cost: 'Cost', disruption: 'Disruption', other: 'Other',
}
const STATUS_LABELS: Record<ClaimStatus, string> = {
  submitted: 'Submitted', under_review: 'Under Review', accepted: 'Accepted',
  rejected: 'Rejected', settled: 'Settled', withdrawn: 'Withdrawn',
}
const STATUS_COLORS: Record<ClaimStatus, string> = {
  submitted: '#f59e0b', under_review: '#3b82f6', accepted: '#22c55e',
  rejected: '#ef4444', settled: '#64748b', withdrawn: '#94a3b8',
}
/** Allowed forward transitions (mirrors the server guard). */
const NEXT_STATUS: Record<ClaimStatus, ClaimStatus[]> = {
  submitted:    ['under_review', 'accepted', 'rejected', 'withdrawn'],
  under_review: ['accepted', 'rejected', 'settled', 'withdrawn'],
  accepted:     ['settled'],
  rejected:     ['withdrawn'],
  settled:      [],
  withdrawn:    [],
}

const TYPE_OPTIONS = (Object.keys(TYPE_LABELS) as ClaimType[]).map((v) => ({ value: v, label: TYPE_LABELS[v] }))

const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'
const fieldCls =
  'w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40'

// ─── Create dialog (react-hook-form + zod) ────────────────────

const schema = z.object({
  title:        z.string().min(2, 'Title is required'),
  type:         z.enum(['time', 'cost', 'disruption', 'other']),
  amount:       z.string().optional(),
  eot_days:     z.string().optional(),
  response_due: z.string().optional(),
  description:  z.string().optional(),
})
type FormValues = z.infer<typeof schema>

function CreateClaimDialog({
  open, onOpenChange, projectId, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; projectId: string; onCreated: () => void
}) {
  const { toast } = useToast()
  const {
    register, handleSubmit, control, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', type: 'cost', amount: '', eot_days: '', response_due: '', description: '' },
  })

  React.useEffect(() => {
    if (open) reset({ title: '', type: 'cost', amount: '', eot_days: '', response_due: '', description: '' })
  }, [open, reset])

  async function onSubmit(values: FormValues) {
    const res = await createClaim({
      project_id: projectId,
      title: values.title,
      type: values.type,
      amount: values.amount === '' || values.amount == null ? 0 : Number(values.amount),
      eot_days: values.eot_days === '' || values.eot_days == null ? 0 : Number(values.eot_days),
      response_due: values.response_due || null,
      description: values.description || null,
    })
    if (res.error || !res.data) { toast({ title: 'Error', description: res.error, variant: 'danger' }); return }
    toast({ title: `${res.data.claim_number} created`, variant: 'success' })
    onCreated(); onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Claim</DialogTitle>
          <DialogDescription>Record a contractual claim for cost and/or an extension of time.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className={labelCls}>Title <span className="text-[#ef4444]">*</span></label>
            <input {...register('title')} placeholder="e.g. Prolongation costs — delayed grid connection" className={fieldCls} />
            {errors.title && <p className="mt-1 text-xs text-[#ef4444]">{errors.title.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Claim type</label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} options={TYPE_OPTIONS} placeholder="Select type" />
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount (USD)</label>
              <input type="number" {...register('amount')} placeholder="0" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>EOT (days)</label>
              <input type="number" {...register('eot_days')} placeholder="0" className={fieldCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Response due</label>
            <input type="date" {...register('response_due')} className={fieldCls} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea {...register('description')} rows={3} placeholder="Basis of claim, contractual reference, and quantum…"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 resize-none" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />} Create Claim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Status badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: ClaimStatus }) {
  const color = STATUS_COLORS[status]
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: `${color}20`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Main section ─────────────────────────────────────────────

export function ClaimsSection({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const { data, isLoading, mutate } = useSWR(
    `claims-${projectId}`,
    () => getClaims(projectId),
    { revalidateOnFocus: true },
  )

  const rows = data?.rows ?? []
  const kpis = data?.kpis
  const today = new Date().toISOString().slice(0, 10)

  async function handleStatus(id: string, status: ClaimStatus) {
    setBusyId(id)
    const res = await updateClaimStatus(id, status)
    setBusyId(null)
    if (res.error) { toast({ title: 'Cannot update', description: res.error, variant: 'danger' }); return }
    toast({ title: `Claim ${STATUS_LABELS[status].toLowerCase()}`, variant: 'success' })
    mutate()
  }

  return (
    <>
      <CreateClaimDialog open={createOpen} onOpenChange={setCreateOpen} projectId={projectId} onCreated={() => mutate()} />

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Gavel className="size-4 text-muted-foreground" /> Claims Register
            </CardTitle>
            {kpis && rows.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.openCount} open · {formatUsd(kpis.claimedAmount)} claimed · {kpis.claimedEotDays}d EOT
                {kpis.overdueCount > 0 && (
                  <span className="text-[#ef4444] font-medium"> · {kpis.overdueCount} overdue</span>
                )}
              </p>
            )}
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New Claim</Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
            ))}</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Gavel className="size-9 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-semibold text-foreground">No claims recorded</p>
              <p className="text-xs text-muted-foreground mt-1">Raise a contractual claim for cost or an extension of time.</p>
              <Button size="sm" className="mt-3" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New Claim</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Claim #', 'Title', 'Type', 'Amount', 'EOT', 'Status', 'Response Due', 'Actions'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const overdue = r.response_due != null && r.response_due < today &&
                      (r.status === 'submitted' || r.status === 'under_review')
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors align-top">
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-xs bg-muted/40 px-1.5 py-0.5 rounded">{r.claim_number}</span>
                        </td>
                        <td className="py-2.5 px-3 text-foreground font-medium max-w-[240px]">{r.title}</td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{TYPE_LABELS[r.type]}</td>
                        <td className="py-2.5 px-3 font-mono text-foreground whitespace-nowrap">{r.amount ? formatUsd(r.amount) : '—'}</td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{r.eot_days ? `${r.eot_days}d` : '—'}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={r.status} /></td>
                        <td className={cn('py-2.5 px-3 whitespace-nowrap', overdue ? 'text-[#ef4444] font-medium' : 'text-muted-foreground')}>
                          <span className="inline-flex items-center gap-1">
                            {overdue && <AlertTriangle className="size-3.5" aria-hidden />}
                            {formatDate(r.response_due)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            {NEXT_STATUS[r.status].length === 0 ? (
                              <span className="text-xs text-muted-foreground/60">—</span>
                            ) : (
                              NEXT_STATUS[r.status].map((next) => (
                                <button
                                  key={next}
                                  type="button"
                                  disabled={busyId === r.id}
                                  onClick={() => handleStatus(r.id, next)}
                                  className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-[#64ffda]/40 transition-colors disabled:opacity-50 whitespace-nowrap"
                                  style={{ color: STATUS_COLORS[next] }}
                                >
                                  {busyId === r.id ? <Loader2 className="size-3 animate-spin" /> : STATUS_LABELS[next]}
                                </button>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
