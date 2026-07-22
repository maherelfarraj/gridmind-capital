'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  RefreshCw, Plus, Download, AlertTriangle, TrendingUp, TrendingDown, Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  loadCostControl, saveCostEntry, addCostPeriod, logCostExport,
  COST_CATEGORIES, type CostCategory, type CostControlData,
} from '@/app/actions/cost-control'

// ─────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────

function fmt(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}
function fmtFull(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
const CATEGORY_LABEL: Record<CostCategory, string> = {
  engineering: 'Engineering',
  procurement: 'Procurement',
  subcontracts: 'Subcontracts',
  construction: 'Construction',
  overhead: 'Overhead',
  contingency: 'Contingency',
}

function nextMonth(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y, m, 1) // m is 1-based → this is next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function defaultNewPeriod(periods: string[]): string {
  if (periods.length) return nextMonth(periods[periods.length - 1])
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────
// Small pieces
// ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : 'text-foreground'
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className={cn('mt-1 text-lg font-bold font-mono', color)}>{value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

export function CostControlDashboard({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const { data, mutate, isLoading } = useSWR<CostControlData>(
    ['cost-control', projectId],
    () => loadCostControl(projectId),
  )

  const [activePeriod, setActivePeriod] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newPeriod, setNewPeriod] = useState('')
  const [busy, setBusy] = useState(false)

  const periods = data?.periods ?? []
  const selected = activePeriod && periods.includes(activePeriod)
    ? activePeriod
    : periods[periods.length - 1] ?? null
  const canEdit = data?.canEdit ?? false
  const s = data?.summary

  // Map of category → entry for the selected period
  const periodEntries = useMemo(() => {
    const map = new Map<CostCategory, { budgeted: number; actual: number }>()
    if (data && selected) {
      for (const c of COST_CATEGORIES) {
        const e = data.entries.find((x) => x.period === selected && x.category === c)
        map.set(c, { budgeted: e?.budgeted_amount ?? 0, actual: e?.actual_amount ?? 0 })
      }
    }
    return map
  }, [data, selected])

  async function handleCellSave(category: CostCategory, field: 'budgeted' | 'actual', raw: string) {
    if (!selected) return
    const current = periodEntries.get(category) ?? { budgeted: 0, actual: 0 }
    const value = Number(raw.replace(/[^0-9.-]/g, ''))
    if (!Number.isFinite(value)) return
    const next = { ...current, [field]: value }
    if (next.budgeted === current.budgeted && next.actual === current.actual) return

    const res = await saveCostEntry({
      projectId,
      period: selected,
      category,
      budgeted_amount: next.budgeted,
      actual_amount: next.actual,
    })
    if (res.error) {
      toast({ title: 'Could not save', description: res.error, variant: 'danger' })
      return
    }
    await mutate()
  }

  async function handleAddMonth() {
    if (!/^\d{4}-\d{2}$/.test(newPeriod)) {
      toast({ title: 'Invalid period', description: 'Use the YYYY-MM format, e.g. 2026-08.', variant: 'danger' })
      return
    }
    setBusy(true)
    const res = await addCostPeriod({ projectId, period: newPeriod })
    setBusy(false)
    if (res.error) {
      toast({ title: 'Could not add month', description: res.error, variant: 'danger' })
      return
    }
    toast({ title: 'Month added', description: `${newPeriod} pre-filled from the budget baseline.` })
    setAddOpen(false)
    setActivePeriod(newPeriod)
    await mutate()
  }

  function handleExport() {
    if (!data) return
    const header = ['Period', 'Category', 'Budgeted', 'Actual', 'Variance']
    const lines = [...data.entries]
      .sort((a, b) => a.period.localeCompare(b.period) || a.category.localeCompare(b.category))
      .map((e) => [
        e.period,
        CATEGORY_LABEL[e.category],
        e.budgeted_amount,
        e.actual_amount,
        e.actual_amount - e.budgeted_amount,
      ].join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cost-control-${data.projectName.replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    // audit log (fire and forget)
    void logCostExport({ projectId, rowCount: data.entries.length })
    toast({ title: 'Exported', description: `${data.entries.length} rows downloaded as CSV.` })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground text-balance">Cost Control</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data?.projectName ?? 'Project'} — budget vs actual, variance & earned-value tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={!data?.entries.length}>
            <Download className="size-3.5 mr-1.5" /> Export CSV
          </Button>
          {canEdit ? (
            <>
              <Button size="sm" onClick={() => { setNewPeriod(defaultNewPeriod(periods)); setAddOpen(true) }}>
                <Plus className="size-3.5 mr-1.5" /> Add month
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>Add a new period</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-period">Period (YYYY-MM)</Label>
                    <Input id="new-period" value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)} placeholder="2026-08" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Budgeted amounts are pre-filled from the {periods.length ? 'most recent period' : 'project capex baseline'}.
                    Actuals start at zero.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddMonth} disabled={busy}>{busy ? 'Adding…' : 'Add month'}</Button>
                </DialogFooter>
              </DialogContent>
              </Dialog>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded-md border border-border">
              <Lock className="size-3" /> Read only
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Margin erosion banner */}
      {s?.marginErosionRisk && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Margin erosion risk</p>
            <p className="text-sm text-amber-700/90">
              Budget consumed ({s.pctBudgetConsumed.toFixed(1)}%) exceeds deliverables complete
              ({s.pctDeliverablesComplete.toFixed(1)}%) by more than 10 points. Spend is outpacing progress.
            </p>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Baseline Budget (capex)" value={fmt(s?.baselineBudget ?? 0)} tone="neutral" />
        <KpiCard label="Approved VO Total" value={fmt(s?.approvedVoTotal ?? 0)} tone="neutral" />
        <KpiCard label="Adjusted Budget" value={fmt(s?.adjustedBudget ?? 0)} tone="neutral" />
        <KpiCard label="Cumulative Actual" value={fmt(s?.cumulativeActual ?? 0)} tone="neutral" />
        <KpiCard
          label="Cumulative Variance"
          value={fmt(s?.cumulativeVariance ?? 0)}
          tone={(s?.cumulativeVariance ?? 0) > 0 ? 'bad' : 'good'}
        />
        <KpiCard
          label="% Budget Consumed"
          value={`${(s?.pctBudgetConsumed ?? 0).toFixed(1)}%`}
          tone={(s?.pctBudgetConsumed ?? 0) > 100 ? 'bad' : 'neutral'}
        />
      </div>

      {/* Earned-value-lite strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProgressBar
          label="Deliverables Complete"
          pct={s?.pctDeliverablesComplete ?? 0}
          hint="Approved phase gates"
          color="#3b82f6"
        />
        <ProgressBar
          label="Budget Consumed"
          pct={s?.pctBudgetConsumed ?? 0}
          hint="Actual ÷ adjusted budget"
          color={s?.marginErosionRisk ? '#f59e0b' : '#22c55e'}
        />
      </div>

      {/* Entry grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Budget vs Actual by Category</h2>
          {periods.length > 0 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="period-select" className="text-xs text-muted-foreground">Period</Label>
              <select
                id="period-select"
                value={selected ?? ''}
                onChange={(e) => setActivePeriod(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {periods.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        {periods.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No cost periods yet. {canEdit ? 'Use “Add month” to create the first period from the budget baseline.' : 'No data has been entered.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Budgeted</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Actual</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Variance</th>
                </tr>
              </thead>
              <tbody>
                {COST_CATEGORIES.map((c) => {
                  const e = periodEntries.get(c) ?? { budgeted: 0, actual: 0 }
                  const variance = e.actual - e.budgeted
                  return (
                    <tr key={c} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium text-foreground">{CATEGORY_LABEL[c]}</td>
                      <td className="px-2 py-1.5 text-right">
                        <EditableAmount value={e.budgeted} disabled={!canEdit} onCommit={(v) => handleCellSave(c, 'budgeted', v)} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <EditableAmount value={e.actual} disabled={!canEdit} onCommit={(v) => handleCellSave(c, 'actual', v)} />
                      </td>
                      <td className={cn('px-4 py-2 text-right font-mono text-sm', variance > 0 ? 'text-red-600' : variance < 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {variance > 0 ? '+' : ''}{fmtFull(variance)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const tb = COST_CATEGORIES.reduce((s2, c) => s2 + (periodEntries.get(c)?.budgeted ?? 0), 0)
                  const ta = COST_CATEGORIES.reduce((s2, c) => s2 + (periodEntries.get(c)?.actual ?? 0), 0)
                  const tv = ta - tb
                  return (
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-4 py-2 text-foreground">Total ({selected})</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtFull(tb)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtFull(ta)}</td>
                      <td className={cn('px-4 py-2 text-right font-mono', tv > 0 ? 'text-red-600' : tv < 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {tv > 0 ? '+' : ''}{fmtFull(tv)}
                      </td>
                    </tr>
                  )
                })()}
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Cumulative budget vs actual chart */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          {(s?.cumulativeVariance ?? 0) > 0
            ? <TrendingUp className="size-4 text-red-600" />
            : <TrendingDown className="size-4 text-emerald-600" />}
          <h2 className="text-sm font-semibold text-foreground">Cumulative Budget vs Actual by Month</h2>
        </div>
        {(data?.chart.length ?? 0) === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Add a month to see the trend.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data!.chart} layout="vertical" margin={{ left: 12, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="period" tick={{ fontSize: 11 }} width={64} />
              <Tooltip formatter={(v) => fmt(v as number)} />
              <Legend />
              <Bar dataKey="budget" name="Cumulative Budget" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="actual" name="Cumulative Actual" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Editable currency cell
// ─────────────────────────────────────────────────────────────

function EditableAmount({
  value, disabled, onCommit,
}: { value: number; disabled: boolean; onCommit: (raw: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)

  if (disabled) {
    return <span className="inline-block px-2 py-1 font-mono text-sm text-foreground">{fmtFull(value)}</span>
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      className="w-32 rounded-md border border-transparent bg-transparent px-2 py-1 text-right font-mono text-sm hover:border-input focus:border-primary focus:outline-none"
      value={draft ?? fmtFull(value)}
      onFocus={() => setDraft(String(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== null) { onCommit(draft); setDraft(null) } }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

function ProgressBar({ label, pct, hint, color }: { label: string; pct: number; hint: string; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="font-mono text-lg font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${clamped}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
