'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Flame, ArrowDown, TriangleAlert, Zap, Box, Construction, HardHat,
  ShieldAlert, Plus, Loader2, X, Clock, MapPin, UserCheck, CheckCircle2,
  Ban, PauseCircle, PlayCircle, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useSession } from '@/lib/session-context'
import { cn } from '@/lib/utils'
import {
  getPermitsBoard, requestPermit, issuePermit, suspendPermit, reinstatePermit,
  closePermit, cancelPermit, getPermitTimeline,
  type WorkPermit, type PermitStatus,
} from '@/app/actions/workpermits'

// ─────────────────────────────────────────────────────────────
// Display metadata
// ─────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: typeof Flame; cls: string }> = {
  hot_work:          { label: 'Hot Work',        icon: Flame,        cls: 'text-orange-500' },
  excavation:        { label: 'Excavation',      icon: ArrowDown,    cls: 'text-amber-600' },
  working_at_height: { label: 'Work at Height',  icon: TriangleAlert, cls: 'text-red-500' },
  electrical:        { label: 'Electrical',      icon: Zap,          cls: 'text-yellow-500' },
  confined_space:    { label: 'Confined Space',  icon: Box,          cls: 'text-blue-500' },
  lifting:           { label: 'Lifting',         icon: Construction, cls: 'text-teal-500' },
  general:           { label: 'General',         icon: HardHat,      cls: 'text-slate-500' },
}
function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type.replace(/_/g, ' '), icon: HardHat, cls: 'text-slate-500' }
}

const TYPE_OPTIONS = Object.entries(TYPE_META).map(([value, m]) => ({ value, label: m.label }))

const HAZARD_OPTIONS = [
  { value: 'fire', label: 'Fire' },
  { value: 'explosion', label: 'Explosion' },
  { value: 'falls', label: 'Falls' },
  { value: 'gases', label: 'Gases' },
  { value: 'energized', label: 'Energized' },
  { value: 'moving_load', label: 'Moving load' },
  { value: 'buried_services', label: 'Buried services' },
  { value: 'weather', label: 'Weather' },
]
const PRECAUTION_OPTIONS = [
  { value: 'fire_watch', label: 'Fire watch' },
  { value: 'gas_test', label: 'Gas test' },
  { value: 'harness', label: 'Harness' },
  { value: 'barricading', label: 'Barricading' },
  { value: 'lockout_tagout', label: 'Lockout / tagout' },
  { value: 'spotter', label: 'Spotter' },
  { value: 'ventilation', label: 'Ventilation' },
  { value: 'permit_display', label: 'Permit display' },
]
const LABELS: Record<string, string> = Object.fromEntries(
  [...HAZARD_OPTIONS, ...PRECAUTION_OPTIONS].map((o) => [o.value, o.label]),
)

