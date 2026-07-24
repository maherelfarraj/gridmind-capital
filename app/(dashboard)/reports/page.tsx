'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Printer, Download, Calendar, RefreshCw, Landmark, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ReportListSidebar } from '@/components/reports/report-list-sidebar'
import { getProjects }           from '@/app/actions/projects'
import { loadRisksDashboard }    from '@/app/actions/risks'
import { getApprovals }          from '@/app/actions/approvals'
import { loadFinanceEvmDashboard } from '@/app/actions/finance-evm'
import { getGateProgressReport } from '@/app/actions/phase-gates'
import { getVariationOrders }    from '@/app/actions/variation-orders'
import { getClaims }             from '@/app/actions/claims'
import { getTransmittalsRegister } from '@/app/actions/transmittals'
import { getPermitsBoard }       from '@/app/actions/workpermits'
import { getItpDashboard, getNcrRegister } from '@/app/actions/quality'
import type { RiskRecord }       from '@/lib/types/action-types'

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportType = 'project-status' | 'gate-progress' | 'financial-summary' | 'risk-register' | 'approvals-log' | 'variations-register' | 'lender-progress' | 'document-control-log' | 'ptw-log' | 'quality-report'
type DateRange  = '30d' | '90d' | '1y' | 'all'

const REPORT_TYPES: { id: ReportType; label: string; description: string }[] = [
  { id: 'project-status',    label: 'Project Status',     description: 'Portfolio-wide project status, gate and budget overview' },
  { id: 'gate-progress',     label: 'Gate Progress',      description: 'Phase gate status across all active projects' },
  { id: 'financial-summary', label: 'Financial Summary',  description: 'EVM records — budget, actual, EAC, and CPI by period' },
  { id: 'variations-register', label: 'Variations Register', description: 'Variation orders and claims for a project, with cost and time impacts' },
  { id: 'risk-register',     label: 'Risk Register',      description: 'Full risk register with scores, owners and status' },
  { id: 'approvals-log',     label: 'Approvals Log',      description: 'Approval decisions and pending items across all projects' },
  { id: 'lender-progress',   label: 'Lender Progress Report', description: 'Bank-ready progress report per project — compile, save, and export the full lender pack' },
  { id: 'document-control-log', label: 'Document Control Log', description: 'Transmittals for a project with response codes and turnaround days' },
  { id: 'ptw-log',           label: 'PTW Log',            description: 'Permits to work by type and status with validity windows' },
  { id: 'quality-report',   label: 'Quality Report',     description: 'ITP completion, hold point log, and NCR register with aging by project' },
]

const DATE_RANGE_OPTIONS: { id: DateRange; label: string }[] = [
  { id: '30d',  label: 'Last 30 days' },
  { id: '90d',  label: 'Last 90 days' },
  { id: '1y',   label: 'Last year'    },
  { id: 'all',  label: 'All time'     },
]

function cutoff(range: DateRange): Date | null {
  if (range === 'all') return null
  const d = new Date()
  if (range === '30d') d.setDate(d.getDate() - 30)
  if (range === '90d') d.setDate(d.getDate() - 90)
  if (range === '1y')  d.setFullYear(d.getFullYear() - 1)
  return d
}

function withinRange(isoStr: string | null | undefined, from: Date | null): boolean {
  if (!from) return true
  if (!isoStr) return true
  return new Date(isoStr) >= from
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  approved:   'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  pending:    'bg-amber-500/10  text-amber-700  border-amber-500/20',
  rejected:   'bg-red-500/10   text-red-700    border-red-500/20',
  open:       'bg-amber-500/10  text-amber-700  border-amber-500/20',
  closed:     'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  in_progress:'bg-blue-500/10  text-blue-700   border-blue-500/20',
  complete:   'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  not_started:'bg-slate-100    text-slate-500  border-slate-200',
  in_review:  'bg-blue-500/10  text-blue-700   border-blue-500/20',
}

