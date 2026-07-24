'use client'

import * as React from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Zap, TrendingUp, Wind, AlertTriangle, Plus, Upload,
  RefreshCw, Loader2, FileText, X, CheckCircle2, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  getEnergyDashboard, logProduction, importProductionCsv,
  type EnergyDashboard, type ProductionRow,
} from '@/app/actions/energy'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt1(n: number): string { return n.toFixed(1) }
function fmtPct(n: number): string { return `${n.toFixed(1)}%` }
function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}
function fmtDateFull(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// P50 colour thresholds
function p50Color(pct: number): { text: string; bg: string; border: string } {
  if (pct >= 100) return { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' }
  if (pct >= 90)  return { text: 'text-amber-700  dark:text-amber-400',  bg: 'bg-amber-50  dark:bg-amber-900/20',  border: 'border-amber-200  dark:border-amber-800'  }
  return              { text: 'text-red-700    dark:text-red-400',    bg: 'bg-red-50    dark:bg-red-900/20',    border: 'border-red-200    dark:border-red-800'    }
}

// Limit history array to last N days
function trimHistory(rows: ProductionRow[], days: number): ProductionRow[] {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  return [...rows].filter(r => r.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, unit, sub, icon: Icon, accent,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
  icon: React.ElementType
  accent?: 'green' | 'amber' | 'red' | 'teal' | 'neutral'
}) {
  const colors: Record<string, string> = {
    green:   'text-emerald-600 dark:text-emerald-400',
    amber:   'text-amber-600   dark:text-amber-400',
    red:     'text-red-600     dark:text-red-400',
    teal:    'text-teal-600    dark:text-teal-400',
    neutral: 'text-foreground',
  }
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-start gap-4">
      <div className="size-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn('text-2xl font-bold tabular-nums leading-tight mt-0.5', colors[accent ?? 'neutral'])}>
          {value}
          {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Live badge ───────────────────────────────────────────────────────────────

function LiveBadge({ live }: { live: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
      live ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
           : 'bg-muted text-muted-foreground',
    )}>
      <span className={cn('size-1.5 rounded-full', live ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground')} />
      {live ? 'Live' : 'Illustrative'}
    </span>
  )
}

// ─── Period selector ──────────────────────────────────────────────────────────

type Period = 30 | 90 | 365

function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
      {([30, 90, 365] as Period[]).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            'px-3 py-1 rounded-md text-xs font-medium transition-colors',
            value === p
              ? 'bg-background text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {p === 365 ? '1Y' : `${p}D`}
        </button>
      ))}
    </div>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ProdTooltip({ active, payload, label }: { active?: boolean; payload?: Record<string, unknown>[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover shadow-md px-3 py-2.5 text-xs">
      <p className="font-semibold text-foreground mb-1.5">{label ? fmtDateFull(label) : ''}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color as string }} className="font-medium">{p.name as string}</span>
          <span className="tabular-nums font-mono text-foreground">{typeof p.value === 'number' ? `${fmt1(p.value)} MWh` : '—'}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Log production dialog ────────────────────────────────────────────────────

const logSchema = z.object({
  date:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  energy_mwh:       z.coerce.number().min(0, 'Must be ≥ 0'),
  availability_pct: z.coerce.number().min(0).max(100).optional(),
  curtailment_mwh:  z.coerce.number().min(0).optional(),
  p50_mwh:          z.coerce.number().min(0).optional(),
  p90_mwh:          z.coerce.number().min(0).optional(),
})
type LogValues = z.infer<typeof logSchema>

function LogProductionDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const { toast } = useToast()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LogValues>({
    resolver: zodResolver(logSchema),
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  })

  async function onSubmit(v: LogValues) {
    const res = await logProduction(projectId, v.date, {
      energy_mwh:       v.energy_mwh,
      availability_pct: v.availability_pct ?? null,
      curtailment_mwh:  v.curtailment_mwh  ?? null,
      p50_mwh:          v.p50_mwh          ?? null,
      p90_mwh:          v.p90_mwh          ?? null,
    })
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Logged', description: `Production for ${v.date} saved.`, variant: 'success' })
    reset()
    onClose()
    globalMutate(`energy-dashboard-${projectId}`)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log production</DialogTitle>
          <DialogDescription>Record daily energy output, availability and curtailment.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="lp-date">Date</Label>
            <Input id="lp-date" type="date" {...register('date')} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lp-mwh">Energy (MWh) <span className="text-destructive">*</span></Label>
              <Input id="lp-mwh" type="number" step="0.01" min="0" {...register('energy_mwh')} placeholder="0.00" />
              {errors.energy_mwh && <p className="text-xs text-destructive">{errors.energy_mwh.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-avail">Availability (%)</Label>
              <Input id="lp-avail" type="number" step="0.1" min="0" max="100" {...register('availability_pct')} placeholder="—" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lp-curt">Curtailment (MWh)</Label>
              <Input id="lp-curt" type="number" step="0.01" min="0" {...register('curtailment_mwh')} placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-p50">P50 target (MWh)</Label>
              <Input id="lp-p50" type="number" step="0.01" min="0" {...register('p50_mwh')} placeholder="—" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lp-p90">P90 target (MWh)</Label>
            <Input id="lp-p90" type="number" step="0.01" min="0" {...register('p90_mwh')} placeholder="—" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Import CSV dialog ────────────────────────────────────────────────────────

interface CsvPreviewRow { date: string; energy_mwh: number; availability_pct: number | null; curtailment_mwh: number | null; valid: boolean; error?: string }

function parseCsvText(text: string): CsvPreviewRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  // Header resolution — accept common aliases
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/["']/g, ''))
  const col = (aliases: string[]): number => {
    for (const a of aliases) { const i = headers.indexOf(a); if (i !== -1) return i }
    return -1
  }
  const iDate  = col(['date'])
  const iMwh   = col(['energy_mwh', 'energy_kwh', 'mwh', 'kwh', 'generation', 'energy'])
  const iAvail = col(['availability_pct', 'availability', 'avail', 'avail_pct'])
  const iCurt  = col(['curtailment_mwh', 'curtailment', 'curt', 'curtailed_mwh'])

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/["']/g, ''))
    const dateRaw = iDate >= 0 ? cols[iDate] : ''
    const mwhRaw  = iMwh  >= 0 ? cols[iMwh]  : ''
    const availRaw = iAvail >= 0 ? cols[iAvail] : null
    const curtRaw  = iCurt  >= 0 ? cols[iCurt]  : null

    // Normalise date → YYYY-MM-DD
    let date = (dateRaw ?? '').replace(/\//g, '-')
    // DD-MM-YYYY → YYYY-MM-DD
    if (/^\d{2}-\d{2}-\d{4}$/.test(date)) {
      const [d, m, y] = date.split('-')
      date = `${y}-${m}-${d}`
    }

    const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && mwhRaw !== '' && !isNaN(Number(mwhRaw))
    const energy_mwh = Number(mwhRaw)

    // kWh → MWh auto-detect: if column name contains 'kwh', divide by 1000
    const isKwh = iMwh >= 0 && headers[iMwh].includes('kwh')

    return {
      date,
      energy_mwh:       isKwh ? energy_mwh / 1000 : energy_mwh,
      availability_pct: availRaw != null && availRaw !== '' ? Number(availRaw) : null,
      curtailment_mwh:  curtRaw  != null && curtRaw  !== '' ? Number(curtRaw)  : null,
      valid,
      error: !valid ? 'Invalid date or energy value' : undefined,
    }
  })
}

function ImportCsvDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const { toast } = useToast()
  const [preview, setPreview] = React.useState<CsvPreviewRow[]>([])
  const [importing, setImporting] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setPreview(parseCsvText(text))
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    const valid = preview.filter(r => r.valid)
    if (!valid.length) { toast({ title: 'No valid rows', description: 'Fix errors before importing.', variant: 'warning' }); return }
    setImporting(true)
    const res = await importProductionCsv(projectId, valid.map(r => ({
      date:             r.date,
      energy_mwh:       r.energy_mwh,
      availability_pct: r.availability_pct,
      curtailment_mwh:  r.curtailment_mwh,
    })))
    setImporting(false)
    if (res.error) { toast({ title: 'Import failed', description: res.error, variant: 'danger' }); return }
    toast({ title: `Imported ${res.imported} rows`, description: res.skipped > 0 ? `${res.skipped} skipped (invalid).` : 'All rows imported.', variant: 'success' })
    setPreview([])
    setFileName(null)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
    globalMutate(`energy-dashboard-${projectId}`)
  }

  function handleClose() {
    setPreview([])
    setFileName(null)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  const validCount   = preview.filter(r => r.valid).length
  const invalidCount = preview.filter(r => !r.valid).length

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import meter CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns: <code className="rounded bg-muted px-1 text-xs">date, energy_mwh, availability_pct, curtailment_mwh</code>.
            kWh columns are auto-converted. DD/MM/YYYY dates are accepted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* File drop area */}
          <div
            className={cn(
              'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition-colors cursor-pointer',
              fileName ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30',
            )}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
            <Upload className="size-8 text-muted-foreground/50 mb-2" aria-hidden />
            {fileName ? (
              <p className="text-sm font-medium text-foreground">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">Click to choose a CSV file</p>
                <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
              </>
            )}
          </div>

          {/* Preview table */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Preview — {preview.length} rows
                  {validCount > 0 && <span className="ml-1.5 text-emerald-600 font-semibold">{validCount} valid</span>}
                  {invalidCount > 0 && <span className="ml-1.5 text-red-600 font-semibold">{invalidCount} invalid</span>}
                </p>
                <button onClick={() => { setPreview([]); setFileName(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <X className="size-3" /> Clear
                </button>
              </div>
              <div className="overflow-auto max-h-52 rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 sticky top-0">
                      {['Date', 'Energy (MWh)', 'Avail. %', 'Curt. (MWh)', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className={cn('border-t border-border', r.valid ? '' : 'bg-red-50 dark:bg-red-900/10')}>
                        <td className="px-3 py-1.5 font-mono">{r.date}</td>
                        <td className="px-3 py-1.5 tabular-nums">{r.valid ? r.energy_mwh.toFixed(3) : '—'}</td>
                        <td className="px-3 py-1.5 tabular-nums">{r.availability_pct != null ? r.availability_pct.toFixed(1) : '—'}</td>
                        <td className="px-3 py-1.5 tabular-nums">{r.curtailment_mwh  != null ? r.curtailment_mwh.toFixed(3)  : '—'}</td>
                        <td className="px-3 py-1.5">
                          {r.valid
                            ? <CheckCircle2 className="size-3.5 text-emerald-500" aria-label="Valid" />
                            : <span className="text-red-600 text-[11px]">{r.error}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            disabled={validCount === 0 || importing}
            onClick={handleImport}
          >
            {importing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            Import {validCount > 0 ? `${validCount} rows` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Curtailment log table ────────────────────────────────────────────────────

function CurtailmentLog({ rows }: { rows: ProductionRow[] }) {
  const cRows = rows
    .filter(r => (r.curtailment_mwh ?? 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))

  if (!cRows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/10 py-8 text-center">
        <Wind className="size-8 text-muted-foreground/30 mx-auto mb-2" aria-hidden />
        <p className="text-sm text-muted-foreground">No curtailment events in this period.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Curtailed (MWh)</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Generated (MWh)</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">% of day</th>
          </tr>
        </thead>
        <tbody>
          {cRows.map(r => {
            const curt = r.curtailment_mwh ?? 0
            const gen  = r.energy_mwh
            const total = gen + curt
            const pct   = total > 0 ? (curt / total) * 100 : 0
            return (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{fmtDateFull(r.date)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-red-600 dark:text-red-400 font-semibold">
                  {fmt1(curt)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-muted-foreground">{fmt1(gen)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
                    pct >= 10 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
                  )}>
                    {fmtPct(pct)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onLog, onImport }: { onLog: () => void; onImport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 py-20 px-6 text-center">
      <div className="size-14 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mb-5">
        <Zap className="size-7 text-teal-600 dark:text-teal-400" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-foreground">No production data yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Log your first day of output or import a meter CSV to start tracking MWh, yield performance, and curtailment.
      </p>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/70">
        <Info className="size-3 shrink-0" aria-hidden />
        <span>This module becomes the primary performance view after COD (G7 — Commercial Operation).</span>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Button size="sm" onClick={onLog}>
          <Plus className="size-3.5 mr-1.5" aria-hidden />
          Log first day
        </Button>
        <Button size="sm" variant="outline" onClick={onImport}>
          <Upload className="size-3.5 mr-1.5" aria-hidden />
          Import CSV
        </Button>
      </div>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function EnergyDashboard({ projectId }: { projectId: string }) {
  const [period, setPeriod]     = React.useState<Period>(90)
  const [logOpen, setLogOpen]   = React.useState(false)
  const [csvOpen, setCsvOpen]   = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'production' | 'curtailment'>('production')

  const { data, isLoading, mutate } = useSWR<EnergyDashboard>(
    `energy-dashboard-${projectId}`,
    () => getEnergyDashboard(projectId),
  )

  const allRows  = data?.history ?? []
  const kpis     = data?.kpis
  const isLive   = allRows.length > 0
  const trimmed  = trimHistory(allRows, period)

  // Build chart data — always use date-sorted trimmed window
  const chartData = trimmed.map(r => ({
    date:      r.date,
    energy:    r.energy_mwh,
    p50:       r.p50_mwh   ?? undefined,
    p90:       r.p90_mwh   ?? undefined,
  }))

  // P50 colour for the stat card
  const pct50    = kpis?.pct_of_p50 ?? 0
  const p50Theme = p50Color(pct50)

  // X axis tick formatter — show fewer ticks for wider periods
  const tickInterval = period === 30 ? 4 : period === 90 ? 13 : 61
  const xTick = (d: string) => fmtDate(d)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Energy Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Production, yield vs P50/P90, curtailment and availability</p>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge live={isLive} />
          <Button size="sm" variant="ghost" onClick={() => mutate()} disabled={isLoading} aria-label="Refresh">
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} aria-hidden />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)}>
            <Upload className="size-3.5 mr-1.5" aria-hidden />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setLogOpen(true)}>
            <Plus className="size-3.5 mr-1.5" aria-hidden />
            Log production
          </Button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {!isLoading && !isLive && (
        <EmptyState onLog={() => setLogOpen(true)} onImport={() => setCsvOpen(true)} />
      )}

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
          <div className="h-72 rounded-xl bg-muted/40 animate-pulse" />
        </div>
      )}

      {/* ── Main content (only when data present) ── */}
      {isLive && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="MTD production"
              value={fmt1(kpis?.mtd_actual ?? 0)}
              unit="MWh"
              sub={`YTD: ${fmt1(kpis?.ytd_actual ?? 0)} MWh`}
              icon={Zap}
              accent="teal"
            />
            <StatCard
              label="Yield vs P50"
              value={fmtPct(pct50)}
              sub={pct50 >= 100 ? 'Above P50 target' : pct50 >= 90 ? 'Near P50 target' : 'Below P50 — review'}
              icon={TrendingUp}
              accent={pct50 >= 100 ? 'green' : pct50 >= 90 ? 'amber' : 'red'}
            />
            <StatCard
              label="Availability"
              value={fmtPct(kpis?.availability_avg ?? 0)}
              sub="90-day average"
              icon={CheckCircle2}
              accent={(kpis?.availability_avg ?? 0) >= 95 ? 'green' : (kpis?.availability_avg ?? 0) >= 90 ? 'amber' : 'red'}
            />
            <StatCard
              label="Curtailment"
              value={fmt1(kpis?.curtailment_total ?? 0)}
              unit="MWh"
              sub="YTD total lost"
              icon={Wind}
              accent={(kpis?.curtailment_total ?? 0) > 0 ? 'amber' : 'teal'}
            />
          </div>

          {/* Period + tab selectors */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
              {(['production', 'curtailment'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize',
                    activeTab === t
                      ? 'bg-background text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'production' ? 'Production chart' : 'Curtailment log'}
                </button>
              ))}
            </div>
            {activeTab === 'production' && (
              <PeriodSelector value={period} onChange={setPeriod} />
            )}
          </div>

          {/* Production chart */}
          {activeTab === 'production' && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between mb-4 gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Daily production</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last {period} days — P50 and P90 daily targets overlaid
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-teal-500" />Energy (MWh)</span>
                  <span className="flex items-center gap-1.5"><span className="h-px w-4 border-t-2 border-dashed border-slate-400 inline-block" />P50</span>
                  <span className="flex items-center gap-1.5"><span className="h-px w-4 border-t-2 border-dotted border-slate-300 inline-block" />P90</span>
                </div>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={xTick}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      interval={tickInterval}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => `${v}`}
                      width={36}
                    />
                    <Tooltip content={<ProdTooltip />} />
                    <Bar
                      dataKey="energy" name="Energy" fill="#14b8a6"
                      radius={[2, 2, 0, 0]} maxBarSize={24}
                    />
                    <Line
                      dataKey="p50" name="P50" type="monotone"
                      stroke="#94a3b8" strokeWidth={1.5}
                      strokeDasharray="5 4" dot={false} connectNulls
                    />
                    <Line
                      dataKey="p90" name="P90" type="monotone"
                      stroke="#cbd5e1" strokeWidth={1.5}
                      strokeDasharray="2 3" dot={false} connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                  No data in the last {period} days.
                </div>
              )}
            </div>
          )}

          {/* Curtailment log */}
          {activeTab === 'curtailment' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">Curtailment events</p>
                <p className="text-xs text-muted-foreground">Days with curtailment_mwh &gt; 0 from all history</p>
              </div>
              <CurtailmentLog rows={allRows} />
            </div>
          )}

          {/* P50 / P90 summary strip */}
          {(kpis?.p50_total ?? 0) > 0 && (
            <div className={cn('rounded-xl border px-5 py-4 flex items-start gap-3', p50Theme.bg, p50Theme.border)}>
              <TrendingUp className={cn('size-5 shrink-0 mt-0.5', p50Theme.text)} aria-hidden />
              <div>
                <p className={cn('text-sm font-semibold', p50Theme.text)}>
                  YTD yield: {fmtPct(pct50)} of P50 target
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Actual {fmt1(kpis?.ytd_actual ?? 0)} MWh
                  &nbsp;·&nbsp; P50 target {fmt1(kpis?.p50_total ?? 0)} MWh
                  &nbsp;·&nbsp; P90 floor {fmt1(kpis?.p90_total ?? 0)} MWh
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <LogProductionDialog  open={logOpen} onClose={() => setLogOpen(false)} projectId={projectId} />
      <ImportCsvDialog      open={csvOpen} onClose={() => setCsvOpen(false)} projectId={projectId} />
    </div>
  )
}
