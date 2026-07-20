'use client'

import * as React from 'react'
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Flame,
  ClipboardCheck,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ApprovalStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'changes_requested'

export type SortOption = 'newest' | 'oldest' | 'due_soon'
export type FilterOption = 'all' | 'pending' | 'urgent' | 'escalated' | 'completed'

export interface ApprovalRecord {
  id: string
  object_type: string
  object_code: string
  status: ApprovalStatus
  level: number
  approver_role: string
  requested_by_name: string
  due_date: string | null
  created_at: string
  decided_at: string | null
  decision_reason: string | null
}

export interface ApprovalInboxProps {
  approvals?: ApprovalRecord[]
  filter?: FilterOption
  onFilterChange?: (filter: FilterOption) => void
  onApprovalClick?: (id: string) => void
  showFilters?: boolean
}

// ─────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────

const now = new Date()
const h = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString()
const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString()

export const MOCK_APPROVAL_INBOX: ApprovalRecord[] = [
  {
    id: 'ai-1',
    object_type: 'Purchase Order',
    object_code: 'PO-2026-001',
    status: 'pending',
    level: 1,
    approver_role: 'Project Manager',
    requested_by_name: 'Sarah Chen',
    due_date: h(2),                // due in 2h — URGENT
    created_at: ago(4),
    decided_at: null,
    decision_reason: null,
  },
  {
    id: 'ai-2',
    object_type: 'Project',
    object_code: 'PRJ-2026-002',
    status: 'under_review',
    level: 2,
    approver_role: 'Executive Sponsor',
    requested_by_name: 'Mike Ross',
    due_date: h(28),               // due tomorrow
    created_at: ago(20),
    decided_at: null,
    decision_reason: null,
  },
  {
    id: 'ai-3',
    object_type: 'Engineering Package',
    object_code: 'ENG-2026-003',
    status: 'approved',
    level: 1,
    approver_role: 'Engineering Manager',
    requested_by_name: 'Lisa Wang',
    due_date: null,
    created_at: ago(72),
    decided_at: ago(48),
    decision_reason: 'All deliverables met. Signed off.',
  },
  {
    id: 'ai-4',
    object_type: 'Purchase Order',
    object_code: 'PO-2026-004',
    status: 'escalated',
    level: 2,
    approver_role: 'PMO Director',
    requested_by_name: 'Tom Baker',
    due_date: h(6),
    created_at: ago(2),
    decided_at: null,
    decision_reason: null,
  },
  {
    id: 'ai-5',
    object_type: 'Project',
    object_code: 'PRJ-2026-005',
    status: 'changes_requested',
    level: 1,
    approver_role: 'Project Manager',
    requested_by_name: 'Sarah Chen',
    due_date: h(72),               // due in 3 days
    created_at: ago(24),
    decided_at: ago(6),
    decision_reason: 'Budget justification required.',
  },
]

// ─────────────────────────────────────────────────────────────
// Status meta
// ─────────────────────────────────────────────────────────────

interface StatusMeta {
  Icon: React.ElementType
  iconBg: string
  iconColor: string
  label: string
  badgeCls: string
}

