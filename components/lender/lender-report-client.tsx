'use client'

import { useState, useMemo, useCallback } from 'react'
import useSWR from 'swr'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  FileText, Save, Printer, Archive, Loader2, RefreshCw, ArrowLeft, X,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatUsd, formatUsdCompact, formatDate } from '@/lib/variation-orders/ui'
import {
  getLenderReportData,
  saveLenderReport,
  listLenderReports,
  getLenderReportSnapshot,
  type LenderReportData,
  type LenderReportListItem,
} from '@/app/actions/lender'

// ─── Date helpers ────────────────────────────────────────────────────────────
function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
const todayIso = () => new Date().toISOString().slice(0, 10)

// ─── Small presentational helpers ──────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="print-avoid-break rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  )
}

function SectionHeading({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 border-b-2 border-neutral-900 pb-1 text-lg font-semibold text-neutral-900">
      <span className="text-sm font-bold text-neutral-400">{String(n).padStart(2, '0')}</span>
      {title}
    </h2>
  )
}

function statusTint(status: string): string {
  const s = status.toLowerCase()
  if (['approved', 'paid', 'completed', 'certified', 'closed'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (['submitted', 'invoiced', 'in_progress', 'in_review', 'pending'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (['rejected', 'overdue', 'withdrawn'].includes(s)) return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-neutral-100 text-neutral-600 border-neutral-200'
}

function Pill({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusTint(status)}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// Table primitives tuned for print.
function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      data-numeric={numeric ? '' : undefined}
      className={`border-b border-neutral-300 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 ${numeric ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  )
}
function Td({ children, numeric, className = '' }: { children?: React.ReactNode; numeric?: boolean; className?: string }) {
  return (
    <td
      data-numeric={numeric ? '' : undefined}
      className={`border-b border-neutral-100 px-2 py-1.5 text-xs text-neutral-800 ${numeric ? 'text-right tabular-nums' : 'text-left'} ${className}`}
    >
      {children}
    </td>
  )
}

// EVM metric captions (plain-language, one line each).
const EVM_CAPTIONS: Record<string, string> = {
  PV: 'Planned Value — budgeted cost of work scheduled to date.',
  EV: 'Earned Value — budgeted cost of work actually completed.',
  AC: 'Actual Cost — cost incurred for the work completed.',
  SPI: 'Schedule Performance Index — >1 ahead of schedule, <1 behind.',
  CPI: 'Cost Performance Index — >1 under budget, <1 over budget.',
  BAC: 'Budget at Completion — total approved budget incl. approved variations.',
  EAC: 'Estimate at Completion — forecast total cost (BAC ÷ CPI).',
  VAC: 'Variance at Completion — forecast over/(under) run (BAC − EAC).',
}

export function LenderReportClient({ projectId }: { projectId: string }) {
  const { toast } = useToast()

  const [start, setStart] = useState(isoDaysAgo(90))
  const [end, setEnd] = useState(todayIso())
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [snapshot, setSnapshot] = useState<LenderReportData | null>(null)

  // Live report — only fetched once the user clicks "Generate report".
  const { data: liveData, isLoading, mutate } = useSWR(
    generatedKey,
    () => getLenderReportData(projectId, start, end),
    { revalidateOnFocus: false },
  )

  // Archived reports list.
  const { data: archived } = useSWR<LenderReportListItem[]>(
    ['lender-archive', projectId],
    () => listLenderReports(projectId),
  )

  // A loaded snapshot takes precedence over the live query.
  const data = snapshot ?? liveData

  const handleGenerate = useCallback(() => {
    setSnapshot(null)
    const key = `lender:${projectId}:${start}:${end}`
    if (key === generatedKey) mutate()
    else setGeneratedKey(key)
  }, [projectId, start, end, generatedKey, mutate])

  const handleSave = useCallback(async () => {
    if (!data) return
    setSaving(true)
    const title = `Lender Progress Report — ${formatDate(end)}`
    const res = await saveLenderReport(projectId, start, end, title)
    setSaving(false)
    if (res.error) toast({ title: 'Could not save snapshot', description: res.error, variant: 'danger' })
    else toast({ title: 'Snapshot saved', description: 'The report has been archived.', variant: 'success' })
  }, [data, projectId, start, end, toast])

  const handlePrint = useCallback(() => {
    if (typeof window === 'undefined') return
    document.body.classList.add('printing-lender-report')
    const cleanup = () => {
      document.body.classList.remove('printing-lender-report')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }, [])

  const loadSnapshot = useCallback(async (id: string) => {
    const snap = await getLenderReportSnapshot(id)
    if (snap) {
      setSnapshot(snap)
      setShowArchive(false)
    } else {
      toast({ title: 'Snapshot unavailable', variant: 'danger' })
    }
  }, [toast])

  // Auto-composed executive narrative (factual, data-interpolated).
  const narrative = useMemo(() => {
    if (!data) return []
    const b: string[] = []
    b.push(`Overall completion reached ${data.progress.overallPct}% by the end of the reporting period, with ${data.progress.completedActivities} of ${data.progress.totalActivities} scheduled activities complete.`)
    if (data.progress.completedInPeriod.length > 0)
      b.push(`${data.progress.completedInPeriod.length} activit${data.progress.completedInPeriod.length === 1 ? 'y was' : 'ies were'} completed during the period; ${data.progress.lookAhead30d.length} are scheduled to start within the next 30 days.`)
    b.push(`The project is currently at gate ${data.gates.currentGate}, having secured approval through ${data.gates.approvedThrough} of ${data.gates.totalGates} stage gates.`)
    b.push(`Cost performance (CPI) is ${data.cost.cpi.toFixed(2)} and schedule performance (SPI) is ${data.cost.spi.toFixed(2)}, with a forecast cost at completion of ${formatUsdCompact(data.cost.eac)} against a ${formatUsdCompact(data.cost.bac)} budget${data.cost.vac < 0 ? ` (a projected overrun of ${formatUsdCompact(Math.abs(data.cost.vac))})` : ` (a projected saving of ${formatUsdCompact(data.cost.vac)})`}.`)
    if (data.variations.totalCount > 0)
      b.push(`${data.variations.byStatus.find(s => s.name === 'approved')?.value ?? 0} variation order(s) have been approved totaling ${formatUsdCompact(data.variations.approvedValue)}, with ${formatUsdCompact(data.variations.pendingValue)} pending.`)
    b.push(`Health & safety: ${data.hse.openIncidents} open incident(s), ${data.hse.activePermits} active permit(s), and ${data.hse.incidentsInPeriod} incident(s) recorded in the period.`)
    return b
  }, [data])

  const runningTitle = data ? `GridMind Capital — Lender Progress Report — ${data.project.name}` : 'GridMind Capital — Lender Progress Report'

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* ── Running header/footer (print-only, fixed on every page) ── */}
      <div className="print-running-header">{runningTitle}</div>
      <div className="print-running-footer">
        {`Page generated ${formatDate(todayIso())} — CONFIDENTIAL`}
      </div>

      {/* ── Controls bar (screen only) ── */}
      <div className="print:hidden sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] flex-wrap items-end gap-3 px-4 py-3">
          <Link
            href={`/projects/${projectId}`}
            className="mr-1 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
          >
            <ArrowLeft className="size-4" /> Project
          </Link>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-neutral-500">Period start</label>
            <input
              type="date" value={start} onChange={(e) => setStart(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-neutral-500">Period end</label>
            <input
              type="date" value={end} onChange={(e) => setEnd(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </div>
          <Button size="sm" onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Generate report
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave} disabled={!data || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save snapshot
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} disabled={!data}>
            <Printer className="size-4" /> Export PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowArchive((v) => !v)}>
            <Archive className="size-4" /> Archived ({archived?.length ?? 0})
          </Button>
        </div>

        {/* Archived reports drawer */}
        {showArchive && (
          <div className="mx-auto max-w-[900px] px-4 pb-3">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Archived snapshots</span>
                <button onClick={() => setShowArchive(false)} className="text-neutral-400 hover:text-neutral-700">
                  <X className="size-4" />
                </button>
              </div>
              {(archived?.length ?? 0) === 0 ? (
                <p className="text-xs text-neutral-500">No snapshots saved yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-neutral-200">
                  {archived!.map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-1.5">
                      <div>
                        <div className="text-sm text-neutral-800">{r.title}</div>
                        <div className="text-[11px] text-neutral-500">Saved {formatDate(r.created_at)}</div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => loadSnapshot(r.id)}>Load</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {snapshot && (
          <div className="mx-auto max-w-[900px] px-4 pb-3">
            <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span>Viewing an archived snapshot. Generate a new report to see current data.</span>
              <Button size="sm" variant="ghost" onClick={() => setSnapshot(null)}>Dismiss</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Empty / loading state ── */}
      {!data && (
        <div className="print:hidden mx-auto flex max-w-[800px] flex-col items-center justify-center gap-3 py-24 text-center">
          <FileText className="size-10 text-neutral-300" />
          <h1 className="text-lg font-semibold text-neutral-700">Lender Progress Report</h1>
          <p className="max-w-sm text-sm text-neutral-500">
            Choose a reporting period and click <strong>Generate report</strong> to compile the
            lender progress report from live project data.
          </p>
          {isLoading && <Loader2 className="size-5 animate-spin text-neutral-400" />}
        </div>
      )}

      {/* ── Report document ── */}
      {data && (
        <div
          id="lender-report-printable"
          className="mx-auto my-6 max-w-[800px] bg-white px-12 py-10 font-sans text-neutral-900 shadow-sm print:my-0 print:shadow-none"
        >
          {/* ===== SECTION 1 — COVER ===== */}
          <section className="print-break-after flex min-h-[70vh] flex-col justify-between print:min-h-screen">
            <div>
              <div className="text-sm font-bold uppercase tracking-[0.3em] text-neutral-900">GridMind Capital</div>
              <div className="mt-1 h-0.5 w-16 bg-neutral-900" />
            </div>

            <div className="py-12">
              <div className="text-xs font-medium uppercase tracking-widest text-neutral-400">Confidential</div>
              <h1 className="mt-3 text-4xl font-bold leading-tight text-neutral-900 text-balance">
                Lender Progress Report
              </h1>
              <p className="mt-4 text-lg text-neutral-600">{data.project.name}</p>

              <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <CoverField label="Project code" value={data.project.code} />
                <CoverField label="Technology" value={data.project.technology ?? '—'} />
                <CoverField label="Capacity" value={data.project.capacity_mw ? `${data.project.capacity_mw} MW` : '—'} />
                <CoverField label="Location" value={[data.project.location, data.project.country].filter(Boolean).join(', ') || '—'} />
                <CoverField label="Reporting period" value={`${formatDate(data.period.start)} — ${formatDate(data.period.end)}`} />
                <CoverField label="Generated" value={formatDate(data.generatedAt)} />
                <CoverField label="Lender" value={data.facility?.lender_name || 'Not on file'} />
                <CoverField label="Facility" value={data.facility ? formatUsdCompact(data.facility.facility_amount) : '—'} />
              </dl>
            </div>

            <div className="border-t border-neutral-200 pt-4 text-[11px] text-neutral-400">
              This document contains confidential information prepared for the named lender and its advisors.
              Distribution is restricted.
            </div>
          </section>

          {/* ===== SECTION 2 — EXECUTIVE SUMMARY ===== */}
          <section className="print-break-after pt-2">
            <SectionHeading n={2} title="Executive Summary" />
            <div className="grid grid-cols-4 gap-3">
              <KpiCard label="Overall progress" value={`${data.progress.overallPct}%`} sub={`${data.progress.completedActivities}/${data.progress.totalActivities} activities`} />
              <KpiCard label="Schedule (SPI)" value={data.cost.spi.toFixed(2)} sub={data.cost.spi >= 1 ? 'On/ahead of schedule' : 'Behind schedule'} />
              <KpiCard label="Cost (CPI)" value={data.cost.cpi.toFixed(2)} sub={data.cost.cpi >= 1 ? 'On/under budget' : 'Over budget'} />
              <KpiCard label="Open incidents" value={String(data.hse.openIncidents)} sub={`${data.hse.activePermits} active permits`} />
            </div>

            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">Period narrative</h3>
              <ul className="flex flex-col gap-2">
                {narrative.map((line, i) => (
                  <li key={i} className="print-avoid-break flex gap-2 text-sm leading-relaxed text-neutral-800">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-neutral-900" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ===== SECTION 3 — SCHEDULE & PROGRESS ===== */}
          <section className="print-break-after pt-2">
            <SectionHeading n={3} title="Schedule & Progress" />

            <div className="print-avoid-break mb-6">
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">Progress S-curve (planned vs actual)</h3>
              {data.progress.sCurve.length > 0 ? (
                <div className="w-full" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.progress.sCurve} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#666' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#666' }} unit="%" domain={[0, 100]} />
                      <Tooltip formatter={(v) => (v == null ? '—' : `${v}%`)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="planned" name="Planned" stroke="#0a192f" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="actual" name="Actual" stroke="#0891b2" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-neutral-500">No schedule curve data available for this project.</p>
              )}
            </div>

            <div className="print-avoid-break mb-6">
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">Stage gates</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Gate</Th><Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: data.gates.totalGates }, (_, i) => {
                    const gate = `G${i}`
                    const isDone = data.gates.completedGates.includes(gate) || i <= data.gates.approvedThrough
                    const isCurrent = gate === data.gates.currentGate
                    return (
                      <tr key={gate}>
                        <Td>{gate}</Td>
                        <Td><Pill status={isCurrent ? 'in_progress' : isDone ? 'approved' : 'pending'} /></Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="print-avoid-break">
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">30-day look-ahead</h3>
              {data.progress.lookAhead30d.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr><Th>Activity</Th><Th>Start</Th><Th>Finish</Th></tr>
                  </thead>
                  <tbody>
                    {data.progress.lookAhead30d.slice(0, 15).map((a, i) => (
                      <tr key={i}>
                        <Td>{a.name}</Td>
                        <Td>{formatDate(a.start)}</Td>
                        <Td>{formatDate(a.finish)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-neutral-500">No activities scheduled to start in the next 30 days.</p>
              )}
            </div>
          </section>

          {/* ===== SECTION 4 — COST & EVM ===== */}
          <section className="pt-2">
            <SectionHeading n={4} title="Cost & Earned Value" />

            <div className="print-avoid-break mb-6">
              <table className="w-full border-collapse">
                <thead>
                  <tr><Th>Metric</Th><Th numeric>Value</Th><Th>Interpretation</Th></tr>
                </thead>
                <tbody>
                  <EvmRow k="PV" v={formatUsd(data.cost.pv)} />
                  <EvmRow k="EV" v={formatUsd(data.cost.ev)} />
                  <EvmRow k="AC" v={formatUsd(data.cost.ac)} note={data.cost.acSource === 'certificates' ? 'Sourced from payment certificates.' : undefined} />
                  <EvmRow k="SPI" v={data.cost.spi.toFixed(2)} />
                  <EvmRow k="CPI" v={data.cost.cpi.toFixed(2)} />
                  <EvmRow k="BAC" v={formatUsd(data.cost.bac)} note={data.cost.approvedVoCount > 0 ? `Includes ${data.cost.approvedVoCount} approved variation(s).` : undefined} />
                  <EvmRow k="EAC" v={formatUsd(data.cost.eac)} />
                  <EvmRow k="VAC" v={formatUsd(data.cost.vac)} />
                </tbody>
              </table>
            </div>

            <div className="print-avoid-break mb-4">
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">Payment certificates in period</h3>
              {data.payments.certificatesInPeriod.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>Certificate</Th><Th>Period</Th><Th numeric>This period</Th><Th numeric>Net amount</Th><Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.certificatesInPeriod.map((c) => (
                      <tr key={c.pc_number}>
                        <Td>{c.pc_number}</Td>
                        <Td>{`${formatDate(c.period_start)} — ${formatDate(c.period_end)}`}</Td>
                        <Td numeric>{formatUsd(c.this_period)}</Td>
                        <Td numeric>{formatUsd(c.net_amount)}</Td>
                        <Td><Pill status={c.status} /></Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <Td className="font-semibold">Cumulative</Td>
                      <Td>{`Certified ${formatUsdCompact(data.payments.cumulativeCertified)}`}</Td>
                      <Td numeric>{`Paid ${formatUsdCompact(data.payments.cumulativePaid)}`}</Td>
                      <Td numeric>{`Retention ${formatUsdCompact(data.payments.retentionHeld)}`}</Td>
                      <Td />
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p className="text-xs text-neutral-500">No payment certificates issued during the reporting period.</p>
              )}
              <p className="mt-2 text-[11px] text-neutral-500">
                Contract value {formatUsd(data.payments.contractValue)} · Cumulative certified {formatUsd(data.payments.cumulativeCertified)} · Cumulative paid {formatUsd(data.payments.cumulativePaid)} · Retention held {formatUsd(data.payments.retentionHeld)}.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

// ─── Local subcomponents ──────────────────────────────────────────────────────
function CoverField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-neutral-900">{value}</dd>
    </div>
  )
}

function EvmRow({ k, v, note }: { k: keyof typeof EVM_CAPTIONS | string; v: string; note?: string }) {
  return (
    <tr className="print-avoid-break">
      <Td className="font-semibold">{k}</Td>
      <Td numeric>{v}</Td>
      <Td className="text-neutral-500">
        {EVM_CAPTIONS[k as string] ?? ''}
        {note && <span className="text-neutral-700"> {note}</span>}
      </Td>
    </tr>
  )
}
