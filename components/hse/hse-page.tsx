'use client'

import * as React from 'react'
import useSWR from 'swr'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  HardHat,
  Activity,
  ClipboardList,
  XCircle,
  Filter,
  Plus,
  ChevronDown,
  RefreshCw,
  Loader2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getHseDashboard, seedHseDemoData, createHseIncident, createHsePermit } from '@/app/actions/hse'
import type {
  HseIncident,
  HsePermit,
  HseIncidentSeverity,
} from '@/lib/types/action-types'

// ─── Zod schemas ──────────────────────────────────────────────

const incidentSchema = z.object({
  title:       z.string().min(3, 'Title must be at least 3 characters'),
  projectCode: z.string().min(1, 'Project code is required'),
  severity:    z.enum(['fatality', 'ltif', 'mtc', 'near-miss', 'observation']),
  reportedBy:  z.string().min(1, 'Reporter name is required'),
  location:    z.string().min(1, 'Location is required'),
  description: z.string().min(10, 'Provide at least 10 characters'),
})

const permitSchema = z.object({
  type:        z.string().min(1, 'Permit type is required'),
  scope:       z.string().min(5, 'Scope must be at least 5 characters'),
  projectCode: z.string().min(1, 'Project code is required'),
  issuedTo:    z.string().min(1, 'Issued-to name is required'),
  issuedDate:  z.string().min(1, 'Issued date is required'),
  expiryDate:  z.string().min(1, 'Expiry date is required'),
})

type IncidentFormValues = z.infer<typeof incidentSchema>
type PermitFormValues   = z.infer<typeof permitSchema>

// ─── Field primitives ─────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls = 'h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'
const selectCls = `${inputCls} cursor-pointer`

// ─── New Incident dialog ──────────────────────────────────────

function NewIncidentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false)
  const { toast } = useToast()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentSchema),
    defaultValues: { severity: 'observation' },
  })

  async function onSubmit(values: IncidentFormValues) {
    const res = await createHseIncident(values)
    if (res.error) {
      toast({ title: 'Failed to create incident', description: res.error, variant: 'danger' })
      return
    }
    toast({ title: 'Incident reported', variant: 'success' })
    reset()
    setOpen(false)
    onCreated()
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" aria-hidden />
        Report Incident
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report new incident"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">Report Incident</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close dialog" className="text-muted-foreground hover:text-foreground">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
              <Field label="Title" error={errors.title?.message}>
                <input {...register('title')} placeholder="Brief description of the incident" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Project Code" error={errors.projectCode?.message}>
                  <input {...register('projectCode')} placeholder="SRS-400" className={inputCls} />
                </Field>
                <Field label="Severity" error={errors.severity?.message}>
                  <select {...register('severity')} className={selectCls}>
                    <option value="observation">Observation</option>
                    <option value="near-miss">Near-Miss</option>
                    <option value="mtc">MTC</option>
                    <option value="ltif">LTIF</option>
                    <option value="fatality">Fatality</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Reported By" error={errors.reportedBy?.message}>
                  <input {...register('reportedBy')} placeholder="Name of reporter" className={inputCls} />
                </Field>
                <Field label="Location" error={errors.location?.message}>
                  <input {...register('location')} placeholder="Zone / area" className={inputCls} />
                </Field>
              </div>
              <Field label="Description" error={errors.description?.message}>
                <textarea {...register('description')} rows={3} placeholder="What happened? What was the root cause?" className={`${inputCls} h-auto py-2`} />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Submit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── New Permit dialog ────────────────────────────────────────

const PERMIT_TYPE_OPTIONS = [
  'Work at Height', 'Confined Space', 'Hot Work',
  'Electrical Isolation', 'Excavation', 'Marine Operations', 'General',
]

function NewPermitDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false)
  const { toast } = useToast()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PermitFormValues>({
    resolver: zodResolver(permitSchema),
    defaultValues: { type: 'General' },
  })

  async function onSubmit(values: PermitFormValues) {
    const res = await createHsePermit(values)
    if (res.error) {
      toast({ title: 'Failed to create permit', description: res.error, variant: 'danger' })
      return
    }
    toast({ title: 'Permit to work created', variant: 'success' })
    reset()
    setOpen(false)
    onCreated()
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" aria-hidden />
        New Permit
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New permit to work"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">New Permit to Work</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close dialog" className="text-muted-foreground hover:text-foreground">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Permit Type" error={errors.type?.message}>
                  <select {...register('type')} className={selectCls}>
                    {PERMIT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Project Code" error={errors.projectCode?.message}>
                  <input {...register('projectCode')} placeholder="SRS-400" className={inputCls} />
                </Field>
              </div>
              <Field label="Scope" error={errors.scope?.message}>
                <input {...register('scope')} placeholder="Brief description of work scope" className={inputCls} />
              </Field>
              <Field label="Issued To" error={errors.issuedTo?.message}>
                <input {...register('issuedTo')} placeholder="Responsible person / crew" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Issued Date" error={errors.issuedDate?.message}>
                  <input type="date" {...register('issuedDate')} className={inputCls} />
                </Field>
                <Field label="Expiry Date" error={errors.expiryDate?.message}>
                  <input type="date" {...register('expiryDate')} className={inputCls} />
                </Field>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Create Permit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Config maps ──────────────────────────────────────────────

const SEVERITY_META: Record<HseIncidentSeverity, { label: string; color: string; icon: React.ElementType }> = {
  fatality:    { label: 'Fatality',    color: '#1e1e2e', icon: AlertOctagon  },
  ltif:        { label: 'LTIF',        color: '#ef4444', icon: AlertOctagon  },
  mtc:         { label: 'MTC',         color: '#f97316', icon: AlertTriangle },
  'near-miss': { label: 'Near-Miss',   color: '#f59e0b', icon: AlertTriangle },
  observation: { label: 'Observation', color: '#3b82f6', icon: Activity      },
}

const PERMIT_STATUS_META: Record<HsePermit['status'], { label: string; color: string }> = {
  active:    { label: 'Active',     color: '#22c55e' },
  expired:   { label: 'Expired',    color: '#ef4444' },
  cancelled: { label: 'Cancelled',  color: '#94a3b8' },
  pending:   { label: 'Pending',    color: '#f59e0b' },
}

// ─── Incident Row (expandable) ────────────────────────────────

function IncidentRow({ item }: { item: HseIncident }) {
  const [open, setOpen] = React.useState(false)
  const meta = SEVERITY_META[item.severity]
  const Icon = meta.icon
  const actionPct = item.actionCount > 0 ? Math.round((item.closedActions / item.actionCount) * 100) : 100

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: `${meta.color}18` }}>
          <Icon className="size-4" style={{ color: meta.color }} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-mono text-xs text-[#64ffda]">{item.ref}</span>
            <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="font-mono text-[#64ffda]/80">{item.projectCode}</span>
            <span>{item.date}</span>
            <span>{item.location}</span>
            <span>by {item.reportedBy}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded"
            style={{ color: meta.color, backgroundColor: `${meta.color}18` }}>
            {meta.label}
          </span>
          <span className={cn(
            'text-[11px] font-medium px-2 py-0.5 rounded',
            item.status === 'closed'               ? 'bg-[#22c55e]/10 text-[#22c55e]' :
            item.status === 'under-investigation'   ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                                                     'bg-[#ef4444]/10 text-[#ef4444]',
          )}>
            {item.status === 'under-investigation' ? 'Investigating' : item.status === 'closed' ? 'Closed' : 'Open'}
          </span>
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 bg-muted/10 border-t border-border/50 space-y-3">
          <p className="text-sm text-muted-foreground">{item.description}</p>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Corrective actions: {item.closedActions}/{item.actionCount} closed</span>
              <span className="text-xs font-semibold text-foreground">{actionPct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full">
              <div className="h-1.5 rounded-full bg-[#22c55e] transition-all" style={{ width: `${actionPct}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────

function StatTile({ value, label, color, icon: Icon }: {
  value: number | string; label: string; color: string; icon: React.ElementType
}) {
  return (
    <div className="flex-1 min-w-[130px] rounded-xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="size-4" style={{ color }} aria-hidden />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function HsePage() {
  const { toast: addToast } = useToast()
  const [tab, setTab] = React.useState<'incidents' | 'permits'>('incidents')
  const [severityFilter, setSeverityFilter] = React.useState<HseIncidentSeverity | 'all'>('all')
  const [seeding, setSeeding] = React.useState(false)

  const { data, isLoading, mutate } = useSWR('hse-dashboard', () => getHseDashboard(), {
    revalidateOnFocus: true,
  })

  const incidents: HseIncident[] = data?.incidents ?? []
  const permits: HsePermit[]     = data?.permits ?? []

  const openIncidents     = incidents.filter((i) => i.status !== 'closed').length
  const nearMissCount     = incidents.filter((i) => i.severity === 'near-miss').length
  const observationCount  = incidents.filter((i) => i.severity === 'observation').length
  const activePermits     = permits.filter((p) => p.status === 'active').length
  const expiredPermits    = permits.filter((p) => p.status === 'expired').length

  const filteredIncidents = incidents.filter((i) =>
    severityFilter === 'all' || i.severity === severityFilter
  )

  async function handleSeed() {
    setSeeding(true)
    const { error } = await seedHseDemoData()
    setSeeding(false)
    if (error) { addToast({ title: 'Seed failed', description: error, variant: 'danger' }); return }
    addToast({ title: 'Demo data seeded', variant: 'success' })
    mutate()
  }

  const TABS = [
    { id: 'incidents' as const, label: `Incidents (${incidents.length})` },
    { id: 'permits'   as const, label: `Permits (${permits.length})`    },
  ]

  const SEVERITY_FILTERS: { id: HseIncidentSeverity | 'all'; label: string }[] = [
    { id: 'all',        label: 'All' },
    { id: 'near-miss',  label: 'Near-Miss' },
    { id: 'mtc',        label: 'MTC' },
    { id: 'observation',label: 'Observation' },
    { id: 'ltif',       label: 'LTIF' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Health, Safety & Environment</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Incident register, permits to work, and safety performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh"><RefreshCw className="size-3.5" aria-hidden /></Button>
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : 'Seed Demo'}
          </Button>
          <NewPermitDialog onCreated={() => mutate()} />
          <NewIncidentDialog onCreated={() => mutate()} />
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3" role="region" aria-label="HSE statistics">
        <StatTile value={0}              label="LTIF Rate"      color="#22c55e" icon={ShieldCheck}    />
        <StatTile value={openIncidents}  label="Open Incidents" color={openIncidents > 0 ? '#ef4444' : '#22c55e'} icon={AlertTriangle} />
        <StatTile value={nearMissCount}  label="Near-Misses"    color="#f59e0b" icon={AlertTriangle}  />
        <StatTile value={observationCount} label="Observations" color="#3b82f6" icon={Activity}       />
        <StatTile value={activePermits}  label="Active Permits" color="#22c55e" icon={ClipboardList}  />
        <StatTile value={expiredPermits} label="Expired PTWs"   color={expiredPermits > 0 ? '#ef4444' : '#22c55e'} icon={XCircle} />
      </div>

      {/* Days without incident banner */}
      <div className="flex items-center gap-4 rounded-xl bg-[#22c55e]/8 border border-[#22c55e]/20 px-5 py-4">
        <div className="size-12 rounded-full bg-[#22c55e]/15 flex items-center justify-center shrink-0">
          <HardHat className="size-6 text-[#22c55e]" aria-hidden />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">47 <span className="text-base font-normal text-muted-foreground">days without a recordable incident</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Last recordable: MTC-07 — 03 Jun 2025 — Orion Wind Farm</p>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-[#64ffda] text-[#64ffda]'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Incidents list */}
      {tab === 'incidents' && (
        <div className="space-y-3">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="size-3.5 text-muted-foreground" aria-hidden />
            {SEVERITY_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSeverityFilter(id)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  severityFilter === id
                    ? 'bg-[#64ffda]/10 border-[#64ffda]/40 text-[#64ffda]'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
                </div>
              ) : incidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <ShieldCheck className="size-12 text-[#22c55e] mb-3" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">No incidents recorded</p>
                  <p className="text-xs text-muted-foreground mt-1">Seed demo data or report an incident to get started.</p>
                </div>
              ) : filteredIncidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <ShieldCheck className="size-12 text-[#22c55e] mb-3" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">No incidents found</p>
                </div>
              ) : (
                filteredIncidents.map((i) => <IncidentRow key={i.id} item={i} />)
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permits table */}
      {tab === 'permits' && (
        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
              </div>
            ) : permits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <ClipboardList className="size-12 text-muted-foreground mb-3" aria-hidden />
                <p className="text-sm font-semibold text-foreground">No permits to work</p>
                <p className="text-xs text-muted-foreground mt-1">Seed demo data to populate the permit register.</p>
              </div>
            ) : (
              <table className="w-full min-w-[680px] text-sm" role="table" aria-label="Permits to work">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Ref</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Scope</th>
                    <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">Issued To</th>
                    <th className="px-4 py-2.5 text-right font-semibold hidden lg:table-cell">Expiry</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((p) => {
                    const pMeta = PERMIT_STATUS_META[p.status]
                    return (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#64ffda]">{p.ref}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-foreground">{p.type}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground max-w-[220px] truncate">{p.scope}</td>
                        <td className="px-4 py-2.5 text-sm text-foreground hidden md:table-cell">{p.issuedTo}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground text-right hidden lg:table-cell">{p.expiryDate}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                            style={{ color: pMeta.color, backgroundColor: `${pMeta.color}18` }}>
                            {pMeta.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