const STATUS_META: Record<PermitStatus, { label: string; cls: string }> = {
  requested: { label: 'Requested', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  issued:    { label: 'Issued',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  suspended: { label: 'Suspended', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  expired:   { label: 'Expired',   cls: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  closed:    { label: 'Closed',    cls: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
}

/** Mirrors `typeMeta` — degrades unknown DB statuses to a neutral badge. */
function statusMeta(status: string | null | undefined) {
  return (
    STATUS_META[status as PermitStatus] ?? {
      label: status ? status.replace(/_/g, ' ') : 'Unknown',
      cls:   'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    }
  )
}

/** Kanban columns. The Closed column aggregates all terminal states. */
const COLUMNS: { id: PermitStatus; label: string; terminal?: PermitStatus[] }[] = [
  { id: 'requested', label: 'Requested' },
  { id: 'issued',    label: 'Issued' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'closed',    label: 'Closed', terminal: ['closed', 'expired', 'cancelled'] },
]

const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ─────────────────────────────────────────────────────────────
// Board
// ─────────────────────────────────────────────────────────────

export function WorkPermitsBoard({ projectId }: { projectId: string }) {
  const key = `permits-${projectId}`
  const { data, isLoading, mutate } = useSWR(key, () => getPermitsBoard(projectId))
  const [requestOpen, setRequestOpen] = useState(false)
  const [selected, setSelected] = useState<WorkPermit | null>(null)

  const stats = data?.stats
  const total = data?.all.length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/projects/${projectId}`} className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back to project
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Permits to Work</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Request, issue and control permits across the site</p>
        </div>
        <Button onClick={() => setRequestOpen(true)}>
          <Plus className="size-4 mr-1.5" /> Request Permit
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="region" aria-label="Permit statistics">
        <StatCard label="Active now"      value={stats?.activeNow ?? 0}   icon={CheckCircle2} tone="ok" />
        <StatCard label="Expiring in 48h" value={stats?.expiring48h ?? 0}  icon={Clock}        tone="amber" />
        <StatCard label="Awaiting issue"  value={stats?.requested ?? 0}    icon={UserCheck}    tone="neutral" />
        <StatCard label="Suspended"       value={stats?.suspended ?? 0}    icon={PauseCircle}  tone={(stats?.suspended ?? 0) > 0 ? 'danger' : 'neutral'} />
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm gap-2">
          <Loader2 className="size-4 animate-spin" /> Loading permits…
        </div>
      ) : total === 0 ? (
        <EmptyState onRequest={() => setRequestOpen(true)} />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const permits = col.terminal
              ? col.terminal.flatMap((s) => data?.byStatus[s] ?? [])
              : data?.byStatus[col.id] ?? []
            return (
              <div key={col.id} className="flex w-72 shrink-0 flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-foreground">{col.label}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{permits.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {permits.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      No permits
                    </p>
                  ) : (
                    permits.map((p) => <PermitCard key={p.id} p={p} onClick={() => setSelected(p)} />)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {requestOpen && (
        <RequestDialog
          projectId={projectId}
          onClose={() => setRequestOpen(false)}
          onCreated={() => { setRequestOpen(false); mutate() }}
        />
      )}

      {selected && (
        <DetailDialog
          permit={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { mutate(); setSelected(null) }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, tone }: {
  label: string; value: number; icon: typeof Clock; tone: 'ok' | 'amber' | 'danger' | 'neutral'
}) {
  const toneCls = {
    ok:      'text-emerald-600 dark:text-emerald-400',
    amber:   'text-amber-600 dark:text-amber-400',
    danger:  'text-red-600 dark:text-red-400',
    neutral: 'text-muted-foreground',
  }[tone]
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={cn('size-4', toneCls)} />
      </div>
      <p className={cn('mt-2 text-2xl font-bold', tone === 'danger' && value > 0 ? 'text-red-600 dark:text-red-400' : tone === 'amber' && value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
        {value}
      </p>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Permit card
// ─────────────────────────────────────────────────────────────

function PermitCard({ p, onClick }: { p: WorkPermit; onClick: () => void }) {
  const meta = typeMeta(p.type)
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-primary">{p.permit_no}</span>
        <Icon className={cn('size-4 shrink-0', meta.cls)} aria-hidden />
      </div>
      <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{p.title}</p>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {p.location && (
          <p className="flex items-center gap-1"><MapPin className="size-3" /> <span className="truncate">{p.location}</span></p>
        )}
        <p className="flex items-center gap-1">
          <Clock className="size-3" />
          <span className={cn('truncate', p.expiringSoon && 'text-amber-600 dark:text-amber-400 font-medium')}>
            {fmtDateTime(p.valid_from)} → {fmtDateTime(p.valid_to)}
          </span>
        </p>
        {p.issuer && <p className="flex items-center gap-1"><UserCheck className="size-3" /> {p.issuer}</p>}
      </div>
      {p.expiringSoon && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <Clock className="size-3" /> Expiring soon
        </span>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Detail dialog
// ─────────────────────────────────────────────────────────────

const ISSUER_APP_ROLES = ['hse_manager', 'super_admin', 'tenant_admin', 'project_manager', 'pmo_director']

function DetailDialog({ permit, onClose, onChanged }: {
  permit: WorkPermit; onClose: () => void; onChanged: () => void
}) {
  const { toast } = useToast()
  const session = useSession()
  const [busy, setBusy] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const { data: timeline } = useSWR(`permit-timeline-${permit.id}`, () => getPermitTimeline(permit.id))

  // UI gate for Issue (server enforces too). Empty roles (dev) → allowed.
  const canIssue = session.roles.length === 0 || session.roles.some((r) => ISSUER_APP_ROLES.includes(r))

  const meta = typeMeta(permit.type)
  const Icon = meta.icon
  const status = permit.status

  async function run(fn: () => Promise<{ error?: string }>, okMsg: string) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (res.error) { toast({ title: 'Action failed', description: res.error, variant: 'danger' }); return }
    toast({ title: okMsg, variant: 'success' })
    onChanged()
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <Icon className={cn('size-4', meta.cls)} />
              <span className="font-mono text-sm text-primary">{permit.permit_no}</span>
              <span className="truncate">{permit.title}</span>
            </span>
          </DialogTitle>
          <DialogDescription>
            {meta.label} · <span className={cn('font-medium', statusMeta(status).cls.split(' ').find((c) => c.startsWith('text-')))}>{statusMeta(status).label}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Location" value={permit.location ?? '—'} />
            <Field label="Requested by" value={permit.requested_by ?? '—'} />
            <Field label="Valid from" value={fmtDateTime(permit.valid_from)} />
            <Field label="Valid to" value={fmtDateTime(permit.valid_to)} valueCls={permit.expiringSoon ? 'text-amber-600 dark:text-amber-400 font-medium' : undefined} />
            <Field label="Issuer" value={permit.issuer ?? '—'} />
          </div>

          {permit.description && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Description</p>
              <p className="rounded-md bg-muted/40 p-3 text-sm">{permit.description}</p>
            </div>
          )}

          {permit.suspension_reason && status === 'suspended' && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              <span className="font-medium">Suspended:</span> {permit.suspension_reason}
            </div>
          )}

          {/* Hazards */}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Hazards</p>
            {permit.hazards.length === 0 ? (
              <p className="text-sm text-muted-foreground">None recorded.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {permit.hazards.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1 rounded-full border border-red-300 px-2 py-0.5 text-xs text-red-600 dark:border-red-900/50 dark:text-red-400">
                    <ShieldAlert className="size-3" /> {LABELS[h] ?? h}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Precautions */}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Precautions</p>
            {permit.precautions.length === 0 ? (
              <p className="text-sm text-muted-foreground">None recorded.</p>
            ) : (
              <ul className="space-y-1">
                {permit.precautions.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-3.5 text-emerald-500" /> {LABELS[c] ?? c}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Timeline */}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">History</p>
            {!timeline || timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No status changes yet.</p>
            ) : (
              <ol className="space-y-2 border-l border-border pl-4">
                {timeline.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary" aria-hidden />
                    <p className="text-sm text-foreground">
                      <span className="font-medium capitalize">{e.transition.toLowerCase()}</span>
                      {e.from && <span className="text-muted-foreground"> · {e.from} → {e.to}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDateTime(e.at)}{e.actorName ? ` · ${e.actorName}` : ''}
                    </p>
                    {e.comment && <p className="mt-0.5 text-xs text-muted-foreground italic">{e.comment}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex w-full flex-wrap justify-end gap-2">
            {status === 'requested' && canIssue && (
              <Button onClick={() => run(() => issuePermit(permit.id, ''), 'Permit issued')} disabled={busy}>
                <CheckCircle2 className="size-4 mr-1" /> Issue
              </Button>
            )}
            {status === 'issued' && (
              <Button variant="outline" onClick={() => setSuspendOpen(true)} disabled={busy}>
                <PauseCircle className="size-4 mr-1" /> Suspend
              </Button>
            )}
            {status === 'suspended' && (
              <Button onClick={() => run(() => reinstatePermit(permit.id), 'Permit reinstated')} disabled={busy}>
                <PlayCircle className="size-4 mr-1" /> Reinstate
              </Button>
            )}
            {status !== 'closed' && status !== 'cancelled' && status !== 'expired' && (
              <Button variant="outline" onClick={() => run(() => closePermit(permit.id), 'Permit closed')} disabled={busy}>
                Close
              </Button>
            )}
            {status !== 'closed' && status !== 'cancelled' && status !== 'expired' && (
              <Button variant="ghost" onClick={() => run(() => cancelPermit(permit.id), 'Permit cancelled')} disabled={busy}>
                <Ban className="size-4 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Suspend reason dialog */}
      <Dialog open={suspendOpen} onOpenChange={(o) => { if (!o) setSuspendOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend permit</DialogTitle>
            <DialogDescription>Record the reason for suspending this permit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="suspend-reason">Reason</Label>
            <Textarea
              id="suspend-reason" rows={3} value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Adverse weather — high winds exceed lifting limits"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={busy || !suspendReason.trim()}
              onClick={async () => {
                await run(() => suspendPermit(permit.id, suspendReason.trim()), 'Permit suspended')
                setSuspendOpen(false); setSuspendReason('')
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null} Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

function Field({ label, value, valueCls }: { label: string; value: string; valueCls?: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-sm text-foreground', valueCls)}>{value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Request dialog
// ─────────────────────────────────────────────────────────────

const requestSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  title: z.string().trim().min(1, 'Title is required'),
  location: z.string().optional(),
  description: z.string().optional(),
  requested_by: z.string().optional(),
  valid_from: z.string().optional(),
  valid_to: z.string().optional(),
})
type RequestValues = z.infer<typeof requestSchema>

function RequestDialog({ projectId, onClose, onCreated }: {
  projectId: string; onClose: () => void; onCreated: () => void
}) {
  const { toast } = useToast()
  const [hazards, setHazards] = useState<string[]>([])
  const [precautions, setPrecautions] = useState<string[]>([])
  const [warning, setWarning] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { type: 'general' },
  })

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  async function onSubmit(values: RequestValues) {
    setWarning(null)
    const res = await requestPermit(projectId, {
      type: values.type,
      title: values.title,
      location: values.location || null,
      description: values.description || null,
      hazards,
      precautions,
      requested_by: values.requested_by || null,
      valid_from: values.valid_from ? new Date(values.valid_from).toISOString() : null,
      valid_to: values.valid_to ? new Date(values.valid_to).toISOString() : null,
    })
    if (res.error) { toast({ title: 'Could not request permit', description: res.error, variant: 'danger' }); return }
    if (res.data?.warning) {
      // Surface the conflict inline but keep the permit (it was created as requested).
      setWarning(res.data.warning)
      toast({ title: `${res.data.permit_no} requested with a conflict warning`, variant: 'warning' })
      return
    }
    toast({ title: 'Permit requested', description: `${res.data?.permit_no} created.`, variant: 'success' })
    onCreated()
  }

  const fieldCls = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm'

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request permit to work</DialogTitle>
          <DialogDescription>Raise a permit request for HSE review and issue.</DialogDescription>
        </DialogHeader>

        {warning && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-2">
              <p>{warning}</p>
              <Button size="sm" variant="outline" onClick={onCreated}>Acknowledge &amp; close</Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pt-type">Permit type</Label>
              <select id="pt-type" {...register('type')} className={fieldCls}>
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-by">Requested by</Label>
              <Input id="pt-by" {...register('requested_by')} placeholder="Name / crew lead" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pt-title">Title</Label>
            <Input id="pt-title" {...register('title')} placeholder="e.g. Welding of tower flange — WTG-07" />
            {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pt-loc">Location</Label>
            <Input id="pt-loc" {...register('location')} placeholder="e.g. Array B — WTG-07 base" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pt-desc">Description</Label>
            <Textarea id="pt-desc" rows={2} {...register('description')} placeholder="Scope of work…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pt-from">Valid from</Label>
              <Input id="pt-from" type="datetime-local" {...register('valid_from')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-to">Valid to</Label>
              <Input id="pt-to" type="datetime-local" {...register('valid_to')} />
            </div>
          </div>

          {/* Hazards multi-select */}
          <div className="space-y-1.5">
            <Label>Hazards</Label>
            <div className="flex flex-wrap gap-1.5">
              {HAZARD_OPTIONS.map((h) => {
                const on = hazards.includes(h.value)
                return (
                  <button
                    key={h.value} type="button"
                    onClick={() => toggle(hazards, setHazards, h.value)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      on
                        ? 'border-red-400 bg-red-100 text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-300'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {h.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Precautions multi-select */}
          <div className="space-y-1.5">
            <Label>Precautions</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRECAUTION_OPTIONS.map((c) => {
                const on = precautions.includes(c.value)
                return (
                  <button
                    key={c.value} type="button"
                    onClick={() => toggle(precautions, setPrecautions, c.value)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      on
                        ? 'border-emerald-400 bg-emerald-100 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              Request permit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────

function EmptyState({ onRequest }: { onRequest: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
        <HardHat className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">No permits</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">Request the first permit to work.</p>
      <Button className="mt-4" size="sm" onClick={onRequest}>
        <Plus className="size-4 mr-1.5" /> Request Permit
      </Button>
    </div>
  )
}
