'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Printer, Download, Calendar, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ReportListSidebar } from '@/components/reports/report-list-sidebar'
import { getProjects }           from '@/app/actions/projects'
import { loadRisksDashboard }    from '@/app/actions/risks'
import { getApprovals }          from '@/app/actions/approvals'
import { loadFinanceEvmDashboard } from '@/app/actions/finance-evm'
import { getGateProgressReport } from '@/app/actions/phase-gates'
import type { RiskRecord }       from '@/lib/types/action-types'

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportType = 'project-status' | 'gate-progress' | 'financial-summary' | 'risk-register' | 'approvals-log'
type DateRange  = '30d' | '90d' | '1y' | 'all'

const REPORT_TYPES: { id: ReportType; label: string; description: string }[] = [
  { id: 'project-status',    label: 'Project Status',     description: 'Portfolio-wide project status, gate and budget overview' },
  { id: 'gate-progress',     label: 'Gate Progress',      description: 'Phase gate status across all active projects' },
  { id: 'financial-summary', label: 'Financial Summary',  description: 'EVM records — budget, actual, EAC, and CPI by period' },
  { id: 'risk-register',     label: 'Risk Register',      description: 'Full risk register with scores, owners and status' },
  { id: 'approvals-log',     label: 'Approvals Log',      description: 'Approval decisions and pending items across all projects' },
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
          {activeType === 'risk-register'     && <RiskRegisterReport     dateRange={dateRange} />}
          {activeType === 'approvals-log'     && <ApprovalsLogReport     dateRange={dateRange} />}
        </div>
      </div>
    </div>
  )
}
