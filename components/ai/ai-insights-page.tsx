'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Brain, AlertTriangle, CheckCircle2, RefreshCw, Star, Plug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  loadAiMarketplaceDashboard,
  acknowledgeInsightAction,
  dismissInsightAction,
  connectProviderAction,
} from '@/app/actions/ai-insights'
import type { AiInsight, MarketplaceProvider } from '@/lib/types/action-types'

const SEV_META: Record<AiInsight['severity'], { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: '#ef444415' },
  high:     { label: 'High',     color: '#f97316', bg: '#f9731615' },
  medium:   { label: 'Medium',   color: '#f59e0b', bg: '#f59e0b15' },
  low:      { label: 'Low',      color: '#3b82f6', bg: '#3b82f615' },
  info:     { label: 'Info',     color: '#94a3b8', bg: '#94a3b815' },
}
function sevMeta(sev: string) {
  return SEV_META[sev as keyof typeof SEV_META] ?? { label: sev || 'Unknown', color: '#94a3b8', bg: '#94a3b815' }
}

const MODULE_LABELS: Record<AiInsight['module'], string> = {
  predictive_maintenance: 'Predictive Maint.',
  anomaly_detection:      'Anomaly Detection',
  schedule_risk:          'Schedule Risk',
  cost_overrun:           'Cost Overrun',
  safety:                 'Safety',
}

const CAT_LABELS: Record<MarketplaceProvider['category'], string> = {
  data_feed: 'Data Feed', analytics: 'Analytics', epc_tool: 'EPC Tool',
  compliance: 'Compliance', finance: 'Finance', field_service: 'Field Service',
}

const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#22c55e']

function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={color ? { color } : {}}>{value}</p>
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

