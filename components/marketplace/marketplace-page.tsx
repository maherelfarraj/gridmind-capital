'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useClientNow } from '@/lib/hooks/use-client-now'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Plug, Star, RefreshCw, CheckCircle2, Clock, AlertTriangle,
  ArrowDownToLine, ArrowUpFromLine, Globe, Wifi, WifiOff, Activity,
  Search, Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  loadMarketplaceDashboard,
  connectProviderAction,
  disconnectProviderAction,
} from '@/app/actions/marketplace'
import type { MarketplaceProvider, IntegrationSystem, DataExchangeEvent } from '@/app/actions/marketplace'
import type { MarketplaceDashboard } from '@/app/actions/marketplace'

// ── Constants ────────────────────────────────────────────────────────────────

const CAT_LABELS: Record<MarketplaceProvider['category'], string> = {
  data_feed:     'Data Feed',
  analytics:     'Analytics',
  epc_tool:      'EPC Tool',
  compliance:    'Compliance',
  finance:       'Finance',
  field_service: 'Field Service',
}

const INT_TYPE_LABELS: Record<string, string> = {
  api: 'REST API', webhook: 'Webhook', file_import: 'File Import', oauth: 'OAuth 2.0',
}

const SYSTEM_TYPE_LABELS: Record<IntegrationSystem['type'], string> = {
  erp: 'ERP', scada: 'SCADA', gis: 'GIS', weather: 'Weather',
  finance: 'Finance', document: 'Document', identity: 'Identity',
}

const BAR_COLORS = ['#64ffda', '#3b82f6', '#f59e0b', '#22c55e', '#f97316', '#a855f7']
const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#94a3b8']

