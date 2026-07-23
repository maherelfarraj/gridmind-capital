'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from 'recharts'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { loadFinanceEvmDashboard } from '@/app/actions/finance-evm'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function KpiCard({ label, value, good, neutral }: { label: string; value: string; good?: boolean; neutral?: boolean }) {
  const color = neutral ? undefined : good ? '#22c55e' : '#ef4444'
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold font-mono" style={color ? { color } : {}}>{value}</p>
    </div>
  )
}

function LiveBadge({ live }: { live: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
      live ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
      <span className={cn('size-1.5 rounded-full', live ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground')} />
      {live ? 'Live' : 'Illustrative'}
    </span>
  )
}

// Illustrative fallback data
const ILLUS_EVM = [
  { period: 'Jan', pv: 16_000_000, ev: 12_800_000, ac: 13_440_000 },
  { period: 'Feb', pv: 32_000_000, ev: 28_800_000, ac: 30_400_000 },
  { period: 'Mar', pv: 48_000_000, ev: 44_800_000, ac: 46_400_000 },
  { period: 'Apr', pv: 70_400_000, ev: 67_200_000, ac: 68_800_000 },
  { period: 'May', pv: 96_000_000, ev: 89_600_000, ac: 91_200_000 },
  { period: 'Jun', pv: 128_000_000, ev: 118_400_000, ac: 121_000_000 },
]

const ILLUS_CASH = [
  { period: 'Jan', inflow: 1_280_000, outflow: 14_400_000, net: -13_120_000 },
  { period: 'Feb', inflow: 2_304_000, outflow: 27_360_000, net: -25_056_000 },
  { period: 'Mar', inflow: 3_584_000, outflow: 41_760_000, net: -38_176_000 },
  { period: 'Apr', inflow: 5_376_000, outflow: 61_920_000, net: -56_544_000 },
  { period: 'May', inflow: 7_168_000, outflow: 82_080_000, net: -74_912_000 },
  { period: 'Jun', inflow: 9_472_000, outflow: 108_900_000, net: -99_428_000 },
]

export function FinanceEvmPage() {
  const [tab, setTab] = useState<'evm' | 'cashflow' | 'register'>('evm')
  const { data, mutate, isLoading } = useSWR('finance-evm-dashboard', loadFinanceEvmDashboard)

  const isLive = (data?.records.length ?? 0) > 0
  const s = data?.summary
  const evmTrend  = data?.evmTrend.length  ? data.evmTrend  : ILLUS_EVM
  const cashTrend = data?.cashTrend.length ? data.cashTrend : ILLUS_CASH

  const cpi = s?.avgCPI ?? 0.98
  const spi = s?.avgSPI ?? 0.97

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance — EVM & Cash Flow</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Earned Value Management, cost performance, and cash flow analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge live={isLive} />
          <Button size="sm" variant="ghost" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="BAC"       value={fmt(s?.totalBAC ?? 320_000_000)}  neutral />
        <KpiCard label="EV"        value={fmt(s?.totalEV  ?? 118_400_000)}  neutral />
        <KpiCard label="AC"        value={fmt(s?.totalAC  ?? 121_000_000)}  neutral />
        <KpiCard label="EAC"       value={fmt(s?.totalEAC ?? 330_000_000)}  good={cpi >= 1} />
        <KpiCard label="CPI"       value={cpi.toFixed(2)} good={cpi >= 1} />
        <KpiCard label="SPI"       value={spi.toFixed(2)} good={spi >= 1} />
        <KpiCard label="Cost Var." value={fmt(s?.variance ?? -2_600_000)}   good={(s?.variance ?? -1) >= 0} />
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex border-b border-border">
          {(['evm', 'cashflow', 'register'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'evm' ? 'EVM Trend' : t === 'cashflow' ? 'Cash Flow' : 'Period Register'}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'evm' && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Planned Value (PV) vs Earned Value (EV) vs Actual Cost (AC) by period</p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={evmTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 10 }} width={60} />
                  <Tooltip formatter={v => fmt(v as number)} />
                  <Legend />
                  <Line type="monotone" dataKey="pv" name="PV (Planned)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ev" name="EV (Earned)"  stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ac" name="AC (Actual)"  stroke="#ef4444" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {tab === 'cashflow' && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Monthly cash inflows and outflows</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={cashTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 10 }} width={60} />
                  <Tooltip formatter={v => fmt(v as number)} />
                  <Legend />
                  <Bar dataKey="inflow"  name="Inflows"  fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" name="Outflows" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {tab === 'register' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    {['Period', 'Project', 'BAC', 'PV', 'EV', 'AC', 'CPI', 'SPI', 'EAC', 'CV', 'SV'].map(h => (
                      <th key={h} className="px-3 py-2 text-right first:text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.records ?? []).map(r => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 text-sm font-mono text-muted-foreground">{r.period}</td>
                      <td className="px-3 py-2 text-sm">{r.project_name}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right">{fmt(r.bac)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right">{fmt(r.pv)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right">{fmt(r.ev)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right">{fmt(r.ac)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right" style={{ color: r.cpi >= 1 ? '#22c55e' : '#ef4444' }}>{r.cpi.toFixed(2)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right" style={{ color: r.spi >= 1 ? '#22c55e' : '#ef4444' }}>{r.spi.toFixed(2)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right">{fmt(r.eac)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right" style={{ color: r.cv >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(r.cv)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right" style={{ color: r.sv >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(r.sv)}</td>
                    </tr>
                  ))}
                  {!data?.records.length && (
                    <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground text-sm">No EVM records yet — seed demo data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
