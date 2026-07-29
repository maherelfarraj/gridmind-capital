'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  ChevronUp,
  Receipt,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getFinanceDashboard } from '@/app/actions/finance'
import type { WbsData, CommitmentData } from '@/app/actions/finance'
import { getProjects } from '@/app/actions/projects'

// ─── Types (aliases to imported server types) ────────────────────────────────

type WbsLine = WbsData
type CommitmentLine = CommitmentData

// ─── Mock fallback data ───────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────

const fmt = (v: number) => `$${v.toFixed(1)}M`
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100)

function cpiColor(cpi: number) {
  if (cpi >= 0.98) return '#22c55e'
  if (cpi >= 0.90) return '#f59e0b'
  return '#ef4444'
}

function spiColor(spi: number) {
  if (spi >= 0.98) return '#22c55e'
  if (spi >= 0.90) return '#f59e0b'
  return '#ef4444'
}

// ─── KPI cards ────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon, trend }: {
  label: string; value: string; sub?: string; color: string
  icon: React.ElementType; trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div
      className="flex-1 min-w-[160px] rounded-xl bg-card border border-border p-4 space-y-1"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="size-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="size-3.5" style={{ color }} aria-hidden />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && (
        <div className="flex items-center gap-1">
          {trend === 'up'      && <ArrowUpRight   className="size-3.5 text-[#22c55e]" aria-hidden />}
          {trend === 'down'    && <ArrowDownRight  className="size-3.5 text-[#ef4444]" aria-hidden />}
          {trend === 'neutral' && <Minus           className="size-3.5 text-[#94a3b8]" aria-hidden />}
          <span className="text-xs text-muted-foreground">{sub}</span>
        </div>
      )}
    </div>
  )
}

// ─── WBS Row ──────────────────────────────────────────────────

