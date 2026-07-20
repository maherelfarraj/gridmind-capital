'use client'

import * as React from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  GitMerge,
  DollarSign,
  FileText,
  Shield,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ExternalLink,
  Filter,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  MOCK_APPROVALS,
  type ApprovalItem,
  type ApprovalType,
} from '@/components/dashboard/dashboard-data'

// ─── Types ────────────────────────────────────────────────────

type FilterStatus = 'all' | 'overdue' | 'pending' | 'recent'
type FilterType = 'all' | ApprovalType

interface ApprovalRecord extends ApprovalItem {
  submittedDate: string
  description: string
  amount?: string
  attachments: number
  comments: number
  reviewers: { name: string; initials: string; color: string; decision?: 'approved' | 'rejected' | 'pending' }[]
}

// ─── Mock data ────────────────────────────────────────────────

const APPROVALS: ApprovalRecord[] = [
  {
    id: 'a1', type: 'gate-review', title: 'G5 Gate Review — Construction Mobilization',
    projectCode: 'SRS-400', projectName: 'Sirius 400MW Solar Farm',
    requestedBy: 'J. Rivera', daysOpen: 8, isOverdue: true, priority: 'critical',
    submittedDate: '12 Jul 2025', description: 'Formal convening of G5 gate review following mechanical completion milestone. All Cat-A punch items closed. IFC drawings released 100%.',
    amount: undefined, attachments: 14, comments: 6,
    reviewers: [
      { name: 'A. Carter', initials: 'AC', color: '#64ffda', decision: 'pending' },
      { name: 'T. Müller', initials: 'TM', color: '#3b82f6', decision: 'pending' },
      { name: 'R. Chen',   initials: 'RC', color: '#8b5cf6', decision: 'approved' },
    ],
  },
  {
    id: 'a2', type: 'budget-variance', title: '+$12.4M Cost Variance — Weather Delay',
    projectCode: 'NOV-600', projectName: 'Nova Offshore Wind 600MW',
    requestedBy: 'T. Müller', daysOpen: 5, isOverdue: true, priority: 'high',
    submittedDate: '15 Jul 2025', description: 'Extended weather window caused 6-week marine installation delay. Requesting $12.4M contingency release for extended vessel charter and crew costs.',
    amount: '$12.4M', attachments: 8, comments: 4,
    reviewers: [
      { name: 'A. Carter', initials: 'AC', color: '#64ffda', decision: 'pending' },
      { name: 'S. Park',   initials: 'SP', color: '#a855f7', decision: 'pending' },
    ],
  },
  {
    id: 'a3', type: 'change-order', title: 'CO-041 Inverter Substitution — SMA → Huawei',
    projectCode: 'ATL-300', projectName: 'Atlas Solar PV 300MW',
    requestedBy: 'M. Al-Farsi', daysOpen: 3, isOverdue: false, priority: 'high',
    submittedDate: '17 Jul 2025', description: 'SMA Solar no longer able to supply within schedule. Proposing Huawei SUN2000 as equivalent substitute. Cost-neutral. QA pre-qualification complete.',
    amount: '$0 net', attachments: 5, comments: 2,
    reviewers: [
      { name: 'A. Carter', initials: 'AC', color: '#64ffda', decision: 'pending' },
    ],
  },
  {
    id: 'a4', type: 'contract', title: 'EPC Sub-contract Award — Civil & Earthworks',
    projectCode: 'SOL-500', projectName: 'Sol Atacama 500MW',
    requestedBy: 'R. Chen', daysOpen: 2, isOverdue: false, priority: 'medium',
    submittedDate: '18 Jul 2025', description: 'Award recommendation for civil and earthworks sub-contract to Construcciones Andinas SA following competitive tender. Lowest evaluated bid within budget.',
    amount: '$38.2M', attachments: 11, comments: 1,
    reviewers: [
      { name: 'A. Carter', initials: 'AC', color: '#64ffda', decision: 'pending' },
      { name: 'L. Schmidt', initials: 'LS', color: '#22c55e', decision: 'approved' },
    ],
  },
  {
    id: 'a5', type: 'hse-incident', title: 'Near-Miss Investigation Report #NM-22',
    projectCode: 'CRS-150', projectName: 'Ceres Wind Repowering',
    requestedBy: 'L. Schmidt', daysOpen: 1, isOverdue: false, priority: 'medium',
    submittedDate: '19 Jul 2025', description: 'Scaffolding section collapsed near grid connection point during high-wind event (>45km/h). No injuries. Root cause: weather monitoring protocol gap.',
    amount: undefined, attachments: 3, comments: 3,
    reviewers: [
      { name: 'A. Carter', initials: 'AC', color: '#64ffda', decision: 'pending' },
      { name: 'J. Rivera', initials: 'JR', color: '#f97316', decision: 'approved' },
    ],
  },
  {
    id: 'a6', type: 'budget-variance', title: 'Contingency Draw-Down — Grid Tie-in Works',
    projectCode: 'ORN-180', projectName: 'Orion Wind Farm',
    requestedBy: 'A. Patel', daysOpen: 1, isOverdue: false, priority: 'low',
    submittedDate: '19 Jul 2025', description: 'Additional grid tie-in scope identified during detailed design. Requesting $2.1M contingency draw for revised substation interface works.',
    amount: '$2.1M', attachments: 4, comments: 0,
    reviewers: [
      { name: 'A. Carter', initials: 'AC', color: '#64ffda', decision: 'pending' },
    ],
  },
  {
    id: 'a7', type: 'change-order', title: 'CO-019 Cable Route Deviation — Zone 4',
    projectCode: 'VEG-400', projectName: 'Vega BESS Storage',
    requestedBy: 'S. Park', daysOpen: 0, isOverdue: false, priority: 'low',
    submittedDate: '20 Jul 2025', description: 'Underground obstruction encountered. Cable route deviation of 340m required. No cost impact. Schedule impact: +3 days.',
    amount: '$0 net', attachments: 2, comments: 0,
    reviewers: [
      { name: 'A. Carter', initials: 'AC', color: '#64ffda', decision: 'pending' },
    ],
  },
]

