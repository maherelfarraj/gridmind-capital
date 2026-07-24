'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Users, Truck, Plus, RefreshCw, Loader2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
  getResourceHistogram,
  upsertResourcePlan,
  type ResourceMonth,
  type ResourceHistogram,
} from '@/app/actions/resources'

// ─── Constants ────────────────────────────────────────────────────────────────

// Workforce bar colours: planned = light mint, actual = solid teal
const CLR_WF_PLANNED = '#64ffda'
const CLR_WF_ACTUAL  = '#0d9488'

// Equipment bar colours: planned = sky-blue-100-ish, actual = sky-700
const CLR_EQ_PLANNED = '#bae6fd'
const CLR_EQ_ACTUAL  = '#0284c7'

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipPayload {
  name: string
  value: number | null
  color: string
}

function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs space-y-1 min-w-[148px]">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-medium text-foreground tabular-nums">
            {p.value == null ? '—' : p.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Peak callout row ─────────────────────────────────────────────────────────

function PeakCallout({ data }: { data: ResourceHistogram }) {
  const { peakPlannedWorkforce, peakActualWorkforce, peakPlannedEquipment, peakActualEquipment } = data

  if (!peakPlannedWorkforce && !peakActualWorkforce && !peakPlannedEquipment && !peakActualEquipment) {
    return null
  }

  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 rounded-lg bg-muted/40 px-4 py-2.5 text-[12px] text-muted-foreground border border-border/60">
      <TrendingUp className="size-3.5 shrink-0 self-center text-muted-foreground/60" aria-hidden />
      {peakPlannedWorkforce && (
        <span>
          Peak planned workforce:{' '}
          <span className="font-semibold text-foreground tabular-nums">{peakPlannedWorkforce.value}</span>
          {' '}workers in{' '}
          <span className="font-medium text-foreground">{peakPlannedWorkforce.month}</span>
        </span>
      )}
      {peakActualWorkforce && (
        <span>
          Peak actual workforce:{' '}
          <span className="font-semibold text-foreground tabular-nums">{peakActualWorkforce.value}</span>
          {' '}workers in{' '}
          <span className="font-medium text-foreground">{peakActualWorkforce.month}</span>
        </span>
      )}
      {peakPlannedEquipment && (
        <span>
          Peak planned equipment:{' '}
          <span className="font-semibold text-foreground tabular-nums">{peakPlannedEquipment.value}</span>
          {' '}units in{' '}
          <span className="font-medium text-foreground">{peakPlannedEquipment.month}</span>
        </span>
      )}
      {peakActualEquipment && (
        <span>
          Peak actual equipment:{' '}
          <span className="font-semibold text-foreground tabular-nums">{peakActualEquipment.value}</span>
          {' '}units in{' '}
          <span className="font-medium text-foreground">{peakActualEquipment.month}</span>
        </span>
      )}
    </div>
  )
}

// ─── Set-plan dialog ──────────────────────────────────────────────────────────

interface SetPlanDialogProps {
  open:      boolean
  onClose:   () => void
  projectId: string
  months:    ResourceMonth[]
  onSaved:   () => void
}

function SetPlanDialog({ open, onClose, projectId, months, onSaved }: SetPlanDialogProps) {
  const { toast } = useToast()

  // Default to current month
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [month,     setMonth]     = React.useState(currentMonth)
  const [workforce, setWorkforce] = React.useState('')
  const [equipment, setEquipment] = React.useState('')
  const [saving,    setSaving]    = React.useState(false)

  // Pre-fill from existing plan when month changes
  React.useEffect(() => {
    const existing = months.find((m) => m.month === month)
    if (existing) {
      setWorkforce(existing.plannedWorkforce > 0 ? String(existing.plannedWorkforce) : '')
      setEquipment(existing.plannedEquipment > 0 ? String(existing.plannedEquipment) : '')
    } else {
      setWorkforce('')
      setEquipment('')
    }
  }, [month, months])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const wf = parseInt(workforce, 10)
    const eq = parseInt(equipment, 10)
    if (isNaN(wf) || wf < 0 || isNaN(eq) || eq < 0) {
      toast({ title: 'Invalid input', description: 'Workforce and equipment must be non-negative integers.', variant: 'warning' })
      return
    }
    setSaving(true)
    const res = await upsertResourcePlan(projectId, month, wf, eq)
    setSaving(false)
    if (res.error) {
      toast({ title: 'Save failed', description: res.error, variant: 'danger' })
      return
    }
    toast({ title: 'Plan saved', description: `Resource plan updated for ${month}.`, variant: 'success' })
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set resource plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="plan-month">Month</Label>
            <Input
              id="plan-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-workforce" className="flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden />
                Planned workforce
              </Label>
              <Input
                id="plan-workforce"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 120"
                value={workforce}
                onChange={(e) => setWorkforce(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-equipment" className="flex items-center gap-1.5">
                <Truck className="size-3.5" aria-hidden />
                Planned equipment
              </Label>
              <Input
                id="plan-equipment"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 25"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ResourceHistogramProps {
  projectId: string
}

export function ResourceHistogram({ projectId }: ResourceHistogramProps) {
  const [planOpen, setPlanOpen] = React.useState(false)

  const { data, isLoading, mutate } = useSWR(
    `resource-histogram-${projectId}`,
    () => getResourceHistogram(projectId, 12),
    { revalidateOnFocus: false },
  )

  const hasAnyData = data && (
    data.months.some((m) => m.plannedWorkforce > 0 || m.plannedEquipment > 0 || m.actualWorkforce != null)
  )

  return (
    <>
      <SetPlanDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        projectId={projectId}
        months={data?.months ?? []}
        onSaved={mutate}
      />

      <Card className="rounded-xl border border-border bg-card p-5">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Resources</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Planned vs actual workforce &amp; equipment — rolling 12 months
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh">
              <RefreshCw className="size-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPlanOpen(true)}>
              <Plus className="size-3.5" />
              Set plan
            </Button>
          </div>
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="me-2 size-4 animate-spin" />
            Loading…
          </div>
        ) : !hasAnyData ? (
          <div className="flex h-52 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center">
            <Users className="size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground">No resource data yet.</p>
            <p className="text-xs text-muted-foreground/70">
              Click &ldquo;Set plan&rdquo; to add planned headcounts. Actuals are read from daily field reports.
            </p>
          </div>
        ) : (
          <>
            {/* Workforce chart */}
            <div className="mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Users className="size-3" aria-hidden /> Workforce (headcount)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart
                data={data!.months}
                margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
                barGap={2}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                  formatter={(value: string) => (
                    <span style={{ color: 'var(--muted-foreground)' }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey="plannedWorkforce"
                  name="Planned workforce"
                  fill={CLR_WF_PLANNED}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="actualWorkforce"
                  name="Actual workforce (avg)"
                  fill={CLR_WF_ACTUAL}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={24}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Equipment chart */}
            <div className="mt-4 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Truck className="size-3" aria-hidden /> Equipment (units)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart
                data={data!.months}
                margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
                barGap={2}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                  formatter={(value: string) => (
                    <span style={{ color: 'var(--muted-foreground)' }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey="plannedEquipment"
                  name="Planned equipment"
                  fill={CLR_EQ_PLANNED}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="actualEquipment"
                  name="Actual equipment (avg)"
                  fill={CLR_EQ_ACTUAL}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={24}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Peak callout */}
            <PeakCallout data={data!} />
          </>
        )}
      </Card>
    </>
  )
}