function StatusPill({ value }: { value: string }) {
  const cls = STATUS_COLORS[value.toLowerCase().replace(/ /g,'_')] ?? 'bg-slate-100 text-slate-500 border-slate-200'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', cls)}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

// ─── Table shell ─────────────────────────────────────────────────────────────

function ReportTable({ headers, children, empty }: {
  headers: string[]
  children: React.ReactNode
  empty: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border print:border-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                No records found for the selected date range.
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  )
}

// ─── Individual report views ──────────────────────────────────────────────────

function ProjectStatusReport({ dateRange: _dateRange }: { dateRange: DateRange }) {
  const { data, isLoading } = useSWR('report-projects', () => getProjects())
  const rows  = data ?? []

  if (isLoading) return <LoadingRows cols={5} />
  return (
    <ReportTable
      headers={['Code', 'Name', 'Gate', 'Budget (USD)', 'Status']}
      empty={!rows.length}
    >
      {rows.map((p) => (
        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors print:hover:bg-transparent">
          <td className="px-3 py-2.5 font-mono text-xs font-medium text-foreground">{p.code}</td>
          <td className="px-3 py-2.5 font-medium text-foreground">{p.name}</td>
          <td className="px-3 py-2.5">
            <Badge variant="outline" className="text-[11px] font-mono">{p.gate}</Badge>
          </td>
          <td className="px-3 py-2.5 text-right tabular-nums">
            {p.budget_amount != null ? `$${(p.budget_amount / 1_000_000).toFixed(1)}M` : '—'}
          </td>
          <td className="px-3 py-2.5"><StatusPill value={p.status ?? 'active'} /></td>
        </tr>
      ))}
    </ReportTable>
  )
}

function GateProgressReport({ dateRange }: { dateRange: DateRange }) {
  const { data, isLoading } = useSWR('report-gate-progress', () => getGateProgressReport())
  const from  = cutoff(dateRange)
  const rows  = (data ?? []).filter((r) => withinRange(r.reviewedAt, from))

  if (isLoading) return <LoadingRows cols={6} />
  return (
    <ReportTable
      headers={['Project', 'Code', 'Gate', 'Phase Name', 'Status', 'Reviewed At']}
      empty={!rows.length}
    >
      {rows.map((r, i) => (
        <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors print:hover:bg-transparent">
          <td className="px-3 py-2.5 font-medium text-foreground">{r.projectName}</td>
          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.projectCode}</td>
          <td className="px-3 py-2.5"><Badge variant="outline" className="font-mono text-[11px]">G{r.phaseNumber}</Badge></td>
          <td className="px-3 py-2.5 text-muted-foreground">{r.phaseName}</td>
          <td className="px-3 py-2.5"><StatusPill value={r.status} /></td>
          <td className="px-3 py-2.5 text-muted-foreground text-xs">{r.reviewedAt ? r.reviewedAt.slice(0, 10) : '—'}</td>
        </tr>
      ))}
    </ReportTable>
  )
}

function FinancialSummaryReport({ dateRange }: { dateRange: DateRange }) {
  const { data, isLoading } = useSWR('report-finance-evm', () => loadFinanceEvmDashboard())
  const from  = cutoff(dateRange)
  const rows  = (data?.records ?? []).filter((r) => withinRange(r.period + '-01', from))

  if (isLoading) return <LoadingRows cols={7} />
  return (
    <ReportTable
      headers={['Period', 'Project', 'Budget (BAC)', 'PV', 'EV', 'AC', 'CPI']}
      empty={!rows.length}
    >
      {rows.map((r, i) => {
        const cpi = r.ev && r.ac ? (r.ev / r.ac).toFixed(2) : '—'
        const cpiNum = r.ev && r.ac ? r.ev / r.ac : null
        return (
          <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors print:hover:bg-transparent">
            <td className="px-3 py-2.5 font-mono text-xs text-foreground">{r.period}</td>
            <td className="px-3 py-2.5 text-muted-foreground">{r.project_name ?? '—'}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">${((r.bac ?? 0) / 1e6).toFixed(2)}M</td>
            <td className="px-3 py-2.5 text-right tabular-nums">${((r.pv  ?? 0) / 1e6).toFixed(2)}M</td>
            <td className="px-3 py-2.5 text-right tabular-nums">${((r.ev  ?? 0) / 1e6).toFixed(2)}M</td>
            <td className="px-3 py-2.5 text-right tabular-nums">${((r.ac  ?? 0) / 1e6).toFixed(2)}M</td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              <span className={cn('font-medium', cpiNum != null && cpiNum >= 1 ? 'text-emerald-600' : 'text-red-500')}>
                {cpi}
              </span>
            </td>
          </tr>
        )
      })}
    </ReportTable>
  )
}