function InsightCard({ insight, onUpdate }: { insight: AiInsight; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false)
  const { color, bg, label } = sevMeta(insight.severity)
  const isOpen = insight.status === 'open'

  async function ack() { setBusy(true); await acknowledgeInsightAction(insight.id); onUpdate(); setBusy(false) }
  async function dismiss() { setBusy(true); await dismissInsightAction(insight.id); onUpdate(); setBusy(false) }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: bg, color }}>{label}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{MODULE_LABELS[insight.module]}</span>
          <span className="text-xs text-muted-foreground">{insight.confidence}% confidence</span>
        </div>
        <span className={cn('text-[10px] font-medium capitalize px-2 py-0.5 rounded-full',
          insight.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600' :
          insight.status === 'acknowledged' ? 'bg-blue-500/10 text-blue-600' :
          insight.status === 'dismissed' ? 'bg-muted text-muted-foreground' : 'bg-orange-500/10 text-orange-600')}>
          {insight.status}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{insight.title}</p>
        <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
      </div>
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Recommended Action</p>
        <p className="text-xs text-foreground">{insight.recommended_action}</p>
      </div>
      {isOpen && (
        <div className="flex gap-2 pt-1">
          <button disabled={busy} onClick={ack}
            className="text-xs px-3 py-1 rounded border border-blue-500/50 text-blue-600 hover:bg-blue-500/10 disabled:opacity-40 transition-colors">
            Acknowledge
          </button>
          <button disabled={busy} onClick={dismiss}
            className="text-xs px-3 py-1 rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors">
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

function ProviderCard({ provider, onUpdate }: { provider: MarketplaceProvider; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false)

  async function connect() { setBusy(true); await connectProviderAction(provider.id); onUpdate(); setBusy(false) }

  const statusColor = provider.status === 'connected' ? '#22c55e' : provider.status === 'pending' ? '#f59e0b' : '#94a3b8'

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{provider.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{CAT_LABELS[provider.category]} · {provider.integration_type.replace('_', ' ').toUpperCase()}</p>
        </div>
        <span className="text-xs font-medium capitalize" style={{ color: statusColor }}>{provider.status}</span>
      </div>
      <p className="text-xs text-muted-foreground">{provider.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Star className="size-3 fill-amber-400 text-amber-400" />
          <span className="text-xs font-medium">{provider.rating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">({provider.review_count})</span>
        </div>
        {provider.status === 'available' && (
          <button disabled={busy} onClick={connect}
            className="text-xs px-3 py-1 rounded border border-primary/50 text-primary hover:bg-primary/10 disabled:opacity-40 flex items-center gap-1 transition-colors">
            <Plug className="size-3" />
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        )}
        {provider.status === 'connected' && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="size-3" /> Connected
          </span>
        )}
      </div>
    </div>
  )
}

export function AiInsightsPage() {
  const [tab, setTab] = useState<'insights' | 'marketplace'>('insights')
  const { data, mutate, isLoading } = useSWR('ai-marketplace-dashboard', loadAiMarketplaceDashboard)

  const isLive = (data?.insights.length ?? 0) > 0 || (data?.providers.length ?? 0) > 0
  const s = data?.insightStats

  const sevData = (data?.bySeverity ?? []).map((r, i) => ({
    name: SEV_META[r.severity as AiInsight['severity']]?.label ?? r.severity,
    value: r.count,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const modData = (data?.byModule ?? []).map(r => ({
    module: MODULE_LABELS[r.module as AiInsight['module']] ?? r.module,
    count: r.count,
  }))

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="size-6 text-primary" />
            AI Insights & Marketplace
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Predictive maintenance, anomaly detection, and integration marketplace</p>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge live={isLive} />
          <Button size="sm" variant="ghost" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Open Insights"    value={s?.open ?? 0}         color="#f97316" />
        <KpiCard label="Critical"         value={s?.critical ?? 0}      color="#ef4444" />
        <KpiCard label="Acknowledged"     value={s?.acknowledged ?? 0}  color="#3b82f6" />
        <KpiCard label="Resolved"         value={s?.resolved ?? 0}      color="#22c55e" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-3">Insights by Module</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={modData.length ? modData : [
              { module: 'Predictive Maint.', count: 3 },
              { module: 'Anomaly Detection', count: 2 },
              { module: 'Schedule Risk', count: 2 },
              { module: 'Cost Overrun', count: 1 },
              { module: 'Safety', count: 2 },
            ]} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="module" tick={{ fontSize: 10 }} width={120} />
              <Tooltip />
              <Bar dataKey="count" name="Insights" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-3">Severity Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={sevData.length ? sevData : [
                  { name: 'Critical', value: 2, fill: '#ef4444' },
                  { name: 'High',     value: 3, fill: '#f97316' },
                  { name: 'Medium',   value: 3, fill: '#f59e0b' },
                  { name: 'Low',      value: 1, fill: '#3b82f6' },
                ]}
                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {(sevData.length ? sevData : [
                  { fill: '#ef4444' }, { fill: '#f97316' }, { fill: '#f59e0b' }, { fill: '#3b82f6' },
                ]).map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['insights', 'marketplace'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {t === 'insights' ? `AI Insights (${data?.insights.length ?? 0})` : `Marketplace (${data?.providers.length ?? 0})`}
          </button>
        ))}
      </div>

      {tab === 'insights' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(data?.insights ?? []).filter(i => i.status !== 'dismissed').map(i => (
            <InsightCard key={i.id} insight={i} onUpdate={() => mutate()} />
          ))}
          {!data?.insights.length && (
            <div className="col-span-2 py-12 text-center text-muted-foreground text-sm">
              No AI insights yet — seed demo data to populate
            </div>
          )}
        </div>
      )}

      {tab === 'marketplace' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.providers ?? []).map(p => (
            <ProviderCard key={p.id} provider={p} onUpdate={() => mutate()} />
          ))}
          {!data?.providers.length && (
            <div className="col-span-3 py-12 text-center text-muted-foreground text-sm">
              No providers yet — seed demo data
            </div>
          )}
        </div>
      )}
    </div>
  )
}
