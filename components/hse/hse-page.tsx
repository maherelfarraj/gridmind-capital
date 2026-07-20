'use client'

import * as React from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  HardHat,
  Activity,
  ClipboardList,
  CheckSquare,
  XCircle,
  Clock,
  Filter,
  Plus,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────

type IncidentSeverity = 'fatality' | 'ltif' | 'mtc' | 'near-miss' | 'observation'
type IncidentStatus   = 'open' | 'under-investigation' | 'closed'

interface IncidentRecord {
  id: string
  ref: string
  title: string
  projectCode: string
  severity: IncidentSeverity
  status: IncidentStatus
  date: string
  reportedBy: string
  location: string
  description: string
  actionCount: number
  closedActions: number
}

interface PermitRecord {
  id: string
  ref: string
  type: string
  scope: string
  projectCode: string
  issuedTo: string
  issuedDate: string
  expiryDate: string
  status: 'active' | 'expired' | 'cancelled' | 'pending'
}

// ─── Mock data ────────────────────────────────────────────────

const INCIDENTS: IncidentRecord[] = [
  {
    id: 'i1', ref: 'NM-22', title: 'Scaffolding Collapse — Grid Connection Point',
    projectCode: 'CRS-150', severity: 'near-miss', status: 'under-investigation',
    date: '19 Jul 2025', reportedBy: 'L. Schmidt', location: 'Zone 4 — Turbine Row C',
    description: 'Scaffolding section collapsed during high-wind event (45km/h). No injuries. Root cause: weather monitoring protocol gap identified.',
    actionCount: 5, closedActions: 2,
  },
  {
    id: 'i2', ref: 'OBS-47', title: 'Unsecured Tools on Elevated Platform',
    projectCode: 'SRS-400', severity: 'observation', status: 'closed',
    date: '17 Jul 2025', reportedBy: 'M. Al-Farsi', location: 'Inverter Station B',
    description: 'Tools not secured to tool lanyards on platform at 4.5m elevation. Corrected on-site immediately.',
    actionCount: 1, closedActions: 1,
  },
  {
    id: 'i3', ref: 'MTC-08', title: 'Hand Laceration — Wire Rope Handling',
    projectCode: 'NOV-600', severity: 'mtc', status: 'closed',
    date: '12 Jul 2025', reportedBy: 'T. Müller', location: 'Offshore Platform Alpha',
    description: 'Worker sustained laceration to left hand while handling wire rope without cut-resistant gloves. First aid administered. Returned to duty same day.',
    actionCount: 3, closedActions: 3,
  },
  {
    id: 'i4', ref: 'OBS-44', title: 'Missing Barricading Around Excavation',
    projectCode: 'ATL-300', severity: 'observation', status: 'closed',
    date: '08 Jul 2025', reportedBy: 'J. Rivera', location: 'Cable Trench Section 12',
    description: 'Open excavation trench lacked adequate barricading at site entrance. Barriers reinstated immediately.',
    actionCount: 2, closedActions: 2,
  },
  {
    id: 'i5', ref: 'NM-21', title: 'Near-Miss — Crane Swing Arc Intrusion',
    projectCode: 'ORN-180', severity: 'near-miss', status: 'open',
    date: '02 Jul 2025', reportedBy: 'A. Patel', location: 'Assembly Area Row 7',
    description: 'Personnel entered crane exclusion zone during tower section lift. No contact made. Exclusion zone protocol under review.',
    actionCount: 4, closedActions: 1,
  },
]