const RAG_COLORS: Record<string, string> = {
  red:   'bg-red-500/10 text-red-700 border-red-500/20',
  amber: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  green: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
}

function RiskRegisterReport({ dateRange }: { dateRange: DateRange }) {
  const { data, isLoading } = useSWR('report-risks', () => loadRisksDashboard())
  const from  = cutoff(dateRange)
  const rows: RiskRecord[] = (data?.items ?? []).filter((r) => withinRange(r.created_at, from))

  if (isLoading) return <LoadingRows cols={8} />
  return (
    <ReportTable
      headers={['Code', 'Title', 'Category', 'Probability', 'Impact', 'Score', 'RAG', 'Status']}
      empty={!rows.length}
    >
      {rows.map((r) => (
        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors print:hover:bg-transparent">
          <td className="px-3 py-2.5 font-mono text-xs font-medium text-foreground">{r.code}</td>
          <td className="px-3 py-2.5 font-medium text-foreground max-w-[220px] truncate" title={r.title}>{r.title}</td>
          <td className="px-3 py-2.5 text-muted-foreground">{r.category}</td>
          <td className="px-3 py-2.5 text-center tabular-nums">{r.probability}</td>
          <td className="px-3 py-2.5 text-center tabular-nums">{r.impact}</td>
          <td className="px-3 py-2.5 text-center font-semibold tabular-nums">{r.score}</td>
          <td className="px-3 py-2.5">
            <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase', RAG_COLORS[r.rag])}>
              {r.rag}
            </span>
          </td>
          <td className="px-3 py-2.5"><StatusPill value={r.status} /></td>
        </tr>
      ))}
    </ReportTable>
  )
}

function ApprovalsLogReport({ dateRange }: { dateRange: DateRange }) {
  const { data, isLoading } = useSWR('report-approvals', () => getApprovals())
  const from  = cutoff(dateRange)
  const rows  = (data ?? []).filter((r) => withinRange(r.created_at, from))

  if (isLoading) return <LoadingRows cols={6} />
  return (
    <ReportTable
      headers={['Type', 'Reference', 'Status', 'Priority', 'Approver Role', 'Submitted']}
      empty={!rows.length}
    >
      {rows.map((r) => (
        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors print:hover:bg-transparent">
          <td className="px-3 py-2.5 text-muted-foreground capitalize">{r.object_type?.replace(/_/g, ' ')}</td>
          <td className="px-3 py-2.5 font-mono text-xs font-medium text-foreground">{r.object_code}</td>
          <td className="px-3 py-2.5"><StatusPill value={r.status} /></td>
          <td className="px-3 py-2.5 capitalize text-muted-foreground">{String(r.level ?? '—')}</td>
          <td className="px-3 py-2.5 text-muted-foreground">{r.approver_role}</td>
          <td className="px-3 py-2.5 text-muted-foreground text-xs">
            {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
          </td>
        </tr>
      ))}
    </ReportTable>
  )
}

function usd(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function VariationsRegisterReport({ dateRange }: { dateRange: DateRange }) {
  const { data: projects } = useSWR('report-vo-projects', () => getProjects())
  const [projectId, setProjectId] = React.useState<string | null>(null)

  // Default to the first project once loaded.
  const activeProjectId = projectId ?? projects?.[0]?.id ?? null

  const { data: voData, isLoading: voLoading } = useSWR(
    activeProjectId ? ['report-vo', activeProjectId] : null,
    () => getVariationOrders(activeProjectId!),
  )
  const { data: claimData, isLoading: claimLoading } = useSWR(
    activeProjectId ? ['report-claims', activeProjectId] : null,
    () => getClaims(activeProjectId!),
  )

  const from = cutoff(dateRange)
  const vos    = (voData?.rows ?? []).filter((r) => withinRange(r.created_at, from))
  const claims = (claimData?.rows ?? []).filter((r) => withinRange(r.created_at, from))

  // Unified rows so VOs and claims share one register table.
  type Line = { kind: 'VO' | 'Claim'; ref: string; title: string; status: string; cost: number; days: number }
  const lines: Line[] = [
    ...vos.map((v): Line => ({
      kind: 'VO', ref: v.vo_number, title: v.title, status: v.status,
      cost: v.cost_impact ?? 0, days: v.time_impact_days ?? 0,
    })),
    ...claims.map((c): Line => ({
      kind: 'Claim', ref: c.claim_number, title: c.title, status: c.status,
      cost: c.amount ?? 0, days: c.eot_days ?? 0,
    })),
  ]
  const totalCost = lines.reduce((s, l) => s + l.cost, 0)
  const totalDays = lines.reduce((s, l) => s + l.days, 0)

  const isLoading = voLoading || claimLoading

  return (
    <div className="flex flex-col gap-4">
      {/* Project selector — VOs and claims are per project */}
      <div className="flex items-center gap-2 print:hidden">
        <label className="text-xs font-medium text-muted-foreground">Project</label>
        <select
          value={activeProjectId ?? ''}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingRows cols={5} />
      ) : (
        <ReportTable
          headers={['Type', 'Reference', 'Title', 'Status', 'Cost Impact', 'Time (days)']}
          empty={!lines.length}
        >
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors print:hover:bg-transparent">
              <td className="px-3 py-2.5">
                <Badge variant="outline" className="text-[11px]">{l.kind}</Badge>
              </td>
              <td className="px-3 py-2.5 font-mono text-xs font-medium text-foreground">{l.ref}</td>
              <td className="px-3 py-2.5 font-medium text-foreground max-w-[260px] truncate" title={l.title}>{l.title}</td>
              <td className="px-3 py-2.5"><StatusPill value={l.status} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{usd(l.cost)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{l.days}</td>
            </tr>
          ))}
          {lines.length > 0 && (
            <tr className="border-t-2 border-border bg-muted/40 font-semibold">
              <td className="px-3 py-2.5" colSpan={4}>Total ({lines.length} item{lines.length === 1 ? '' : 's'})</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{usd(totalCost)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{totalDays}</td>
            </tr>
          )}
        </ReportTable>
      )}
    </div>
  )
}