function WbsRow({ line }: { line: WbsLine }) {
  const cpi  = line.ev / (line.ac || 1)
  const spi  = line.ev / (line.pv || 1)
  const eac  = line.eac ?? (line.bac / cpi)
  const vac  = line.bac - eac           // Variance at Completion
  const pctComplete = pct(line.ac, line.bac)

  return (
    <tr className={cn(
      'border-b border-border hover:bg-muted/20 transition-colors',
      line.level === 0 && 'bg-muted/30 font-semibold',
    )}>
      <td className="px-4 py-2.5">
        <div className={cn('flex items-center gap-2', line.level === 1 && 'pl-4')}>
          <span className="font-mono text-xs text-muted-foreground shrink-0">{line.code}</span>
          <span className={cn('text-sm text-foreground truncate', line.level === 0 && 'font-bold')}>{line.description}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground">{fmt(line.bac)}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground">{fmt(line.pv)}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground">{fmt(line.ev)}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground">{fmt(line.ac)}</td>
      {/* CPI */}
      <td className="px-4 py-2.5 text-center">
        <span className="font-mono text-sm font-semibold" style={{ color: cpiColor(cpi) }}>
          {cpi.toFixed(2)}
        </span>
      </td>
      {/* SPI */}
      <td className="px-4 py-2.5 text-center">
        <span className="font-mono text-sm font-semibold" style={{ color: spiColor(spi) }}>
          {spi.toFixed(2)}
        </span>
      </td>
      {/* EAC */}
      <td className="px-4 py-2.5 text-right font-mono text-sm">
        <span className={cn(eac > line.bac ? 'text-[#ef4444]' : 'text-[#22c55e]')}>{fmt(eac)}</span>
      </td>
      {/* VAC */}
      <td className="px-4 py-2.5 text-right font-mono text-sm">
        <span className={cn(vac < 0 ? 'text-[#ef4444]' : 'text-[#22c55e]')}>
          {vac >= 0 ? '+' : ''}{fmt(vac)}
        </span>
      </td>
      {/* % complete */}
      <td className="px-4 py-2.5 w-28 hidden lg:table-cell">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${pctComplete}%`, backgroundColor: cpiColor(cpi) }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0">{pctComplete}%</span>
        </div>
      </td>
    </tr>
  )
}

// ─── Commitment Row ───────────────────────────────────────────

const COMMIT_STATUS_META: Record<string, { label: string; color: string }> = {
  committed: { label: 'Committed', color: '#3b82f6' },
  invoiced:  { label: 'Invoiced',  color: '#f59e0b' },
  paid:      { label: 'Paid',      color: '#22c55e' },
  disputed:  { label: 'Disputed',  color: '#ef4444' },
}
const COMMIT_STATUS_FALLBACK = (raw: string) => ({ label: raw || 'Unknown', color: '#94a3b8' })

function CommitmentRow({ line }: { line: CommitmentLine }) {
  const meta = COMMIT_STATUS_META[line.status] ?? COMMIT_STATUS_FALLBACK(line.status)
  return (
    <tr className="border-b border-border hover:bg-muted/20 transition-colors">
      <td className="px-4 py-2.5">
        <span className="font-mono text-xs text-[#64ffda]">{line.ref}</span>
      </td>
      <td className="px-4 py-2.5">
        <p className="text-sm font-medium text-foreground">{line.vendor}</p>
        <p className="text-xs text-muted-foreground">{line.description}</p>
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-foreground">
        {fmt(line.value)}
      </td>
      <td className="px-4 py-2.5 text-center">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
          style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
        >
          {meta.label}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground hidden md:table-cell">
        {line.date}
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function FinancePage() {
  const [tab, setTab] = React.useState<'evm' | 'commitments'>('evm')

  const { data: liveData, isLoading } = useSWR('finance-dashboard', () => getFinanceDashboard())

  // Resolve a project to deep-link the Payment Certificates card (prefer SRS-400).
  const { data: financeProjects } = useSWR('finance-projects', () => getProjects())
  const paymentsProjectId =
    financeProjects?.find((p) => p.code === 'SRS-400')?.id ?? financeProjects?.[0]?.id ?? null

  // Use live data only; show empty state when DB is not seeded
  const WBS         = liveData?.seeded ? liveData.wbs         : []
  const COMMITMENTS = liveData?.seeded ? liveData.commitments : []

  // Portfolio-level derived metrics
  const root   = WBS[0]
  const cpi    = root.ev / (root.ac || 1)
  const spi    = root.ev / (root.pv || 1)
  const eac    = root.bac / (cpi || 1)
  const cv     = root.ev - root.ac   // Cost Variance
  const sv     = root.ev - root.pv   // Schedule Variance
  const totalCommitted = COMMITMENTS.reduce((s, c) => s + c.value, 0)

  const TABS = [
    { id: 'evm' as const,          label: 'EVM Analysis' },
    { id: 'commitments' as const,  label: `Commitments (${COMMITMENTS.length})` },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Earned Value Management & Commitment Register — <span className="font-mono text-[#64ffda]">SRS-400</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-[10px] font-semibold rounded-full px-2 py-0.5 border',
            liveData?.seeded
              ? 'bg-green-500/10 text-green-600 border-green-500/25'
              : 'bg-muted text-muted-foreground border-border',
          )}>
            <span className={cn('size-1.5 rounded-full', liveData?.seeded ? 'bg-green-500' : 'bg-muted-foreground')} />
            {isLoading ? 'Loading…' : liveData?.seeded ? 'Live' : 'Illustrative'}
          </span>
          {paymentsProjectId && (
            <Link
              href={`/projects/${paymentsProjectId}/payments`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <Receipt className="size-4" aria-hidden />
              Payment Certificates
            </Link>
          )}
          {paymentsProjectId && (
            <Link
              href={`/projects/${paymentsProjectId}/contracts`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <FileText className="size-4" aria-hidden />
              Contracts
            </Link>
          )}
          <Button variant="outline" size="sm">
            <BarChart3 className="size-4" aria-hidden />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex flex-wrap gap-3" role="region" aria-label="Finance KPIs">
        <KpiCard label="Budget (BAC)"      value={fmt(root.bac)}              color="#64ffda"   icon={DollarSign}  />
        <KpiCard label="Actual Cost (AC)"  value={fmt(root.ac)}               color="#3b82f6"   icon={DollarSign}  trend={root.ac > root.ev ? 'down' : 'up'} sub={`${pct(root.ac, root.bac)}% of BAC spent`} />
        <KpiCard label="CPI"               value={cpi.toFixed(2)}             color={cpiColor(cpi)} icon={TrendingUp}  trend={cpi >= 1 ? 'up' : 'down'} sub={cpi >= 1 ? 'Under budget' : 'Over budget'} />
        <KpiCard label="SPI"               value={spi.toFixed(2)}             color={spiColor(spi)} icon={TrendingUp}  trend={spi >= 1 ? 'up' : 'down'} sub={spi >= 1 ? 'Ahead of schedule' : 'Behind schedule'} />
        <KpiCard label="EAC"               value={fmt(eac)}                   color={eac > root.bac ? '#ef4444' : '#22c55e'} icon={BarChart3} sub={`VAC: ${cv >= 0 ? '+' : ''}${fmt(root.bac - eac)}`} />
        <KpiCard label="Total Committed"   value={fmt(totalCommitted)}        color="#8b5cf6"   icon={DollarSign}  sub={`${COMMITMENTS.length} purchase orders`} />
      </div>

      {/* Variance alerts */}
      {(cpi < 0.95 || spi < 0.95) && (
        <div className="flex items-start gap-3 rounded-xl bg-[#f59e0b]/8 border border-[#f59e0b]/25 p-4">
          <AlertTriangle className="size-5 text-[#f59e0b] shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">EVM Thresholds Breached</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {cpi < 0.95 && `CPI ${cpi.toFixed(2)} is below the 0.95 warning threshold. `}
              {spi < 0.95 && `SPI ${spi.toFixed(2)} indicates schedule slippage. `}
              A budget variance review is recommended.
            </p>
          </div>
        </div>
      )}

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

      {/* EVM table */}
      {tab === 'evm' && (
        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm" role="table" aria-label="EVM WBS table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">WBS / Description</th>
                  <th className="px-4 py-2.5 text-right font-semibold">BAC</th>
                  <th className="px-4 py-2.5 text-right font-semibold">PV</th>
                  <th className="px-4 py-2.5 text-right font-semibold">EV</th>
                  <th className="px-4 py-2.5 text-right font-semibold">AC</th>
                  <th className="px-4 py-2.5 text-center font-semibold">CPI</th>
                  <th className="px-4 py-2.5 text-center font-semibold">SPI</th>
                  <th className="px-4 py-2.5 text-right font-semibold">EAC</th>
                  <th className="px-4 py-2.5 text-right font-semibold">VAC</th>
                  <th className="px-4 py-2.5 text-left font-semibold hidden lg:table-cell">% Done</th>
                </tr>
              </thead>
              <tbody>
                {WBS.map((line) => <WbsRow key={line.id} line={line} />)}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Commitments table */}
      {tab === 'commitments' && (
        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm" role="table" aria-label="Commitment register">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Ref</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Vendor / Description</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {COMMITMENTS.map((c) => <CommitmentRow key={c.id} line={c} />)}
                {/* Total row */}
                <tr className="bg-muted/30 font-semibold border-t-2 border-border">
                  <td colSpan={2} className="px-4 py-2.5 text-sm text-foreground">Total Committed</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground">{fmt(totalCommitted)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
