'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Briefcase, AlertTriangle, Clock, Activity, ChevronUp, ChevronDown,
  Minus, ArrowUpDown, Filter, Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getPortfolioStats, type PortfolioProject } from '@/app/actions/portfolio'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────

const GATE_COLORS: Record<string, string> = {
  G0: '#64748b', G1: '#3b82f6', G2: '#6366f1',
  G3: '#8b5cf6', G4: '#a855f7', G5: '#f97316', G6: '#22c55e',
}

const STATUS_VARIANT: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  draft:     'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  on_hold:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const HEALTH_DOT: Record<string, string> = {
  green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500',
}

// ─── KPI Card ─────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: number | string; icon: React.ElementType
  color: string; sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
      <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', color)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Sort helpers ─────────────────────────────────────────────

type SortKey = 'name' | 'code' | 'current_phase' | 'status' | 'health' | 'budget_usd' | 'target_completion'
type SortDir = 'asc' | 'desc'

function sortProjects(projects: PortfolioProject[], key: SortKey, dir: SortDir) {
  return [...projects].sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
    return dir === 'asc' ? cmp : -cmp
  })
}

// ─── Main component ───────────────────────────────────────────

export function PortfolioDashboard() {
  const { data, isLoading } = useSWR('portfolio-stats', getPortfolioStats, {
    revalidateOnFocus: true,
    refreshInterval: 60_000,
  })

  const [search, setSearch] = React.useState('')
  const [filterGate, setFilterGate] = React.useState('All')
  const [filterStatus, setFilterStatus] = React.useState('All')
  const [sortKey, setSortKey] = React.useState<SortKey>('current_phase')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

  const projects = data?.projects ?? []

  const gateChartData = React.useMemo(() => {
    if (!data?.byGate) return []
    return Object.entries(data.byGate)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([gate, count]) => ({ gate, count }))
  }, [data])

  const filtered = React.useMemo(() => {
    let list = projects
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
      )
    }
    if (filterGate !== 'All') {
      const gNum = parseInt(filterGate.replace('G', ''))
      list = list.filter((p) => (p.current_phase ?? 0) === gNum)
    }
    if (filterStatus !== 'All') {
      list = list.filter((p) => p.status === filterStatus)
    }
    return sortProjects(list, sortKey, sortDir)
  }, [projects, search, filterGate, filterStatus, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown size={12} className="ml-1 text-muted-foreground/50" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="ml-1 text-primary" />
      : <ChevronDown size={12} className="ml-1 text-primary" />
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portfolio Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Live view across all projects — {projects.length} project{projects.length !== 1 ? 's' : ''} total
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Projects"
          value={data?.totalActive ?? 0}
          icon={Briefcase}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          sub={`${projects.length} total in portfolio`}
        />
        <KpiCard
          label="Projects at Risk"
          value={data?.atRisk ?? 0}
          icon={AlertTriangle}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          sub="On hold or amber/red health"
        />
        <KpiCard
          label="Pending Approvals"
          value={data?.pendingApprovals ?? 0}
          icon={Clock}
          color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          sub="Awaiting decision"
        />
        <KpiCard
          label="Gates in Flight"
          value={gateChartData.length}
          icon={Activity}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          sub="Active gate stages"
        />
      </div>

      {/* Gate distribution bar chart */}
      {gateChartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Projects by Gate</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={gateChartData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="gate" tick={{ fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} width={32} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13 }}
                formatter={(v) => [`${v} project${Number(v) !== 1 ? 's' : ''}`, '']}
                labelFormatter={(l) => { const g = String(l); return `${g} — ${g === 'G6' ? 'Handover & O&M' : `Gate ${g.replace('G', '')}`}` }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {gateChartData.map((entry) => (
                  <Cell key={entry.gate} fill={GATE_COLORS[entry.gate] ?? '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <select
            value={filterGate}
            onChange={(e) => setFilterGate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {['All', 'G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {['All', 'active', 'draft', 'on_hold', 'completed', 'cancelled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Projects table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {(
                  [
                    { label: 'Name', key: 'name' as SortKey },
                    { label: 'Code', key: 'code' as SortKey },
                    { label: 'Gate', key: 'current_phase' as SortKey },
                    { label: 'Status', key: 'status' as SortKey },
                    { label: 'Health', key: 'health' as SortKey },
                    { label: 'Budget (M)', key: 'budget_usd' as SortKey },
                    { label: 'Target COD', key: 'target_completion' as SortKey },
                  ] as { label: string; key: SortKey }[]
                ).map(({ label, key }) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort(key)}
                  >
                    <span className="flex items-center">
                      {label}
                      <SortIcon k={key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No projects match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground max-w-56 truncate">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.code}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ background: GATE_COLORS[`G${p.current_phase ?? 0}`] ?? '#64748b' }}
                      >
                        G{p.current_phase ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize', STATUS_VARIANT[p.status] ?? STATUS_VARIANT.draft)}>
                        {p.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('size-2 rounded-full shrink-0', HEALTH_DOT[p.health ?? 'green'] ?? 'bg-emerald-500')} />
                        <span className="text-xs capitalize text-muted-foreground">{p.health ?? 'green'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                      {p.budget_usd ? `$${(p.budget_usd / 1_000_000).toFixed(0)}M` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {p.target_completion
                        ? new Date(p.target_completion).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