function LenderProgressReport() {
  const { data: projects, isLoading } = useSWR('report-lender-projects', () => getProjects())
  const [projectId, setProjectId] = React.useState<string | null>(null)
  const activeProjectId = projectId ?? projects?.[0]?.id ?? null
  const activeProject = (projects ?? []).find((p) => p.id === activeProjectId) ?? null

  if (isLoading) return <LoadingRows cols={3} />

  if (!projects || projects.length === 0) {
    return (
      <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">
        No projects available to report on.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Project selector — the lender report is compiled per project */}
      <div className="flex items-center gap-2 print:hidden">
        <label className="text-xs font-medium text-muted-foreground">Project</label>
        <select
          value={activeProjectId ?? ''}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Landmark className="size-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Lender Progress Report{activeProject ? ` — ${activeProject.name}` : ''}
            </h3>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Compile the full bank-ready progress report from live project data — executive summary,
              S-curve, EVM cost performance, payments, variations, HSE, risks and quality. Choose a
              reporting period, then save a snapshot or export to PDF on the report page.
            </p>
          </div>
        </div>
        {activeProjectId && (
          <Link
            href={`/projects/${activeProjectId}/lender-report`}
            className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
          >
            Open Lender Report
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Per-project report project picker ─────────────────────────────────────────

function useReportProject() {
  const { data: projects, isLoading } = useSWR('report-perproject-list', () => getProjects())
  const [projectId, setProjectId] = React.useState<string | null>(null)
  const activeProjectId = projectId ?? projects?.[0]?.id ?? null
  return { projects: projects ?? [], isLoading, activeProjectId, setProjectId }
}

function ReportProjectPicker({
  projects, activeProjectId, onChange,
}: {
  projects: { id: string; code: string; name: string }[]
  activeProjectId: string | null
  onChange: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 mb-4 print:hidden">
      <label className="text-xs font-medium text-muted-foreground">Project</label>
      <select
        value={activeProjectId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Document Control Log (transmittals) ────────────────────────────────────────

const RESPONSE_CODE_LABEL: Record<string, string> = {
  A: 'Approved', B: 'As noted', C: 'Revise & resubmit', D: 'Rejected',
}
const RESPONSE_CODE_CLASS: Record<string, string> = {
  A: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  B: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
  C: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  D: 'bg-red-500/10 text-red-700 border-red-500/20',
}

function turnaroundDays(issue: string | null, response: string | null): number | null {
  if (!issue || !response) return null
  const d = Math.round((new Date(response).getTime() - new Date(issue).getTime()) / 86_400_000)
  return d >= 0 ? d : null
}

function DocumentControlLogReport() {
  const { projects, isLoading: projLoading, activeProjectId, setProjectId } = useReportProject()
  const { data, isLoading } = useSWR(
    activeProjectId ? `report-doc-control-${activeProjectId}` : null,
    () => getTransmittalsRegister(activeProjectId as string),
  )

  if (projLoading) return <LoadingRows cols={8} />
  if (projects.length === 0) {
    return <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">No projects available.</div>
  }

  const rows = data?.rows ?? []

  return (
    <div>
      <ReportProjectPicker projects={projects} activeProjectId={activeProjectId} onChange={setProjectId} />
      {isLoading ? <LoadingRows cols={8} /> : (
        <ReportTable
          headers={['Transmittal', 'Dir.', 'Subject', 'To / From', 'Issued', 'Response Due', 'Response Code', 'Turnaround']}
          empty={rows.length === 0}
        >
          {rows.map((t) => {
            const td = turnaroundDays(t.issue_date, t.response_date)
            return (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs text-primary whitespace-nowrap">{t.transmittal_no}</td>
                <td className="px-3 py-2 text-xs capitalize text-muted-foreground">{t.direction}</td>
                <td className="px-3 py-2 max-w-[240px] truncate">{t.subject}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{t.direction === 'outgoing' ? (t.to_party ?? '—') : (t.from_party ?? '—')}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{t.issue_date ? new Date(t.issue_date).toLocaleDateString() : '—'}</td>
                <td className={cn('px-3 py-2 text-xs whitespace-nowrap', t.overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground')}>
                  {t.response_due ? new Date(t.response_due).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2">
                  {t.response_code ? (
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', RESPONSE_CODE_CLASS[t.response_code] ?? '')}>
                      {t.response_code} · {RESPONSE_CODE_LABEL[t.response_code] ?? t.response_code}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{td != null ? `${td} day${td === 1 ? '' : 's'}` : '—'}</td>
              </tr>
            )
          })}
        </ReportTable>
      )}
      {!isLoading && data && (
        <p className="mt-3 text-xs text-muted-foreground">
          {data.stats.issuedThisMonth} issued this month · {data.stats.awaitingResponse} awaiting response · {data.stats.overdue} overdue
          {data.stats.avgResponseDays != null ? ` · avg turnaround ${data.stats.avgResponseDays} days` : ''}
        </p>
      )}
    </div>
  )
}

// ─── PTW Log (work permits) ─────────────────────────────────────────────────────

const PTW_STATUS_CLASS: Record<string, string> = {
  requested: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  issued:    'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  suspended: 'bg-red-500/10 text-red-700 border-red-500/20',
  expired:   'bg-slate-100 text-slate-500 border-slate-200',
  closed:    'bg-slate-100 text-slate-500 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
}

function PtwLogReport() {
  const { projects, isLoading: projLoading, activeProjectId, setProjectId } = useReportProject()
  const { data, isLoading } = useSWR(
    activeProjectId ? `report-ptw-${activeProjectId}` : null,
    () => getPermitsBoard(activeProjectId as string),
  )

  if (projLoading) return <LoadingRows cols={7} />
  if (projects.length === 0) {
    return <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">No projects available.</div>
  }

  const rows = [...(data?.all ?? [])].sort((a, b) => a.type.localeCompare(b.type) || a.status.localeCompare(b.status))

  return (
    <div>
      <ReportProjectPicker projects={projects} activeProjectId={activeProjectId} onChange={setProjectId} />
      {isLoading ? <LoadingRows cols={7} /> : (
        <ReportTable
          headers={['Permit No', 'Type', 'Title', 'Location', 'Status', 'Valid From', 'Valid To']}
          empty={rows.length === 0}
        >
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2 font-mono text-xs text-primary whitespace-nowrap">{p.permit_no}</td>
              <td className="px-3 py-2 text-xs capitalize text-muted-foreground whitespace-nowrap">{p.type.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2 max-w-[220px] truncate">{p.title}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{p.location ?? '—'}</td>
              <td className="px-3 py-2">
                <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', PTW_STATUS_CLASS[p.status] ?? '')}>
                  {p.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{p.valid_from ? new Date(p.valid_from).toLocaleDateString() : '—'}</td>
              <td className={cn('px-3 py-2 text-xs whitespace-nowrap', p.expiringSoon ? 'text-amber-600 font-semibold' : 'text-muted-foreground')}>
                {p.valid_to ? new Date(p.valid_to).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </ReportTable>
      )}
      {!isLoading && data && (
        <p className="mt-3 text-xs text-muted-foreground">
          {data.stats.activeNow} active · {data.stats.expiring48h} expiring in 48h · {data.stats.requested} awaiting issue · {data.stats.suspended} suspended
        </p>
      )}
    </div>
  )
}

// ── Quality: severity colors + aging thresholds ───────────────────────────
const NCR_SEV_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  major:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  minor:    'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
}
const NCR_AGING_COLOR: Record<string, string> = {
  red:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  none:  '',
}

function QualityReport() {
  const { projects, isLoading: projLoading, activeProjectId, setProjectId } = useReportProject()
  const { data: itpData, isLoading: itpLoading } = useSWR(
    activeProjectId ? `report-itp-${activeProjectId}` : null,
    () => getItpDashboard(activeProjectId as string),
  )
  const { data: ncrData, isLoading: ncrLoading } = useSWR(
    activeProjectId ? `report-ncr-${activeProjectId}` : null,
    () => getNcrRegister(activeProjectId as string),
  )

  if (projLoading) return <LoadingRows cols={6} />
  if (projects.length === 0) {
    return <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">No projects available.</div>
  }

  const isLoading = itpLoading || ncrLoading

  // ── ITP plan summary ──────────────────────────────────────────────────────
  const plans = itpData?.plans ?? []
  const kpis  = itpData?.kpis
  const holdPoints = plans.flatMap(p =>
    p.activities.filter(a => a.inspection_type === 'HOLD')
      .map(a => ({ ...a, plan_no: p.itp_no, plan_title: p.title })),
  )
  const pendingHolds = holdPoints.filter(h => h.status === 'pending')

  // ── NCR rows ─────────────────────────────────────────────────────────────
  const ncrs = ncrData?.rows ?? []

  return (
    <div className="space-y-8">
      <ReportProjectPicker projects={projects} activeProjectId={activeProjectId} onChange={setProjectId} />

      {isLoading ? <LoadingRows cols={6} /> : (
        <>
          {/* ── KPI strip ───────────────────────────────────────────────── */}
          {kpis && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Active ITPs',       value: String(kpis.active_plans) },
                { label: 'Hold points pending', value: String(kpis.hold_points_pending),
                  highlight: kpis.hold_points_pending > 0 ? 'text-amber-600' : '' },
                { label: 'Inspection pass rate', value: `${kpis.pass_rate_pct}%`,
                  highlight: kpis.pass_rate_pct < 85 ? 'text-red-600' : 'text-emerald-600' },
                { label: 'Open NCRs',         value: String(kpis.open_ncrs),
                  highlight: kpis.critical_or_major_ncrs > 0 ? 'text-red-600' : '' },
              ].map(k => (
                <div key={k.label} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <p className={cn('text-xl font-bold tabular-nums', k.highlight ?? 'text-foreground')}>{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── ITP completion table ─────────────────────────────────────── */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">ITP Plans — completion</h3>
            <ReportTable
              headers={['ITP No', 'Title', 'Work Package', 'Discipline', 'Completion', 'Status']}
              empty={plans.length === 0}
            >
              {plans.map(p => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs text-primary whitespace-nowrap">{p.itp_no}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate">{p.title}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.work_package ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.discipline ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${p.completion_pct}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{p.completion_pct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize border',
                      p.status === 'active' ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                      p.status === 'complete' ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                      p.status === 'void' ? 'border-red-300 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                      'border-border bg-muted text-muted-foreground')}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </ReportTable>
          </div>

          {/* ── Hold point log ──────────────────────────────────────────── */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Hold point log
              {pendingHolds.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {pendingHolds.length} pending
                </span>
              )}
            </h3>
            <ReportTable
              headers={['ITP', 'Seq', 'Description', 'Ref Doc', 'Responsible', 'Status', 'Result Date']}
              empty={holdPoints.length === 0}
            >
              {holdPoints.map(h => (
                <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs text-primary whitespace-nowrap">{h.plan_no}</td>
                  <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{h.seq}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate text-sm">{h.description}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{h.reference_doc ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{h.responsible ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                      h.status === 'passed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                      h.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                      h.status === 'waived' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400')}>
                      {h.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {h.result_date ? new Date(h.result_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </ReportTable>
          </div>

          {/* ── NCR register ────────────────────────────────────────────── */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">NCR register</h3>
            <ReportTable
              headers={['NCR No', 'Title', 'Category', 'Severity', 'Status', 'Raised', 'Age', 'Aging']}
              empty={ncrs.length === 0}
            >
              {ncrs.map(n => (
                <tr key={n.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs text-primary whitespace-nowrap">{n.ncr_number}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate text-sm">{n.title}</td>
                  <td className="px-3 py-2 text-xs capitalize text-muted-foreground">
                    {n.category.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', NCR_SEV_COLOR[n.severity] ?? '')}>
                      {n.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                      n.status === 'closed' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                      n.status === 'open'   ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400')}>
                      {n.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(n.raised_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{n.days_open}d</td>
                  <td className="px-3 py-2">
                    {n.aging !== 'none' ? (
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', NCR_AGING_COLOR[n.aging])}>
                        {n.aging === 'red' ? '>30d' : '>14d'}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </ReportTable>
            {ncrs.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {ncrData?.open_count ?? 0} open · {ncrData?.critical_count ?? 0} critical
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function LoadingRows({ cols }: { cols: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full">
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="px-3 py-3">
                  <div className="h-3 rounded bg-muted animate-pulse" style={{ width: `${40 + (j * 17 + i * 7) % 45}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = React.useState<string | null>('r1')
  const [activeType,     setActiveType]     = React.useState<ReportType>('project-status')
  const [dateRange,      setDateRange]      = React.useState<DateRange>('all')

  function handleNewReport(templateId: string) {
    const map: Record<string, ReportType> = {
      'project-status':    'project-status',
      'budget-performance':'financial-summary',
      'gate-tracker':      'gate-progress',
      'risk-issues':       'risk-register',
    }
    if (map[templateId]) setActiveType(map[templateId])
  }

  const activeTypeDef = REPORT_TYPES.find((t) => t.id === activeType)!

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-background">
      {/* Left sidebar */}
      <div className="w-60 shrink-0 flex flex-col border-r border-border print:hidden">
        <ReportListSidebar
          selectedId={selectedReport}
          onSelect={setSelectedReport}
          onNewReport={handleNewReport}
          onDeleteReport={(id) => id === selectedReport && setSelectedReport(null)}
        />
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-3 print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            {REPORT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveType(t.id)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  activeType === t.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Calendar className="size-3.5 text-muted-foreground" />
            <div className="flex items-center gap-1">
              {DATE_RANGE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setDateRange(o.id)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    dateRange === o.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 text-xs"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              Print
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
              <Download className="size-3.5" />
              Export
            </Button>
          </div>
        </div>

        {/* Report content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 print:px-0 print:py-0">
          {/* Print-only header */}
          <div className="hidden print:block mb-6">
            <h1 className="text-xl font-bold text-foreground">{activeTypeDef.label}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              GridMind Capital &middot; Generated {new Date().toLocaleDateString()} &middot; Range: {dateRange}
            </p>
          </div>

          {/* Report title + description */}
          <div className="mb-5 print:hidden">
            <h2 className="text-base font-semibold text-foreground">{activeTypeDef.label}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{activeTypeDef.description}</p>
          </div>

          {/* Report body */}
          {activeType === 'project-status'    && <ProjectStatusReport    dateRange={dateRange} />}
          {activeType === 'gate-progress'     && <GateProgressReport     dateRange={dateRange} />}
          {activeType === 'financial-summary' && <FinancialSummaryReport dateRange={dateRange} />}
          {activeType === 'variations-register' && <VariationsRegisterReport dateRange={dateRange} />}
          {activeType === 'risk-register'     && <RiskRegisterReport     dateRange={dateRange} />}
          {activeType === 'approvals-log'     && <ApprovalsLogReport     dateRange={dateRange} />}
          {activeType === 'lender-progress'   && <LenderProgressReport />}
          {activeType === 'document-control-log' && <DocumentControlLogReport />}
          {activeType === 'ptw-log'           && <PtwLogReport />}
          {activeType === 'quality-report'    && <QualityReport />}
        </div>
      </div>
    </div>
  )
}