const PERMITS: PermitRecord[] = [
  { id: 'p1', ref: 'PTW-4801', type: 'Work at Height',     scope: 'Scaffold erection — Zone A',          projectCode: 'SRS-400', issuedTo: 'M. Al-Farsi', issuedDate: '20 Jul 2025', expiryDate: '21 Jul 2025', status: 'active'    },
  { id: 'p2', ref: 'PTW-4799', type: 'Confined Space',     scope: 'Inverter pit inspection',              projectCode: 'SRS-400', issuedTo: 'R. Chen',     issuedDate: '19 Jul 2025', expiryDate: '19 Jul 2025', status: 'expired'   },
  { id: 'p3', ref: 'PTW-4795', type: 'Hot Work',           scope: 'Welding — substation frame',           projectCode: 'ATL-300', issuedTo: 'J. Rivera',   issuedDate: '18 Jul 2025', expiryDate: '18 Jul 2025', status: 'expired'   },
  { id: 'p4', ref: 'PTW-4810', type: 'Electrical Isolation','scope': 'MV switchgear maintenance',          projectCode: 'SRS-400', issuedTo: 'M. Al-Farsi', issuedDate: '20 Jul 2025', expiryDate: '22 Jul 2025', status: 'active'    },
  { id: 'p5', ref: 'PTW-4780', type: 'Excavation',         scope: 'Cable trench section 14-18',           projectCode: 'CRS-150', issuedTo: 'L. Schmidt',  issuedDate: '15 Jul 2025', expiryDate: '17 Jul 2025', status: 'cancelled' },
  { id: 'p6', ref: 'PTW-4815', type: 'Marine Operations',  scope: 'Foundation installation vessel ops',   projectCode: 'NOV-600', issuedTo: 'T. Müller',   issuedDate: '21 Jul 2025', expiryDate: '25 Jul 2025', status: 'pending'   },
]

// ─── Config maps ──────────────────────────────────────────────

const SEVERITY_META: Record<IncidentSeverity, { label: string; color: string; icon: React.ElementType }> = {
  fatality:    { label: 'Fatality',    color: '#1e1e2e', icon: AlertOctagon  },
  ltif:        { label: 'LTIF',        color: '#ef4444', icon: AlertOctagon  },
  mtc:         { label: 'MTC',         color: '#f97316', icon: AlertTriangle },
  'near-miss': { label: 'Near-Miss',   color: '#f59e0b', icon: AlertTriangle },
  observation: { label: 'Observation', color: '#3b82f6', icon: Activity      },
}

const PERMIT_STATUS_META: Record<PermitRecord['status'], { label: string; color: string }> = {
  active:    { label: 'Active',     color: '#22c55e' },
  expired:   { label: 'Expired',    color: '#ef4444' },
  cancelled: { label: 'Cancelled',  color: '#94a3b8' },
  pending:   { label: 'Pending',    color: '#f59e0b' },
}

// ─── Incident Row (expandable) ────────────────────────────────