// ─── Lookup maps ──────────────────────────────────────────────

const TYPE_META: Record<ApprovalType, { label: string; icon: React.ElementType; color: string }> = {
  'gate-review':      { label: 'Gate Review',      icon: GitMerge,    color: '#64ffda' },
  'budget-variance':  { label: 'Budget Variance',  icon: DollarSign,  color: '#f59e0b' },
  'change-order':     { label: 'Change Order',     icon: FileText,    color: '#3b82f6' },
  'contract':         { label: 'Contract',         icon: FileText,    color: '#8b5cf6' },
  'hse-incident':     { label: 'HSE Incident',     icon: Shield,      color: '#ef4444' },
}

const PRIORITY_BADGE: Record<string, React.ReactElement> = {
  critical: <Badge variant="critical" dot>Critical</Badge>,
  high:     <Badge variant="high"     dot>High</Badge>,
  medium:   <Badge variant="medium"   dot>Medium</Badge>,
  low:      <Badge variant="low"      dot>Low</Badge>,
}

// ─── Approval Row (expandable) ────────────────────────────────

function ApprovalRow({ item, onApprove, onReject }: {
  item: ApprovalRecord
  onApprove: (id: string) => void
  onReject:  (id: string) => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const meta = TYPE_META[item.type]
  const Icon = meta.icon

  return (
    <div
      className={cn(
        'border-b border-border last:border-0 transition-colors duration-150',
        item.isOverdue && 'bg-[#ef4444]/3',
      )}
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
      >
        {/* Type icon */}
        <div
          className="mt-0.5 shrink-0 size-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${meta.color}18` }}
        >
          <Icon className="size-4" style={{ color: meta.color }} aria-hidden />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground leading-tight">{item.title}</span>
            {item.isOverdue && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-[#ef4444]">
                <AlertTriangle className="size-3" aria-hidden />
                {item.daysOpen}d overdue
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="font-mono text-[#64ffda]">{item.projectCode}</span>
            <span>{item.projectName}</span>
            <span>by {item.requestedBy}</span>
            <span>{item.submittedDate}</span>
            {item.amount && <span className="font-semibold text-foreground">{item.amount}</span>}
          </div>
        </div>

        {/* Right side */}
        <div className="shrink-0 flex items-center gap-2">
          {PRIORITY_BADGE[item.priority]}
          <ChevronDown
            className={cn('size-4 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')}
            aria-hidden
          />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/50 bg-muted/20">
          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>

          {/* Meta strip */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileText className="size-3.5" aria-hidden />
              {item.attachments} attachments
            </span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="size-3.5" aria-hidden />
              {item.comments} comments
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden />
              Open {item.daysOpen === 0 ? 'today' : `${item.daysOpen}d`}
            </span>
          </div>

          {/* Reviewers */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Reviewers</p>
            <div className="flex flex-wrap gap-2">
              {item.reviewers.map((r) => (
                <div key={r.name} className="flex items-center gap-1.5 rounded-full bg-background border border-border px-2.5 py-1">
                  <span
                    className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: `${r.color}30`, color: r.color }}
                    aria-hidden
                  >
                    {r.initials}
                  </span>
                  <span className="text-xs text-foreground">{r.name}</span>
                  {r.decision === 'approved' && <CheckCircle2 className="size-3.5 text-[#22c55e]" aria-label="Approved" />}
                  {r.decision === 'rejected' && <XCircle    className="size-3.5 text-[#ef4444]" aria-label="Rejected" />}
                  {r.decision === 'pending'  && <Clock      className="size-3.5 text-[#f59e0b]" aria-label="Pending"  />}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="success"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onApprove(item.id) }}
              aria-label={`Approve ${item.title}`}
            >
              <CheckCircle2 className="size-3.5" aria-hidden />
              Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onReject(item.id) }}
              aria-label={`Reject ${item.title}`}
            >
              <XCircle className="size-3.5" aria-hidden />
              Reject
            </Button>
            <Button variant="ghost" size="sm">
              <MessageSquare className="size-3.5" aria-hidden />
              Comment
            </Button>
            <Button variant="ghost" size="sm">
              <ExternalLink className="size-3.5" aria-hidden />
              Open Project
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: number | string; sub?: string; color: string
}) {
  return (
    <div
      className="flex-1 min-w-[120px] rounded-xl bg-card border border-border p-4"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function ApprovalsPage() {
  const { toast: addToast } = useToast()
  const [items, setItems] = React.useState<ApprovalRecord[]>(APPROVALS)
  const [statusFilter, setStatusFilter] = React.useState<FilterStatus>('all')
  const [typeFilter, setTypeFilter] = React.useState<FilterType>('all')
  const [loading, setLoading] = React.useState(false)

  // Derived stats
  const overdue  = items.filter((i) => i.isOverdue).length
  const critical = items.filter((i) => i.priority === 'critical').length
  const gateCount = items.filter((i) => i.type === 'gate-review').length
  const budgetCount = items.filter((i) => i.type === 'budget-variance').length

  // Filtered list
  const filtered = React.useMemo(() => {
    return items
      .filter((i) => {
        if (statusFilter === 'overdue') return i.isOverdue
        if (statusFilter === 'pending') return !i.isOverdue
        if (statusFilter === 'recent')  return i.daysOpen <= 1
        return true
      })
      .filter((i) => typeFilter === 'all' || i.type === typeFilter)
      .sort((a, b) => {
        const pMap = { critical: 0, high: 1, medium: 2, low: 3 }
        return pMap[a.priority] - pMap[b.priority]
      })
  }, [items, statusFilter, typeFilter])

  function handleApprove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    addToast({ title: 'Approved', description: 'Decision recorded and stakeholders notified.', variant: 'success' })
  }

  function handleReject(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    addToast({ title: 'Rejected', description: 'Decision recorded and requestor notified.', variant: 'danger' })
  }

  function handleRefresh() {
    setLoading(true)
    setTimeout(() => setLoading(false), 1200)
    addToast({ title: 'Refreshed', description: 'Approval queue is up to date.', variant: 'info' })
  }

  const STATUS_TABS: { id: FilterStatus; label: string; count?: number }[] = [
    { id: 'all',     label: 'All',      count: items.length },
    { id: 'overdue', label: 'Overdue',  count: overdue },
    { id: 'pending', label: 'Pending',  count: items.filter((i) => !i.isOverdue).length },
    { id: 'recent',  label: 'Today',    count: items.filter((i) => i.daysOpen <= 1).length },
  ]

  const TYPE_TABS: { id: FilterType; label: string }[] = [
    { id: 'all',             label: 'All Types' },
    { id: 'gate-review',     label: 'Gate Reviews' },
    { id: 'budget-variance', label: 'Budget Variance' },
    { id: 'change-order',    label: 'Change Orders' },
    { id: 'contract',        label: 'Contracts' },
    { id: 'hse-incident',    label: 'HSE' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and action pending approvals across all projects
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} loading={loading}>
          <RefreshCw className="size-4" aria-hidden />
          Refresh
        </Button>
      </div>

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3" role="region" aria-label="Approval statistics">
        <StatCard label="Total Pending"   value={items.length}  color="#64ffda" />
        <StatCard label="Overdue"         value={overdue}       color="#ef4444" sub={overdue > 0 ? 'Action required' : 'All on time'} />
        <StatCard label="Critical"        value={critical}      color="#f97316" />
        <StatCard label="Gate Reviews"    value={gateCount}     color="#64ffda" />
        <StatCard label="Budget Items"    value={budgetCount}   color="#f59e0b" />
      </div>

      {/* Status filter tabs */}
      <div
        role="tablist"
        aria-label="Filter by status"
        className="flex gap-1 flex-wrap border-b border-border pb-0"
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={statusFilter === tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 flex items-center gap-1.5',
              statusFilter === tab.id
                ? 'border-[#64ffda] text-[#64ffda]'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                statusFilter === tab.id ? 'bg-[#64ffda]/15 text-[#64ffda]' : 'bg-muted text-muted-foreground',
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="size-3.5 text-muted-foreground shrink-0" aria-hidden />
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors duration-150',
              typeFilter === tab.id
                ? 'bg-[#64ffda]/10 border-[#64ffda]/40 text-[#64ffda]'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <Card>
        <CardHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {filtered.length} {statusFilter !== 'all' ? STATUS_TABS.find(t => t.id === statusFilter)?.label : ''} approval{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
          {overdue > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#ef4444]">
              <AlertTriangle className="size-3.5" aria-hidden />
              {overdue} require immediate action
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <CheckCircle2 className="size-12 text-[#22c55e] mb-3" aria-hidden />
              <p className="text-base font-semibold text-foreground">All clear</p>
              <p className="text-sm text-muted-foreground mt-1">No approvals match your current filters.</p>
            </div>
          ) : (
            <div role="list" aria-label="Approval items">
              {filtered.map((item) => (
                <div key={item.id} role="listitem">
                  <ApprovalRow item={item} onApprove={handleApprove} onReject={handleReject} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