const STATUS_META: Record<ApprovalStatus, StatusMeta> = {
  pending: {
    Icon: Clock,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Pending',
    badgeCls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  under_review: {
    Icon: Clock,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Under Review',
    badgeCls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  approved: {
    Icon: CheckCircle,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    label: 'Approved',
    badgeCls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  },
  rejected: {
    Icon: XCircle,
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    label: 'Rejected',
    badgeCls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
  escalated: {
    Icon: AlertTriangle,
    iconBg: 'bg-pink-100 dark:bg-pink-900/30',
    iconColor: 'text-pink-600 dark:text-pink-400',
    label: 'Escalated',
    badgeCls: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800',
  },
  changes_requested: {
    Icon: RefreshCw,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Changes Requested',
    badgeCls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  },
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function isUrgent(due_date: string | null): boolean {
  if (!due_date) return false
  return new Date(due_date).getTime() - Date.now() < 24 * 3_600_000
}

function isCompleted(status: ApprovalStatus): boolean {
  return status === 'approved' || status === 'rejected' || status === 'changes_requested'
}

function formatRelativeDate(record: ApprovalRecord): { label: string; urgency: 'overdue' | 'urgent' | 'normal' } {
  const { status, due_date, decided_at } = record

  // Completed — show decided_at
  if (isCompleted(status) && decided_at) {
    const diffH = (Date.now() - new Date(decided_at).getTime()) / 3_600_000
    const diffD = Math.floor(diffH / 24)
    const label =
      diffH < 1 ? `${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'} just now` :
      diffH < 24 ? `${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'} ${Math.round(diffH)}h ago` :
      `${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'} ${diffD}d ago`
    return { label, urgency: 'normal' }
  }

  if (!due_date) return { label: 'No due date', urgency: 'normal' }

  const msLeft = new Date(due_date).getTime() - Date.now()
  const hLeft = msLeft / 3_600_000

  if (msLeft < 0) {
    const hAgo = Math.abs(Math.round(hLeft))
    return {
      label: hAgo < 24 ? `Overdue by ${hAgo}h` : `Overdue by ${Math.floor(hAgo / 24)}d`,
      urgency: 'overdue',
    }
  }
  if (hLeft < 1)   return { label: `Due in ${Math.round(hLeft * 60)}m`, urgency: 'urgent' }
  if (hLeft < 24)  return { label: `Due in ${Math.round(hLeft)}h`,       urgency: 'urgent' }
  if (hLeft < 48)  return { label: 'Due tomorrow',                        urgency: 'urgent' }
  const dLeft = Math.floor(hLeft / 24)
  return { label: `Due in ${dLeft} days`, urgency: 'normal' }
}

function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

// ─────────────────────────────────────────────────────────────
// Filter / sort logic (memoised)
// ─────────────────────────────────────────────────────────────

function applyFilter(items: ApprovalRecord[], filter: FilterOption, query: string): ApprovalRecord[] {
  let result = items

  if (query.trim()) {
    const q = query.toLowerCase()
    result = result.filter(
      (a) =>
        a.object_code.toLowerCase().includes(q) ||
        a.object_type.toLowerCase().includes(q) ||
        a.requested_by_name.toLowerCase().includes(q) ||
        a.approver_role.toLowerCase().includes(q),
    )
  }

  switch (filter) {
    case 'pending':
      return result.filter((a) => a.status === 'pending' || a.status === 'under_review')
    case 'urgent':
      return result.filter((a) => (a.status === 'pending' || a.status === 'under_review') && isUrgent(a.due_date))
    case 'escalated':
      return result.filter((a) => a.status === 'escalated')
    case 'completed':
      return result.filter((a) => isCompleted(a.status))
    default:
      return result
  }
}

function applySort(items: ApprovalRecord[], sort: SortOption): ApprovalRecord[] {
  const sorted = [...items]
  switch (sort) {
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    case 'due_soon':
      return sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })
    default: // newest
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

interface ApprovalItemCardProps {
  record: ApprovalRecord
  onClick: (id: string) => void
}

const ApprovalItemCard = React.memo(function ApprovalItemCard({
  record,
  onClick,
}: ApprovalItemCardProps) {
  const meta = STATUS_META[record.status]
  const urgent = isUrgent(record.due_date) && !isCompleted(record.status)
  const { label: dateLabel, urgency } = formatRelativeDate(record)
  const initials = getInitials(record.requested_by_name)

  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(record.id)}
        aria-label={`${record.object_code} ${record.object_type} — ${meta.label}${urgent ? ', urgent' : ''}`}
        className={cn(
          'w-full flex items-center gap-4 rounded-lg border border-border px-4 py-4 text-left',
          'bg-card hover:bg-muted/40 transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'group',
        )}
      >
        {/* Status icon circle */}
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full size-10',
            meta.iconBg,
          )}
          aria-hidden="true"
        >
          <meta.Icon className={cn('size-5', meta.iconColor)} />
        </span>

        {/* Middle content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Row 1: type badge + status badge + urgent badge */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {record.object_type}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                meta.badgeCls,
              )}
            >
              {meta.label}
            </span>
            {urgent && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border border-red-300 dark:border-red-800',
                  'bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5',
                  'text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide',
                  'animate-pulse',
                )}
                aria-label="Urgent — due within 24 hours"
              >
                <Flame className="size-3" aria-hidden="true" />
                Urgent
              </span>
            )}
          </div>

          {/* Row 2: code + level + approver role */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground truncate">
              {record.object_code}
            </span>
            <span className="text-muted-foreground text-[11px] shrink-0">
              Level {record.level} · {record.approver_role}
            </span>
          </div>

          {/* Row 3: requester + due date */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Avatar + name */}
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#64ffda]/20 text-[9px] font-bold text-[#0a192f] dark:text-[#64ffda]"
                aria-hidden="true"
              >
                {initials}
              </span>
              <span className="text-sm text-muted-foreground">{record.requested_by_name}</span>
            </div>

            {/* Due date */}
            <span
              className={cn(
                'text-sm',
                urgency === 'overdue' ? 'text-red-600 dark:text-red-400 font-medium' :
                urgency === 'urgent'  ? 'text-amber-600 dark:text-amber-400 font-medium' :
                                        'text-muted-foreground',
              )}
            >
              {dateLabel}
            </span>
          </div>
        </div>

        {/* Right chevron */}
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
          aria-hidden="true"
        />
      </button>
    </li>
  )
})

// ─────────────────────────────────────────────────────────────
// Filter tab
// ─────────────────────────────────────────────────────────────

interface FilterTabProps {
  label: string
  count: number
  active: boolean
  countCls?: string
  onClick: () => void
}

