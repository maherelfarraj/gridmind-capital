'use client'

import * as React from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, Wallet, Banknote, AlertTriangle, Landmark, CalendarClock,
  ArrowUpDown, ChevronUp, ChevronDown, Filter, ShieldAlert, ChevronRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExcelExportButton } from '@/components/shared/excel-export-button'
import {
  loadPortfolioCashFlow,
  type ProjectCashRow, type WatchlistRow,
} from '@/app/actions/portfolio-cash-flow'
import { cn } from '@/lib/utils'

// ─── formatting ───────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtCompact = (n: number) =>
  n === 0 ? '$0' : `$${(n / 1_000_000).toFixed(n >= 1_000_000 ? 1 : 2)}M`
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ─── KPI card ─────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, tone = 'neutral', sub,
}: {
  label: string; value: string; icon: React.ElementType
  tone?: 'neutral' | 'good' | 'bad' | 'warn'; sub?: string
}) {
  const toneCls = {
    neutral: 'bg-muted text-foreground',
    good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    bad: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  }[tone]
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
      <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', toneCls)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

// ─── sort helpers ─────────────────────────────────────────────

type SortKey = keyof Pick<
  ProjectCashRow,
  'name' | 'contractValue' | 'invoiced' | 'received' | 'overdueAmount' | 'oldestOverdueDays' | 'retentionHeld'
>
type SortDir = 'asc' | 'desc'

// ─── main ─────────────────────────────────────────────────────

export function PortfolioCashFlow() {
  const router = useRouter()
  const { data, isLoading } = useSWR('portfolio-cash-flow', loadPortfolioCashFlow, {
    revalidateOnFocus: true,
    refreshInterval: 60_000,
  })

  const [projectFilter, setProjectFilter] = React.useState('All')
  const [statusFilter, setStatusFilter] = React.useState('All')
  const [sortKey, setSortKey] = React.useState<SortKey>('contractValue')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const breakdown = data?.breakdown ?? []
  const watchlist = data?.watchlist ?? []
  const kpis = data?.kpis
  const chart = data?.chart ?? []

  const filteredBreakdown = React.useMemo(() => {
    let list = breakdown
    if (projectFilter !== 'All') list = list.filter((r) => r.projectId === projectFilter)
    if (statusFilter !== 'All') list = list.filter((r) => r.status === statusFilter)
    return [...list].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey]
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [breakdown, projectFilter, statusFilter, sortKey, sortDir])

  const filteredWatchlist = React.useMemo(() => {
    let list = watchlist
    if (projectFilter !== 'All') list = list.filter((r) => r.projectId === projectFilter)
    // Watchlist rows carry no status; status filter narrows by the projects that match it.
    if (statusFilter !== 'All') {
      const ids = new Set(breakdown.filter((b) => b.status === statusFilter).map((b) => b.projectId))
      list = list.filter((r) => ids.has(r.projectId))
    }
    return list
  }, [watchlist, breakdown, projectFilter, statusFilter])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc') }
  }
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown size={12} className="ml-1 inline text-muted-foreground/50" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="ml-1 inline text-primary" />
      : <ChevronDown size={12} className="ml-1 inline text-primary" />
  }

  // ── loading ──
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-80 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  // ── access restricted ──
  if (data && !data.authorized) {
    return (
      <div className="p-6">
        <Card className="p-10 flex flex-col items-center text-center gap-3 max-w-lg mx-auto">
          <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Access restricted</h1>
          <p className="text-sm text-muted-foreground">
            The company cash flow view is available to portfolio, finance, and executive roles.
            Your current role{data.role ? ` (${data.role.replace(/_/g, ' ')})` : ''} does not have access.
          </p>
        </Card>
      </div>
    )
  }

  const hasMilestones =
    (kpis?.totalContractValue ?? 0) > 0 ||
    (kpis?.invoicedToDate ?? 0) > 0 ||
    (kpis?.receivedToDate ?? 0) > 0 ||
    watchlist.length > 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground text-balance">Company Cash Flow</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aggregate receivables across all active projects — invoicing, collections, overdue &amp; retention.
          </p>
        </div>
      </div>

      {/* Empty state */}
      {!hasMilestones ? (
        <Card className="p-12 flex flex-col items-center text-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Wallet size={24} />
          </div>
          <h2 className="text-base font-semibold text-foreground">No payment milestones yet</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Once active projects have payment milestones, the company cash curve, KPIs, per-project
            breakdown and overdue watchlist will appear here.
          </p>
        </Card>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard label="Contract Value" value={fmtCompact(kpis!.totalContractValue)} icon={TrendingUp} sub="Portfolio total" />
            <KpiCard label="Invoiced to Date" value={fmtCompact(kpis!.invoicedToDate)} icon={Wallet} tone="neutral" />
            <KpiCard label="Received to Date" value={fmtCompact(kpis!.receivedToDate)} icon={Banknote} tone="good" />
            <KpiCard
              label="Overdue"
              value={fmtCompact(kpis!.overdueAmount)}
              icon={AlertTriangle}
              tone={kpis!.overdueAmount > 0 ? 'bad' : 'neutral'}
              sub={`${kpis!.overdueCount} milestone${kpis!.overdueCount === 1 ? '' : 's'} overdue`}
            />
            <KpiCard label="Retention Held" value={fmtCompact(kpis!.retentionHeld)} icon={Landmark} tone="warn" />
            <KpiCard label="Forecast (90 days)" value={fmtCompact(kpis!.forecast90)} icon={CalendarClock} sub="Expected receipts" />
          </div>

          {/* Company cash curve */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Company Cash Curve</h2>
              <span className="text-xs text-muted-foreground">— cumulative, with 12-month planned forecast</span>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={chart} margin={{ left: 12, right: 24, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `$${(Number(v) / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13 }}
                  formatter={(v, name) => [fmt(Number(v)), name as string]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {(() => {
                  const firstForecast = chart.find((c) => c.forecast)
                  return firstForecast
                    ? <ReferenceLine x={firstForecast.period} stroke="var(--border)" strokeDasharray="4 4" label={{ value: 'Forecast', fontSize: 10, fill: 'var(--muted-foreground)', position: 'insideTopRight' }} />
                    : null
                })()}
                <Line type="monotone" dataKey="planned" name="Cumulative Planned" stroke="#94a3b8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="invoiced" name="Cumulative Invoiced" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="received" name="Cumulative Received" stroke="#22c55e" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-muted-foreground" />
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="All">All projects</option>
                {breakdown.map((p) => <option key={p.projectId} value={p.projectId}>{p.code} — {p.name}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="All">All statuses</option>
                {(data?.statuses ?? []).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredBreakdown.length} project{filteredBreakdown.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Per-project breakdown */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Per-Project Breakdown</h2>
              <ExcelExportButton
                register="portfolio-cash-flow"
                filters={{ project: projectFilter, status: statusFilter }}
                rowCount={filteredBreakdown.length}
                disabled={filteredBreakdown.length === 0}
                buildSheets={() => [{
                  name: 'Cash Flow by Project',
                  rows: filteredBreakdown,
                  columns: [
                    { header: 'Code', key: 'code', type: 'text', width: 14 },
                    { header: 'Project', key: 'name', type: 'text', width: 32 },
                    { header: 'Status', key: (r: ProjectCashRow) => r.status.replace(/_/g, ' '), type: 'text', width: 12 },
                    { header: 'Contract Value', key: 'contractValue', type: 'currency', width: 16 },
                    { header: 'Invoiced', key: 'invoiced', type: 'currency', width: 16 },
                    { header: 'Received', key: 'received', type: 'currency', width: 16 },
                    { header: 'Overdue', key: 'overdueAmount', type: 'currency', width: 14 },
                    { header: 'Oldest Overdue (days)', key: 'oldestOverdueDays', type: 'number', width: 18 },
                    { header: 'Retention Held', key: 'retentionHeld', type: 'currency', width: 16 },
                  ],
                }]}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    {([
                      { label: 'Project', key: 'name' as SortKey, align: 'left' },
                      { label: 'Contract Value', key: 'contractValue' as SortKey, align: 'right' },
                      { label: 'Invoiced', key: 'invoiced' as SortKey, align: 'right' },
                      { label: 'Received', key: 'received' as SortKey, align: 'right' },
                      { label: 'Overdue', key: 'overdueAmount' as SortKey, align: 'right' },
                      { label: 'Oldest Overdue', key: 'oldestOverdueDays' as SortKey, align: 'right' },
                      { label: 'Retention Held', key: 'retentionHeld' as SortKey, align: 'right' },
                    ] as { label: string; key: SortKey; align: 'left' | 'right' }[]).map((c) => (
                      <th
                        key={c.key}
                        onClick={() => handleSort(c.key)}
                        className={cn('px-4 py-3 font-medium cursor-pointer select-none whitespace-nowrap hover:text-foreground', c.align === 'right' ? 'text-right' : 'text-left')}
                      >
                        {c.label}<SortIcon k={c.key} />
                      </th>
                    ))}
                    <th className="px-3 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBreakdown.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No projects match the current filters.</td></tr>
                  ) : filteredBreakdown.map((r) => (
                    <tr
                      key={r.projectId}
                      onClick={() => router.push(`/projects/${r.projectId}/cash-flow`)}
                      className="hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{fmt(r.contractValue)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">{fmt(r.invoiced)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(r.received)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {r.overdueAmount > 0
                          ? <span className="text-red-600 dark:text-red-400 font-semibold">{fmt(r.overdueAmount)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.oldestOverdueDays > 0
                          ? <span className="text-red-600 dark:text-red-400">{r.oldestOverdueDays}d</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">{fmt(r.retentionHeld)}</td>
                      <td className="px-3 py-3 text-muted-foreground"><ChevronRight size={14} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Overdue watchlist */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-red-500" />
                <h2 className="text-sm font-semibold text-foreground">Overdue Watchlist</h2>
                <Badge variant="secondary" className="text-xs">Collection meeting list</Badge>
              </div>
              <ExcelExportButton
                register="overdue-watchlist"
                filters={{ project: projectFilter, status: statusFilter }}
                rowCount={filteredWatchlist.length}
                disabled={filteredWatchlist.length === 0}
                buildSheets={() => [{
                  name: 'Overdue Watchlist',
                  rows: filteredWatchlist,
                  columns: [
                    { header: 'Code', key: 'code', type: 'text', width: 14 },
                    { header: 'Project', key: 'projectName', type: 'text', width: 30 },
                    { header: 'Milestone', key: 'milestone', type: 'text', width: 34 },
                    { header: 'Amount Overdue', key: 'amount', type: 'currency', width: 16 },
                    { header: 'Due Date', key: 'dueDate', type: 'date', width: 14 },
                    { header: 'Days Overdue', key: 'daysOverdue', type: 'number', width: 14 },
                    { header: 'Escalation Level', key: (r: WatchlistRow) => (r.escalationLevel > 0 ? `L${r.escalationLevel}` : '—'), type: 'text', width: 14 },
                  ],
                }]}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Project</th>
                    <th className="px-4 py-3 text-left font-medium">Milestone</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Due</th>
                    <th className="px-4 py-3 text-right font-medium">Days Overdue</th>
                    <th className="px-4 py-3 text-center font-medium">Escalation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredWatchlist.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No overdue milestones. Collections are on track.</td></tr>
                  ) : filteredWatchlist.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/projects/${r.projectId}/cash-flow`)}
                      className="hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{r.projectName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-64 truncate">{r.milestone}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-red-600 dark:text-red-400">{fmt(r.amount)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.dueDate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">{r.daysOverdue}d</td>
                      <td className="px-4 py-3 text-center">
                        {r.escalationLevel > 0
                          ? <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">L{r.escalationLevel}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
