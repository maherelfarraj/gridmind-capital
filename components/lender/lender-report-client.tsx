'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  FileText, Save, Printer, Archive, Loader2, RefreshCw, ArrowLeft, X, Landmark, Settings2, Mail,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useSession } from '@/lib/session-context'
import { formatUsd, formatUsdCompact, formatDate } from '@/lib/variation-orders/ui'
import {
  getLenderReportData,
  saveLenderReport,
  listLenderReports,
  getLenderReportSnapshot,
  sendLenderReportEmail,
  getFacility,
  upsertFacility,
  type LenderReportData,
  type LenderReportListItem,
  type LenderFacility,
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
  const session = useSession()
  const searchParams = useSearchParams()

  // Distribution is limited to leadership + finance (AppRole equivalents of the
  // DB roles finance_manager / project_director / tenant_admin / system_admin).
  const canEmailLender = session.roles.some((r) =>
    ['finance_controller', 'pmo_director', 'tenant_admin', 'super_admin'].includes(r),
  )

  const [start, setStart] = useState(isoDaysAgo(90))
  const [end, setEnd] = useState(todayIso())
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [showFacility, setShowFacility] = useState(false)
  const [snapshot, setSnapshot] = useState<LenderReportData | null>(null)
  const [snapshotId, setSnapshotId] = useState<string | null>(null)
  const [snapshotAsOf, setSnapshotAsOf] = useState<string | null>(null)

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

  // Facility on file (drives the cover + the setup card prominence).
  const { data: facility, mutate: mutateFacility } = useSWR<LenderFacility | null>(
    ['lender-facility', projectId],
    () => getFacility(projectId),
  )

  // A loaded snapshot takes precedence over the live query.
  const data = snapshot ?? liveData

  const handleGenerate = useCallback(() => {
    setSnapshot(null)
    setSnapshotId(null)
    setSnapshotAsOf(null)
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

  const loadSnapshot = useCallback(async (item: LenderReportListItem) => {
    const snap = await getLenderReportSnapshot(item.id)
    if (snap) {
      setSnapshot(snap)
      setSnapshotId(item.id)
      setSnapshotAsOf(item.created_at)
      setShowArchive(false)
    } else {
      toast({ title: 'Snapshot unavailable', variant: 'danger' })
    }
  }, [toast])

  // Deep-link support: /projects/{id}/lender-report?archive={reportId} auto-loads
  // the archived snapshot (used by the "Email to lender" distribution link).
  const archiveParam = searchParams?.get('archive') ?? null
  useEffect(() => {
    if (!archiveParam) return
    let cancelled = false
    ;(async () => {
      const snap = await getLenderReportSnapshot(archiveParam)
      if (cancelled) return
      if (snap) {
        setSnapshot(snap)
        setSnapshotId(archiveParam)
        setSnapshotAsOf(snap.generatedAt)
      } else {
        toast({ title: 'Archived report not found', variant: 'danger' })
      }
    })()
    return () => { cancelled = true }
  }, [archiveParam, toast])

  const handleEmailLender = useCallback(async () => {
    if (!snapshotId) return
    setEmailing(true)
    const res = await sendLenderReportEmail(projectId, snapshotId)
    setEmailing(false)
    if (res.error) toast({ title: 'Could not send email', description: res.error, variant: 'danger' })
    else toast({ title: 'Report emailed to lender', description: res.sentTo ? `Sent to ${res.sentTo}` : undefined, variant: 'success' })
  }, [snapshotId, projectId, toast])

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
          <Button size="sm" variant="ghost" onClick={() => { setShowArchive((v) => !v); setShowFacility(false) }}>
            <Archive className="size-4" /> Archived ({archived?.length ?? 0})
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowFacility((v) => !v); setShowArchive(false) }}>
            <Settings2 className="size-4" /> Facility
          </Button>
        </div>

        {/* Archived reports tab — table of saved snapshots */}
        {showArchive && (
          <div className="mx-auto max-w-[900px] px-4 pb-3">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Archived reports</span>
                <button onClick={() => setShowArchive(false)} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
                  <X className="size-4" />
                </button>
              </div>
              {(archived?.length ?? 0) === 0 ? (
                <p className="text-xs text-neutral-500">No snapshots saved yet. Generate a report and click “Save snapshot”.</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                      <th className="border-b border-neutral-200 px-2 py-1.5 font-semibold">Title</th>
                      <th className="border-b border-neutral-200 px-2 py-1.5 font-semibold">Period end</th>
                      <th className="border-b border-neutral-200 px-2 py-1.5 font-semibold">Generated</th>
                      <th className="border-b border-neutral-200 px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {archived!.map((r) => (
                      <tr key={r.id} className="hover:bg-white">
                        <td className="border-b border-neutral-100 px-2 py-1.5 text-neutral-800">{r.title}</td>
                        <td className="border-b border-neutral-100 px-2 py-1.5 text-neutral-600">{r.period_end ? formatDate(r.period_end) : '—'}</td>
                        <td className="border-b border-neutral-100 px-2 py-1.5 text-neutral-600">{formatDate(r.created_at)}</td>
                        <td className="border-b border-neutral-100 px-2 py-1.5 text-right">
                          <Button size="sm" variant="ghost" onClick={() => loadSnapshot(r)}>View</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Facility setup tab */}
        {showFacility && (
          <div className="mx-auto max-w-[900px] px-4 pb-3">
            <FacilitySettingsCard
              projectId={projectId}
              facility={facility ?? null}
              onSaved={() => { mutateFacility(); setShowFacility(false) }}
            />
          </div>
        )}

        {snapshot && (
          <div className="mx-auto max-w-[900px] px-4 pb-3">
            <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span>Archived snapshot — data as of {snapshotAsOf ? formatDate(snapshotAsOf) : formatDate(snapshot.generatedAt)}. Generate a new report to see current data.</span>
              <div className="flex shrink-0 items-center gap-1">
                {canEmailLender && snapshotId && (
                  <Button size="sm" variant="outline" onClick={handleEmailLender} disabled={emailing}>
                    {emailing ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                    Email to lender
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setSnapshot(null); setSnapshotId(null); setSnapshotAsOf(null) }}>Dismiss</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── No facility on file: prompt setup prominently (screen only) ── */}
      {facility === null && !showFacility && (
        <div className="print:hidden mx-auto mt-4 max-w-[800px] px-4">
          <div className="flex flex-col gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Landmark className="mt-0.5 size-5 shrink-0 text-teal-700" />
              <div>
                <div className="text-sm font-semibold text-teal-900">No lender facility on file</div>
                <p className="text-xs text-teal-700">
                  The report works without it, but adding facility details shows the lender name and facility amount on the cover page.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setShowFacility(true)}>
              <Settings2 className="size-4" /> Set up facility
            </Button>
          </div>
        </div>
      )}

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

            {/* Optional — renders only when a submitted field daily report exists */}
            {data.progress.latestDailyReport && (
              <div className="print-avoid-break mt-6">
                <h3 className="mb-2 text-sm font-semibold text-neutral-700">Latest site daily report</h3>
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <Td>Report date</Td>
                      <Td>{formatDate(data.progress.latestDailyReport.report_date)}</Td>
                    </tr>
                    <tr>
                      <Td>Workforce on site</Td>
                      <Td>{data.progress.latestDailyReport.workforce_count ?? '—'}</Td>
                    </tr>
                    <tr>
                      <Td>Work performed</Td>
                      <Td>{data.progress.latestDailyReport.work_performed?.trim() || '—'}</Td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
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

          {/* ===== SECTION 5 — VARIATIONS & CLAIMS ===== */}
          <section className="print-break-before pt-2">
            <SectionHeading n={5} title="Variations & Claims" />
            <div className="mb-5 grid grid-cols-3 gap-3">
              <KpiCard label="Approved VO impact" value={formatUsdCompact(data.variations.approvedValue)} sub={`${data.variations.byStatus.find((s) => s.name === 'approved')?.value ?? 0} approved`} />
              <KpiCard label="Pending VO impact" value={formatUsdCompact(data.variations.pendingValue)} sub={`${data.variations.byStatus.find((s) => s.name === 'submitted')?.value ?? 0} pending`} />
              <KpiCard label="Approved EOT" value={`${data.variations.approvedEotDays} days`} sub="Schedule impact granted" />
            </div>

            <div className="print-avoid-break mb-6">
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">Variation orders</h3>
              {data.variations.rows.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>VO</Th><Th>Title</Th><Th numeric>Cost impact</Th><Th numeric>Days</Th><Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.variations.rows.map((v) => (
                      <tr key={v.vo_number}>
                        <Td>{v.vo_number}</Td>
                        <Td>{v.title}</Td>
                        <Td numeric>{v.cost_impact == null ? '—' : formatUsd(v.cost_impact)}</Td>
                        <Td numeric>{v.schedule_impact_days ?? '—'}</Td>
                        <Td><Pill status={v.status} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-neutral-500">No variation orders recorded for this project.</p>
              )}
            </div>

            {data.claims.rows.length > 0 && (
              <div className="print-avoid-break">
                <h3 className="mb-2 text-sm font-semibold text-neutral-700">Claims</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>Claim</Th><Th>Title</Th><Th>Type</Th><Th numeric>Amount</Th><Th numeric>EOT days</Th><Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.claims.rows.map((c) => (
                      <tr key={c.claim_number}>
                        <Td>{c.claim_number}</Td>
                        <Td>{c.title}</Td>
                        <Td className="capitalize">{c.type.replace(/_/g, ' ')}</Td>
                        <Td numeric>{formatUsd(c.amount)}</Td>
                        <Td numeric>{c.eot_days}</Td>
                        <Td><Pill status={c.status} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ===== SECTION 6 — HSE ===== */}
          <section className="print-break-before pt-2">
            <SectionHeading n={6} title="Health, Safety & Environment" />
            <div className="mb-4 grid grid-cols-4 gap-3">
              <KpiCard label="Incidents in period" value={String(data.hse.incidentsInPeriod)} sub={data.hse.incidentsBySeverity.map((s) => `${s.count} ${s.severity}`).join(' · ') || 'None recorded'} />
              <KpiCard label="Open incidents" value={String(data.hse.openIncidents)} />
              <KpiCard label="Active permits" value={String(data.hse.activePermits)} />
              <KpiCard label="Permits expiring ≤30d" value={String(data.hse.permitsExpiring30d)} />
            </div>
            <p className="text-sm leading-relaxed text-neutral-800">
              {data.hse.incidentsInPeriod === 0
                ? 'No safety incidents were recorded during the reporting period.'
                : `${data.hse.incidentsInPeriod} incident(s) were recorded during the period.`}{' '}
              {data.hse.openIncidents > 0
                ? `${data.hse.openIncidents} incident(s) remain open.`
                : 'All incidents are closed.'}{' '}
              {data.hse.activePermits} permit(s) are currently active{data.hse.permitsExpiring30d > 0 ? `, of which ${data.hse.permitsExpiring30d} expire within 30 days` : ''}.
            </p>
            <p className="mt-3 text-[11px] italic text-neutral-500">Detailed HSE log available in the platform.</p>
          </section>

          {/* ===== SECTION 7 — QUALITY ===== */}
          <section className="print-break-before pt-2">
            <SectionHeading n={7} title="Quality" />
            <div className="mb-4 grid grid-cols-3 gap-3">
              <KpiCard label="Open punch items" value={String(data.quality.openPunchItems)} />
              <KpiCard label="Open inspections" value={String(data.quality.openInspections)} />
              <KpiCard label="Non-conformances" value={String(data.quality.ncrByStatus.reduce((a, n) => a + n.count, 0))} sub="Across all statuses" />
              {data.quality.itpCompletionPct !== undefined && (
                <KpiCard label="ITP completion" value={`${data.quality.itpCompletionPct}%`} sub={`${data.quality.activePlans ?? 0} active plan${(data.quality.activePlans ?? 0) !== 1 ? 's' : ''}`} />
              )}
            </div>

            {/* Optional ITP + NCR-by-severity block */}
            {data.quality.ncrBySeverity && data.quality.ncrBySeverity.length > 0 && (
              <div className="print-avoid-break mb-4">
                <h3 className="mb-2 text-sm font-semibold text-neutral-700">Open NCRs by severity</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr><Th>Severity</Th><Th numeric>Count</Th></tr>
                  </thead>
                  <tbody>
                    {data.quality.ncrBySeverity.map((n) => (
                      <tr key={n.severity}>
                        <Td>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                            n.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            n.severity === 'major'    ? 'bg-amber-100 text-amber-700' :
                            'bg-neutral-100 text-neutral-600'
                          }`}>{n.severity}</span>
                        </Td>
                        <Td numeric>{n.count}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="print-avoid-break">
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">Non-conformance reports by status</h3>
              {data.quality.ncrByStatus.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr><Th>Status</Th><Th numeric>Count</Th></tr>
                  </thead>
                  <tbody>
                    {data.quality.ncrByStatus.map((n) => (
                      <tr key={n.status}>
                        <Td><Pill status={n.status} /></Td>
                        <Td numeric>{n.count}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-neutral-500">No non-conformance reports raised for this project.</p>
              )}
            </div>
          </section>

          {/* ===== SECTION 8 — RISKS ===== */}
          <section className="print-break-before pt-2">
            <SectionHeading n={8} title="Top Risks" />
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
              <span className="font-medium text-neutral-600">Exposure = probability × impact (1–5 each):</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-red-500" /> High (≥15)</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" /> Medium (8–14)</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> Low (≤7)</span>
            </div>
            {data.risks.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Code</Th><Th>Title</Th><Th>Prob.</Th><Th>Impact</Th><Th>Mitigation</Th><Th>Owner</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.risks.map((r) => (
                    <tr key={r.risk_number} className="print-avoid-break">
                      <Td>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`size-2 shrink-0 rounded-full ${r.exposure >= 15 ? 'bg-red-500' : r.exposure >= 8 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {r.risk_number}
                        </span>
                      </Td>
                      <Td>{r.title}</Td>
                      <Td className="capitalize">{r.probability ?? '—'}</Td>
                      <Td className="capitalize">{r.impact ?? '—'}</Td>
                      <Td className="text-neutral-600">{r.mitigation ?? '—'}</Td>
                      <Td>{r.owner ?? '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-neutral-500">No open risks recorded for this project.</p>
            )}
          </section>

          {/* ===== SIGN-OFF ===== */}
          <section className="print-avoid-break mt-10 border-t-2 border-neutral-900 pt-6">
            <p className="text-sm text-neutral-700">
              Prepared by <span className="font-semibold text-neutral-900">{data.preparedBy ?? 'GridMind Capital'}</span> on {formatDate(data.generatedAt)}.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-10">
              <SignatureLine role="Project Manager" />
              <SignatureLine role="Lender's Engineer" />
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

function SignatureLine({ role }: { role: string }) {
  return (
    <div>
      <div className="h-10 border-b border-neutral-400" />
      <div className="mt-1 text-xs font-medium text-neutral-700">{role}</div>
      <div className="text-[11px] text-neutral-400">Name / Signature / Date</div>
    </div>
  )
}

// ─── Facility setup card (screen only) ─────────────────────────────────────────
const FREQUENCIES = ['monthly', 'quarterly', 'semi-annual', 'annual']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED']

function FacilitySettingsCard({
  projectId,
  facility,
  onSaved,
}: {
  projectId: string
  facility: LenderFacility | null
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [lenderName, setLenderName] = useState(facility?.lender_name ?? '')
  const [amount, setAmount] = useState(facility?.facility_amount ? String(facility.facility_amount) : '')
  const [currency, setCurrency] = useState(facility?.currency ?? 'USD')
  const [frequency, setFrequency] = useState(facility?.reporting_frequency ?? 'quarterly')
  const [email, setEmail] = useState(facility?.contact_email ?? '')
  const [saving, setSaving] = useState(false)

  // Keep the form in sync if the facility loads/changes after mount.
  useEffect(() => {
    setLenderName(facility?.lender_name ?? '')
    setAmount(facility?.facility_amount ? String(facility.facility_amount) : '')
    setCurrency(facility?.currency ?? 'USD')
    setFrequency(facility?.reporting_frequency ?? 'quarterly')
    setEmail(facility?.contact_email ?? '')
  }, [facility])

  const save = useCallback(async () => {
    setSaving(true)
    const res = await upsertFacility(projectId, {
      lender_name: lenderName.trim() || undefined,
      facility_amount: amount ? Number(amount) : undefined,
      currency,
      reporting_frequency: frequency,
      contact_email: email.trim() || undefined,
    })
    setSaving(false)
    if (res.error) toast({ title: 'Could not save facility', description: res.error, variant: 'danger' })
    else {
      toast({ title: 'Facility saved', variant: 'success' })
      onSaved()
    }
  }, [projectId, lenderName, amount, currency, frequency, email, toast, onSaved])

  const field = 'rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900'

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Landmark className="size-4 text-neutral-600" />
        <span className="text-sm font-medium text-neutral-700">Lender facility details</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-500">Lender name</span>
          <input className={field} value={lenderName} onChange={(e) => setLenderName(e.target.value)} placeholder="e.g. Green Infrastructure Bank" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-500">Facility amount</span>
          <input className={field} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250000000" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-500">Currency</span>
          <select className={field} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-500">Reporting frequency</span>
          <select className={field} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[11px] font-medium text-neutral-500">Contact email</span>
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@lender.com" />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save facility
        </Button>
      </div>
    </div>
  )
}
