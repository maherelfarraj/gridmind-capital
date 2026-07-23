'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Wrench, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { loadOmDashboard, updateAssetStatusAction, completeMaintenanceAction } from '@/app/actions/om'
import type { Asset, MaintenancePlan } from '@/lib/types/action-types'

const STATUS_META: Record<Asset['status'], { label: string; color: string }> = {
  operational:    { label: 'Operational',    color: '#22c55e' },
  degraded:       { label: 'Degraded',       color: '#f59e0b' },
  faulty:         { label: 'Faulty',         color: '#ef4444' },
  decommissioned: { label: 'Decommissioned', color: '#94a3b8' },
}

const CRIT_COLOR: Record<Asset['criticality'], string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e',
}

const PLAN_STATUS_COLOR: Record<MaintenancePlan['status'], string> = {
  scheduled: '#3b82f6', overdue: '#ef4444', completed: '#22c55e', skipped: '#94a3b8',
}

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#94a3b8', '#3b82f6', '#8b5cf6']

function KpiCard({ label, value, color, icon: Icon }: { label: string; value: string | number; color?: string; icon?: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <p className="text-2xl font-bold" style={color ? { color } : {}}>{value}</p>
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

function AssetRow({ asset, onUpdate }: { asset: Asset; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false)
  const { label, color } = STATUS_META[asset.status]

  async function markFaulty() {
    setBusy(true)
    await updateAssetStatusAction(asset.id, asset.status === 'faulty' ? 'operational' : 'faulty')
    onUpdate()
    setBusy(false)
  }

  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{asset.asset_tag}</td>
      <td className="px-3 py-2.5 text-sm font-medium">{asset.name}</td>
      <td className="px-3 py-2.5 text-xs capitalize text-muted-foreground">{asset.category}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{asset.manufacturer}</td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-medium" style={{ color: CRIT_COLOR[asset.criticality] }}>
          {asset.criticality.charAt(0).toUpperCase() + asset.criticality.slice(1)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {asset.next_maintenance ? new Date(asset.next_maintenance).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
      </td>
      <td className="px-3 py-2.5">
        <button
          disabled={busy}
          onClick={markFaulty}
          className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors"
        >
          {asset.status === 'faulty' ? 'Restore' : 'Flag'}
        </button>
      </td>
    </tr>
  )
}

function PlanRow({ plan, onUpdate }: { plan: MaintenancePlan; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false)
  const color = PLAN_STATUS_COLOR[plan.status]

  async function complete() {
    setBusy(true)
    await completeMaintenanceAction(plan.id)
    onUpdate()
    setBusy(false)
  }

  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2.5 text-sm font-medium">{plan.title}</td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground">{plan.asset_name}</td>
      <td className="px-3 py-2.5 text-xs capitalize text-muted-foreground">{plan.frequency}</td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-medium" style={{ color }}>{plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}</span>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {plan.next_due ? new Date(plan.next_due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{plan.assigned_to ?? '—'}</td>
      <td className="px-3 py-2.5">
        {(plan.status === 'scheduled' || plan.status === 'overdue') && (
          <button
            disabled={busy}
            onClick={complete}
            className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
          >
            Complete
          </button>
        )}
      </td>
    </tr>
  )
}

export function OmPage() {
  const [tab, setTab] = useState<'assets' | 'maintenance'>('assets')
  const { data, mutate, isLoading } = useSWR('om-dashboard', loadOmDashboard)

  const isLive = (data?.stats.totalAssets ?? 0) > 0
  const s = data?.stats

  const statusData = (data?.byStatus ?? []).map((r, i) => ({
    name: STATUS_META[r.status as Asset['status']]?.label ?? r.status,
    value: r.count,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const catData = data?.byCategory ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">O&M — Asset Registry & CMMS</h1>
          <p className="text-sm text-muted-foreground mt-0.5">G6 operations, maintenance plans, and asset lifecycle management</p>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge live={isLive} />
          <Button size="sm" variant="ghost" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Assets" value={s?.totalAssets ?? 0} icon={Wrench} />
        <KpiCard label="Operational" value={s?.operational ?? 0} color="#22c55e" icon={CheckCircle2} />
        <KpiCard label="Faulty" value={s?.faulty ?? 0} color="#ef4444" icon={AlertTriangle} />
        <KpiCard label="Overdue Maint." value={s?.overdueMaintenance ?? 0} color="#ef4444" icon={Clock} />
        <KpiCard label="Upcoming (90d)" value={s?.upcomingMaintenance ?? 0} color="#f59e0b" icon={Clock} />
        <KpiCard label="Warranty Expiring" value={s?.warrantyExpiringSoon ?? 0} color="#f97316" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-3">Assets by Category</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={catData.length ? catData : [
              { category: 'inverter', count: 8 }, { category: 'panel', count: 48 },
              { category: 'transformer', count: 4 }, { category: 'cable', count: 12 }, { category: 'structure', count: 6 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" name="Assets" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-3">Asset Status Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusData.length ? statusData : [
                  { name: 'Operational', value: 42, fill: '#22c55e' },
                  { name: 'Degraded', value: 8, fill: '#f59e0b' },
                  { name: 'Faulty', value: 3, fill: '#ef4444' },
                ]}
                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {(statusData.length ? statusData : [
                  { fill: '#22c55e' }, { fill: '#f59e0b' }, { fill: '#ef4444' },
                ]).map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex border-b border-border">
          {(['assets', 'maintenance'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'assets' ? `Assets (${data?.assets.length ?? 0})` : `Maintenance Plans (${data?.plans.length ?? 0})`}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          {tab === 'assets' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  {['Tag', 'Name', 'Category', 'Manufacturer', 'Status', 'Criticality', 'Next Maint.', 'Warranty', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.assets ?? []).map(a => <AssetRow key={a.id} asset={a} onUpdate={() => mutate()} />)}
                {!data?.assets.length && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground text-sm">No assets yet — seed demo data</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  {['Task', 'Asset', 'Frequency', 'Status', 'Next Due', 'Assigned To', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.plans ?? []).map(p => <PlanRow key={p.id} plan={p} onUpdate={() => mutate()} />)}
                {!data?.plans.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-sm">No maintenance plans yet</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