const ILLUSTRATIVE: MarketplaceDashboard = {
  providers: [],
  integrations: [],
  recentEvents: [],
  stats: { totalProviders: 8, connected: 2, available: 5, pending: 1, onlineSystems: 6, eventsToday: 2843 },
  byCategory: [
    { name: 'data_feed', value: 2 }, { name: 'analytics', value: 2 },
    { name: 'epc_tool', value: 1 }, { name: 'compliance', value: 1 },
    { name: 'finance', value: 1 }, { name: 'field_service', value: 1 },
  ],
  byStatus: [
    { name: 'available', value: 5, color: '#3b82f6' },
    { name: 'connected', value: 2, color: '#22c55e' },
    { name: 'pending',   value: 1, color: '#f59e0b' },
  ],
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LiveBadge({ live }: { live: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full',
      live ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500',
    )}>
      <span className={cn('size-1.5 rounded-full', live ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
      {live ? 'Live' : 'Illustrative'}
    </span>
  )
}

function KpiCard({ label, value, color, icon: Icon }: {
  label: string; value: string | number; color: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex-1 min-w-[130px] rounded-xl border border-border bg-card p-4"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <span style={{ color }} className="opacity-40">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}

function ProviderCard({ provider, onUpdate }: { provider: MarketplaceProvider; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    if (provider.status === 'connected') {
      await disconnectProviderAction(provider.id)
    } else {
      await connectProviderAction(provider.id)
    }
    onUpdate()
    setBusy(false)
  }

  const STATUS_META = {
    connected:  { label: 'Connected',  color: '#22c55e', bg: '#22c55e15' },
    available:  { label: 'Available',  color: '#3b82f6', bg: '#3b82f615' },
    pending:    { label: 'Pending',    color: '#f59e0b', bg: '#f59e0b15' },
    deprecated: { label: 'Deprecated', color: '#94a3b8', bg: '#94a3b815' },
  } as const
  type StatusKey = keyof typeof STATUS_META
  const statusMeta: (typeof STATUS_META)[StatusKey] =
    STATUS_META[provider.status as StatusKey] ?? { label: provider.status as string, color: '#94a3b8', bg: '#94a3b815' }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-border/80 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Globe className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{provider.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {CAT_LABELS[provider.category]} · {INT_TYPE_LABELS[provider.integration_type] ?? provider.integration_type}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: statusMeta.bg, color: statusMeta.color }}>
          {statusMeta.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">{provider.description}</p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <div className="flex items-center gap-1">
          <Star className="size-3 fill-amber-400 text-amber-400" />
          <span className="text-xs font-medium text-foreground">{provider.rating?.toFixed(1) ?? '—'}</span>
          <span className="text-xs text-muted-foreground">({provider.review_count ?? 0} reviews)</span>
        </div>
        {provider.status !== 'deprecated' && (
          <button
            type="button"
            disabled={busy}
            onClick={toggle}
            className={cn(
              'text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5',
              provider.status === 'connected'
                ? 'border border-red-500/30 text-red-500 hover:bg-red-500/10'
                : 'border border-primary/50 text-primary hover:bg-primary/10',
            )}
          >
            <Plug className="size-3" />
            {busy ? '...' : provider.status === 'connected' ? 'Disconnect' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  )
}

function SystemRow({ system }: { system: IntegrationSystem }) {
  const statusMeta = {
    online:          { label: 'Online',          color: '#22c55e', Icon: Wifi },
    degraded:        { label: 'Degraded',        color: '#f59e0b', Icon: AlertTriangle },
    offline:         { label: 'Offline',         color: '#ef4444', Icon: WifiOff },
    not_configured:  { label: 'Not configured',  color: '#94a3b8', Icon: WifiOff },
  }[system.status]

  // Mount-time clock: Date.now() during render is impure, so a "5s ago" ping
  // rendered on the server would not match the client's hydration render.
  const now = useClientNow(30_000)
  const lastPingAgo = system.last_ping && now !== null
    ? Math.round((now - new Date(system.last_ping).getTime()) / 1000)
    : null

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2.5">
          <span className="size-2 rounded-full shrink-0" style={{ background: statusMeta?.color }} />
          <span className="text-sm font-medium text-foreground">{system.name}</span>
        </div>
      </td>
      <td className="py-3 pr-4 text-xs text-muted-foreground">{SYSTEM_TYPE_LABELS[system.type]}</td>
      <td className="py-3 pr-4 text-xs text-muted-foreground">{system.vendor}</td>
      <td className="py-3 pr-4">
        <span className="text-xs font-medium" style={{ color: statusMeta?.color }}>{statusMeta?.label}</span>
      </td>
      <td className="py-3 pr-4 text-xs text-muted-foreground">
        {system.latency_ms != null ? `${system.latency_ms}ms` : '—'}
      </td>
      <td className="py-3 pr-4 text-xs text-muted-foreground">
        {lastPingAgo != null
          ? lastPingAgo < 60 ? `${lastPingAgo}s ago`
          : lastPingAgo < 3600 ? `${Math.round(lastPingAgo / 60)}m ago`
          : `${Math.round(lastPingAgo / 3600)}h ago`
          : '—'}
      </td>
      <td className="py-3 text-xs text-foreground text-right">{system.events_today.toLocaleString()}</td>
    </tr>
  )
}

function EventRow({ ev }: { ev: DataExchangeEvent }) {
  const statusMeta = {
    success: { color: '#22c55e', Icon: CheckCircle2 },
    failed:  { color: '#ef4444', Icon: AlertTriangle },
    pending: { color: '#f59e0b', Icon: Clock },
  }[ev.status]

  const ts = new Date(ev.timestamp)
  const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-1.5">
          {ev.direction === 'inbound'
            ? <ArrowDownToLine className="size-3 text-sky-400 shrink-0" />
            : <ArrowUpFromLine  className="size-3 text-violet-400 shrink-0" />}
          <span className="text-xs text-muted-foreground capitalize">{ev.direction}</span>
        </div>
      </td>
      <td className="py-2.5 pr-4 text-xs font-medium text-foreground">{ev.system}</td>
      <td className="py-2.5 pr-4 text-xs text-muted-foreground font-mono">{ev.event_type}</td>
      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{ev.payload_size_kb} KB</td>
      <td className="py-2.5 pr-4">
        {statusMeta && (
          <span className="flex items-center gap-1 text-xs font-medium capitalize" style={{ color: statusMeta.color }}>
            <statusMeta.Icon className="size-3" />
            {ev.status}
          </span>
        )}
      </td>
      <td className="py-2.5 text-xs text-muted-foreground text-right">{timeStr}</td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabId = 'providers' | 'integrations' | 'events'

export function MarketplacePage() {
  const [tab, setTab] = useState<TabId>('providers')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const { data, mutate, isLoading } = useSWR('marketplace-dashboard', loadMarketplaceDashboard)
  const d = data ?? (isLoading ? null : ILLUSTRATIVE)
  const isLive = (data?.providers.length ?? 0) > 0

  // Derived provider list
  const providers = isLive ? (data?.providers ?? []) : ILLUSTRATIVE_PROVIDERS
  const filteredProviders = providers.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const integrations = isLive ? (data?.integrations ?? INTEGRATION_FALLBACK) : INTEGRATION_FALLBACK
  const events = isLive ? (data?.recentEvents ?? EVENT_FALLBACK) : EVENT_FALLBACK

  const chartCategories = (d?.byCategory ?? []).map((r, i) => ({
    name: CAT_LABELS[r.name as MarketplaceProvider['category']] ?? r.name,
    value: r.value,
    fill: BAR_COLORS[i % BAR_COLORS.length],
  }))

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'providers',    label: 'Provider Directory', count: providers.length },
    { id: 'integrations', label: 'Integration Hub',    count: integrations.length },
    { id: 'events',       label: 'Data Exchange Log',  count: events.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Provider directory, integration hub and data exchange log
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LiveBadge live={isLive} />
          <button
            type="button"
            onClick={() => mutate()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {d && (
        <div className="flex flex-wrap gap-3">
          <KpiCard label="Total Providers"  value={d.stats.totalProviders} color="#64ffda" icon={Globe}         />
          <KpiCard label="Connected"        value={d.stats.connected}      color="#22c55e" icon={CheckCircle2}   />
          <KpiCard label="Available"        value={d.stats.available}      color="#3b82f6" icon={Plug}           />
          <KpiCard label="Pending"          value={d.stats.pending}        color="#f59e0b" icon={Clock}          />
          <KpiCard label="Online Systems"   value={d.stats.onlineSystems}  color="#22c55e" icon={Activity}       />
          <KpiCard label="Events Today"     value={d.stats.eventsToday.toLocaleString()} color="#6366f1" icon={Activity} />
        </div>
      )}

      {/* Charts */}
      {d && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Providers by Category</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartCategories.length ? chartCategories : [
                { name: 'Data Feed', value: 2, fill: '#64ffda' }, { name: 'Analytics', value: 2, fill: '#3b82f6' },
                { name: 'EPC Tool', value: 1, fill: '#f59e0b' },  { name: 'Finance', value: 1, fill: '#22c55e' },
              ]} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [v, 'Providers']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartCategories.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Provider Status</p>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={d.byStatus.length ? d.byStatus : [
                      { name: 'Available', value: 5, color: '#3b82f6' },
                      { name: 'Connected', value: 2, color: '#22c55e' },
                      { name: 'Pending',   value: 1, color: '#f59e0b' },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    outerRadius={72}
                    label={({ name, percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {(d.byStatus.length ? d.byStatus : [
                      { color: '#3b82f6' }, { color: '#22c55e' }, { color: '#f59e0b' },
                    ]).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, 'Providers']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2 shrink-0">
                {(d.byStatus.length ? d.byStatus : [
                  { name: 'Available', value: 5, color: '#3b82f6' },
                  { name: 'Connected', value: 2, color: '#22c55e' },
                  { name: 'Pending',   value: 1, color: '#f59e0b' },
                ]).map((s) => (
                  <li key={s.name} className="flex items-center gap-2 text-xs text-foreground capitalize">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    {s.name} <span className="text-muted-foreground ml-1">({s.value})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors relative',
              tab === t.id
                ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-2 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'providers' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search providers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-muted-foreground" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Categories</option>
                {Object.entries(CAT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="connected">Connected</option>
                <option value="available">Available</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filteredProviders.length} providers</span>
          </div>

          {filteredProviders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No providers match the current filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProviders.map((p) => (
                <ProviderCard key={p.id} provider={p} onUpdate={() => mutate()} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'integrations' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Integration Hub</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Live status of all connected enterprise systems</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-2.5 px-4">System</th>
                  <th className="text-left py-2.5 px-4">Type</th>
                  <th className="text-left py-2.5 px-4">Vendor</th>
                  <th className="text-left py-2.5 px-4">Status</th>
                  <th className="text-left py-2.5 px-4">Latency</th>
                  <th className="text-left py-2.5 px-4">Last Ping</th>
                  <th className="text-right py-2.5 px-4">Events Today</th>
                </tr>
              </thead>
              <tbody className="px-4">
                {integrations.map((sys) => (
                  <SystemRow key={sys.id} system={sys} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Data Exchange Log</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Recent inbound and outbound integration events</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><ArrowDownToLine className="size-3 text-sky-400" /> Inbound</span>
              <span className="flex items-center gap-1"><ArrowUpFromLine className="size-3 text-violet-400" /> Outbound</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-2.5 px-4">Direction</th>
                  <th className="text-left py-2.5 px-4">System</th>
                  <th className="text-left py-2.5 px-4">Event Type</th>
                  <th className="text-left py-2.5 px-4">Size</th>
                  <th className="text-left py-2.5 px-4">Status</th>
                  <th className="text-right py-2.5 px-4">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <EventRow key={ev.id} ev={ev} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Illustrative fallback data ────────────────────────────────────────────────

const ILLUSTRATIVE_PROVIDERS: MarketplaceProvider[] = [
  { id: 'p1', tenant_id: '', name: 'SolarEdge Monitoring API',  category: 'data_feed',    description: 'Real-time inverter telemetry and fault alerts.',              logo_url: null, integration_type: 'api',         status: 'connected', rating: 4.7, review_count: 312, created_at: '' },
  { id: 'p2', tenant_id: '', name: 'Meteomatics Weather',        category: 'data_feed',    description: 'High-resolution irradiance and weather forecasts.',            logo_url: null, integration_type: 'api',         status: 'available', rating: 4.5, review_count: 189, created_at: '' },
  { id: 'p3', tenant_id: '', name: 'DNV GL Energy Analytics',    category: 'analytics',    description: 'P50/P90 yield assessment and performance benchmarking.',        logo_url: null, integration_type: 'oauth',       status: 'available', rating: 4.8, review_count: 94,  created_at: '' },
  { id: 'p4', tenant_id: '', name: 'Procore Construction PM',    category: 'epc_tool',     description: 'RFIs, submittals, punch lists and daily field reports.',        logo_url: null, integration_type: 'api',         status: 'pending',   rating: 4.3, review_count: 1420, created_at: '' },
  { id: 'p5', tenant_id: '', name: 'SAP ERP Finance Bridge',     category: 'finance',      description: 'Bi-directional PO, invoice and commitment sync.',              logo_url: null, integration_type: 'api',         status: 'connected', rating: 4.0, review_count: 203, created_at: '' },
  { id: 'p6', tenant_id: '', name: 'Fieldwire Site Inspection',  category: 'field_service',description: 'Mobile punch list and inspection management.',                  logo_url: null, integration_type: 'api',         status: 'available', rating: 4.6, review_count: 578, created_at: '' },
  { id: 'p7', tenant_id: '', name: 'ISO 14001 Compliance Hub',   category: 'compliance',   description: 'Environmental management and regulatory reporting.',            logo_url: null, integration_type: 'file_import', status: 'available', rating: 3.9, review_count: 42,  created_at: '' },
  { id: 'p8', tenant_id: '', name: 'Enertiv Building Analytics', category: 'analytics',    description: 'Energy consumption benchmarking and anomaly detection.',        logo_url: null, integration_type: 'webhook',     status: 'available', rating: 4.1, review_count: 67,  created_at: '' },
]

import type { IntegrationSystem as IS, DataExchangeEvent as DE } from '@/app/actions/marketplace'
const INTEGRATION_FALLBACK: IS[] = [
  { id: 'sys-erp',     name: 'SAP S/4HANA',         type: 'erp',      vendor: 'SAP',           status: 'online',         last_ping: new Date(Date.now() -  45_000).toISOString(), latency_ms: 142,  events_today: 284  },
  { id: 'sys-scada',   name: 'SCADA / iFIX',         type: 'scada',    vendor: 'GE Digital',    status: 'online',         last_ping: new Date(Date.now() -  12_000).toISOString(), latency_ms: 28,   events_today: 1847 },
  { id: 'sys-gis',     name: 'ArcGIS Enterprise',    type: 'gis',      vendor: 'Esri',          status: 'online',         last_ping: new Date(Date.now() - 120_000).toISOString(), latency_ms: 310,  events_today: 37   },
  { id: 'sys-weather', name: 'Meteomatics API',       type: 'weather',  vendor: 'Meteomatics',   status: 'degraded',       last_ping: new Date(Date.now() - 900_000).toISOString(), latency_ms: 1840, events_today: 48   },
  { id: 'sys-finance', name: 'Oracle Financials',    type: 'finance',  vendor: 'Oracle',        status: 'online',         last_ping: new Date(Date.now() - 300_000).toISOString(), latency_ms: 198,  events_today: 92   },
  { id: 'sys-dms',     name: 'Aconex DMS',           type: 'document', vendor: 'Oracle Aconex', status: 'online',         last_ping: new Date(Date.now() -  60_000).toISOString(), latency_ms: 445,  events_today: 123  },
  { id: 'sys-idp',     name: 'Azure AD / Entra',     type: 'identity', vendor: 'Microsoft',     status: 'online',         last_ping: new Date(Date.now() -   5_000).toISOString(), latency_ms: 18,   events_today: 412  },
  { id: 'sys-epc',     name: 'Procore Construction', type: 'erp',      vendor: 'Procore',       status: 'not_configured', last_ping: null,                                          latency_ms: null, events_today: 0    },
]
const EVENT_FALLBACK: DE[] = [
  { id: 'ev-001', system: 'SAP S/4HANA',      direction: 'inbound',  event_type: 'purchase_order_sync',   payload_size_kb: 12.4, status: 'success', timestamp: new Date(Date.now() -   3 * 60_000).toISOString() },
  { id: 'ev-002', system: 'SCADA / iFIX',      direction: 'inbound',  event_type: 'telemetry_batch',        payload_size_kb: 284,  status: 'success', timestamp: new Date(Date.now() -   8 * 60_000).toISOString() },
  { id: 'ev-003', system: 'Meteomatics API',    direction: 'inbound',  event_type: 'irradiance_forecast',    payload_size_kb: 4.1,  status: 'failed',  timestamp: new Date(Date.now() -  15 * 60_000).toISOString() },
  { id: 'ev-004', system: 'Aconex DMS',         direction: 'outbound', event_type: 'document_transmittal',  payload_size_kb: 1820, status: 'success', timestamp: new Date(Date.now() -  22 * 60_000).toISOString() },
  { id: 'ev-005', system: 'Oracle Financials',  direction: 'inbound',  event_type: 'invoice_reconcile',     payload_size_kb: 8.7,  status: 'success', timestamp: new Date(Date.now() -  41 * 60_000).toISOString() },
  { id: 'ev-006', system: 'Azure AD / Entra',   direction: 'inbound',  event_type: 'user_provisioning',     payload_size_kb: 2.1,  status: 'success', timestamp: new Date(Date.now() -  67 * 60_000).toISOString() },
  { id: 'ev-007', system: 'ArcGIS Enterprise',  direction: 'outbound', event_type: 'asset_location_export', payload_size_kb: 45.6, status: 'success', timestamp: new Date(Date.now() - 120 * 60_000).toISOString() },
  { id: 'ev-008', system: 'Meteomatics API',    direction: 'inbound',  event_type: 'irradiance_forecast',   payload_size_kb: 4.1,  status: 'pending', timestamp: new Date(Date.now() - 180 * 60_000).toISOString() },
  { id: 'ev-009', system: 'SAP S/4HANA',        direction: 'outbound', event_type: 'commitment_push',       payload_size_kb: 6.3,  status: 'success', timestamp: new Date(Date.now() - 210 * 60_000).toISOString() },
  { id: 'ev-010', system: 'SCADA / iFIX',       direction: 'inbound',  event_type: 'alarm_event',           payload_size_kb: 0.8,  status: 'success', timestamp: new Date(Date.now() - 250 * 60_000).toISOString() },
]