function FilterTab({ label, count, active, countCls, onClick }: FilterTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-foreground text-background dark:bg-foreground dark:text-background'
          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
      )}
    >
      {label}
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full min-w-[18px] h-[18px] px-1 text-[10px] font-bold',
          active
            ? 'bg-background/20 text-background dark:bg-foreground/20 dark:text-foreground'
            : countCls ?? 'bg-background text-foreground dark:bg-card dark:text-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
      <CheckCircle2 className="size-12 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-lg font-medium text-foreground">No approvals found</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        All caught up! No pending approvals match your filters.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  due_soon: 'Due Soon',
}

export const ApprovalInbox = React.memo(function ApprovalInbox({
  approvals = MOCK_APPROVAL_INBOX,
  filter = 'all',
  onFilterChange,
  onApprovalClick,
  showFilters = true,
}: ApprovalInboxProps) {
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<SortOption>('newest')
  const [sortOpen, setSortOpen] = React.useState(false)
  const sortRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)

  // Close sort dropdown on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Counts for filter tabs
  const counts = React.useMemo(() => ({
    all:       approvals.length,
    pending:   approvals.filter(a => a.status === 'pending' || a.status === 'under_review').length,
    urgent:    approvals.filter(a => (a.status === 'pending' || a.status === 'under_review') && isUrgent(a.due_date)).length,
    escalated: approvals.filter(a => a.status === 'escalated').length,
    completed: approvals.filter(a => isCompleted(a.status)).length,
  }), [approvals])

  // Filtered + sorted list
  const visible = React.useMemo(
    () => applySort(applyFilter(approvals, filter, query), sort),
    [approvals, filter, query, sort],
  )

  const handleClick = React.useCallback(
    (id: string) => onApprovalClick?.(id),
    [onApprovalClick],
  )

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm w-full">
      {/* ── Header ─────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-foreground leading-none">
              Approval Inbox
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pending and recent approval requests
            </p>
          </div>
        </div>

        {/* ── Filter tabs ─────────────────────── */}
        {showFilters && (
          <div
            className="flex flex-wrap gap-2 mt-4"
            role="group"
            aria-label="Filter approvals"
          >
            <FilterTab
              label="All"
              count={counts.all}
              active={filter === 'all'}
              onClick={() => onFilterChange?.('all')}
            />
            <FilterTab
              label="Pending"
              count={counts.pending}
              active={filter === 'pending'}
              countCls="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
              onClick={() => onFilterChange?.('pending')}
            />
            <FilterTab
              label="Urgent"
              count={counts.urgent}
              active={filter === 'urgent'}
              countCls="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
              onClick={() => onFilterChange?.('urgent')}
            />
            <FilterTab
              label="Escalated"
              count={counts.escalated}
              active={filter === 'escalated'}
              countCls="bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400"
              onClick={() => onFilterChange?.('escalated')}
            />
            <FilterTab
              label="Completed"
              count={counts.completed}
              active={filter === 'completed'}
              countCls="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              onClick={() => onFilterChange?.('completed')}
            />
          </div>
        )}
      </div>

      {/* ── Search + Sort toolbar ──────────────── */}
      <div className="px-6 py-3 border-b border-border flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1 flex items-center">
          <Search
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search approvals by object type, code, or requester..."
            aria-label="Search approvals"
            className={cn(
              'w-full rounded-lg border border-border bg-background pl-9 pr-9 py-2',
              'text-sm text-foreground placeholder:text-muted-foreground',
              'outline-none transition-colors duration-150',
              'focus:border-ring focus:ring-2 focus:ring-ring/30',
            )}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => { setQuery(''); searchRef.current?.focus() }}
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div ref={sortRef} className="relative shrink-0">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            onClick={() => setSortOpen(v => !v)}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2',
              'text-sm text-foreground hover:bg-muted transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <span>{SORT_LABELS[sort]}</span>
            <ChevronDown className={cn('size-4 text-muted-foreground transition-transform duration-150', sortOpen && 'rotate-180')} aria-hidden="true" />
          </button>

          {sortOpen && (
            <ul
              role="listbox"
              aria-label="Sort options"
              className={cn(
                'absolute right-0 top-[calc(100%+4px)] z-20 w-36',
                'rounded-lg border border-border bg-card shadow-lg py-1',
              )}
            >
              {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
                <li key={value} role="option" aria-selected={sort === value}>
                  <button
                    type="button"
                    onClick={() => { setSort(value); setSortOpen(false) }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm transition-colors',
                      sort === value
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── List ──────────────────────────────── */}
      <div className="px-4 py-3">
        {visible.length === 0 ? (
          <EmptyState />
        ) : (
          <ul
            role="list"
            aria-label="Approval requests"
            className="flex flex-col gap-2"
          >
            {visible.map((record) => (
              <ApprovalItemCard
                key={record.id}
                record={record}
                onClick={handleClick}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
})