function IncidentRow({ item }: { item: IncidentRecord }) {
  const [open, setOpen] = React.useState(false)
  const meta = SEVERITY_META[item.severity]
  const Icon = meta.icon
  const actionPct = item.actionCount > 0 ? Math.round((item.closedActions / item.actionCount) * 100) : 100

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: `${meta.color}18` }}>
          <Icon className="size-4" style={{ color: meta.color }} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-mono text-xs text-[#64ffda]">{item.ref}</span>
            <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="font-mono text-[#64ffda]/80">{item.projectCode}</span>
            <span>{item.date}</span>
            <span>{item.location}</span>
            <span>by {item.reportedBy}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded"
            style={{ color: meta.color, backgroundColor: `${meta.color}18` }}>
            {meta.label}
          </span>
          <span className={cn(
            'text-[11px] font-medium px-2 py-0.5 rounded',
            item.status === 'closed'               ? 'bg-[#22c55e]/10 text-[#22c55e]' :
            item.status === 'under-investigation'   ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                                                     'bg-[#ef4444]/10 text-[#ef4444]',
          )}>
            {item.status === 'under-investigation' ? 'Investigating' : item.status === 'closed' ? 'Closed' : 'Open'}
          </span>
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 bg-muted/10 border-t border-border/50 space-y-3">
          <p className="text-sm text-muted-foreground">{item.description}</p>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Corrective actions: {item.closedActions}/{item.actionCount} closed</span>
              <span className="text-xs font-semibold text-foreground">{actionPct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full">
              <div className="h-1.5 rounded-full bg-[#22c55e] transition-all" style={{ width: `${actionPct}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────

function StatTile({ value, label, color, icon: Icon }: {
  value: number | string; label: string; color: string; icon: React.ElementType
}) {
  return (
    <div className="flex-1 min-w-[130px] rounded-xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="size-4" style={{ color }} aria-hidden />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function HsePage() {
  const { toast: addToast } = useToast()
  const [tab, setTab] = React.useState<'incidents' | 'permits'>('incidents')
  const [severityFilter, setSeverityFilter] = React.useState<IncidentSeverity | 'all'>('all')

  const openIncidents     = INCIDENTS.filter((i) => i.status !== 'closed').length
  const nearMissCount     = INCIDENTS.filter((i) => i.severity === 'near-miss').length
  const observationCount  = INCIDENTS.filter((i) => i.severity === 'observation').length
  const activePermits     = PERMITS.filter((p) => p.status === 'active').length
  const expiredPermits    = PERMITS.filter((p) => p.status === 'expired').length

  const filteredIncidents = INCIDENTS.filter((i) =>
    severityFilter === 'all' || i.severity === severityFilter
  )

  const TABS = [
    { id: 'incidents' as const, label: `Incidents (${INCIDENTS.length})` },
    { id: 'permits'   as const, label: `Permits (${PERMITS.length})`    },
  ]

  const SEVERITY_FILTERS: { id: IncidentSeverity | 'all'; label: string }[] = [
    { id: 'all',        label: 'All' },
    { id: 'near-miss',  label: 'Near-Miss' },
    { id: 'mtc',        label: 'MTC' },
    { id: 'observation',label: 'Observation' },
    { id: 'ltif',       label: 'LTIF' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Health, Safety & Environment</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Incident register, permits to work, and safety performance</p>
        </div>
        <Button variant="default" size="sm" onClick={() => addToast({ title: 'Report Incident', description: 'Incident reporting form will open in the full app.', variant: 'info' })}>
          <Plus className="size-4" aria-hidden />
          Report Incident
        </Button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3" role="region" aria-label="HSE statistics">
        <StatTile value={0}              label="LTIF Rate"      color="#22c55e" icon={ShieldCheck}    />
        <StatTile value={openIncidents}  label="Open Incidents" color={openIncidents > 0 ? '#ef4444' : '#22c55e'} icon={AlertTriangle} />
        <StatTile value={nearMissCount}  label="Near-Misses"    color="#f59e0b" icon={AlertTriangle}  />
        <StatTile value={observationCount} label="Observations" color="#3b82f6" icon={Activity}       />
        <StatTile value={activePermits}  label="Active Permits" color="#22c55e" icon={ClipboardList}  />
        <StatTile value={expiredPermits} label="Expired PTWs"   color={expiredPermits > 0 ? '#ef4444' : '#22c55e'} icon={XCircle} />
      </div>

      {/* Days without incident banner */}
      <div className="flex items-center gap-4 rounded-xl bg-[#22c55e]/8 border border-[#22c55e]/20 px-5 py-4">
        <div className="size-12 rounded-full bg-[#22c55e]/15 flex items-center justify-center shrink-0">
          <HardHat className="size-6 text-[#22c55e]" aria-hidden />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">47 <span className="text-base font-normal text-muted-foreground">days without a recordable incident</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Last recordable: MTC-07 — 03 Jun 2025 — Orion Wind Farm</p>
        </div>
      </div>

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

      {/* Incidents list */}
      {tab === 'incidents' && (
        <div className="space-y-3">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="size-3.5 text-muted-foreground" aria-hidden />
            {SEVERITY_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSeverityFilter(id)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  severityFilter === id
                    ? 'bg-[#64ffda]/10 border-[#64ffda]/40 text-[#64ffda]'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              {filteredIncidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <ShieldCheck className="size-12 text-[#22c55e] mb-3" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">No incidents found</p>
                </div>
              ) : (
                filteredIncidents.map((i) => <IncidentRow key={i.id} item={i} />)
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permits table */}
      {tab === 'permits' && (
        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm" role="table" aria-label="Permits to work">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Ref</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Scope</th>
                  <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">Issued To</th>
                  <th className="px-4 py-2.5 text-right font-semibold hidden lg:table-cell">Expiry</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {PERMITS.map((p) => {
                  const pMeta = PERMIT_STATUS_META[p.status]
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-[#64ffda]">{p.ref}</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-foreground">{p.type}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground max-w-[220px] truncate">{p.scope}</td>
                      <td className="px-4 py-2.5 text-sm text-foreground hidden md:table-cell">{p.issuedTo}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground text-right hidden lg:table-cell">{p.expiryDate}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                          style={{ color: pMeta.color, backgroundColor: `${pMeta.color}18` }}>
                          {pMeta.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
