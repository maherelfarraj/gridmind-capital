'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */

export type WorkflowAction =
  | 'workflow.submit'
  | 'workflow.approve'
  | 'workflow.reject'
  | 'workflow.escalate'
  | 'project.create'
  | 'approval.approve'
  | 'approval.reject'
  | 'comment.create'

export type ObjectType =
  | 'document'
  | 'gate'
  | 'approval'
  | 'project'
  | 'comment'
  | 'budget'
  | 'contract'
  | 'hse-event'
  | 'change-order'
  | 'risk'

export interface WorkflowActor {
  id: string
  name: string
  role: string
  avatarInitials?: string
}

export interface WorkflowLogEntry {
  id: string
  action: WorkflowAction
  objectType: ObjectType
  objectLabel: string
  actor: WorkflowActor
  timestamp: string | Date
  stateBefore?: string
  stateAfter?: string
  reason?: string
  /** Additional detail line shown below reason */
  detail?: string
}

export interface WorkflowTimelineProps {
  logs: WorkflowLogEntry[]
  showActor?: boolean
  className?: string
  /** Limit visible entries before "show more" */
  initialVisible?: number
  loading?: boolean
  emptyMessage?: string
}

/* ─────────────────────────────────────────────
   DOT CONFIG
───────────────────────────────────────────── */

interface DotConfig {
  bg: string
  ring: string
  icon: React.ReactNode
  label: string
}

function getDotConfig(action: WorkflowAction): DotConfig {
  const size = 'w-3 h-3'
  switch (action) {
    case 'workflow.submit':
      return {
        bg: 'bg-[#f59e0b]',
        ring: 'ring-[#f59e0b]/30',
        label: 'Submitted',
        icon: (
          <svg className={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      }
    case 'workflow.approve':
    case 'approval.approve':
      return {
        bg: 'bg-[#22c55e]',
        ring: 'ring-[#22c55e]/30',
        label: 'Approved',
        icon: (
          <svg className={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      }
    case 'workflow.reject':
    case 'approval.reject':
      return {
        bg: 'bg-[#ef4444]',
        ring: 'ring-[#ef4444]/30',
        label: 'Rejected',
        icon: (
          <svg className={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ),
      }
    case 'workflow.escalate':
      return {
        bg: 'bg-[#ec4899]',
        ring: 'ring-[#ec4899]/30',
        label: 'Escalated',
        icon: (
          <svg className={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 9V3M3 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      }
    case 'project.create':
      return {
        bg: 'bg-[#3b82f6]',
        ring: 'ring-[#3b82f6]/30',
        label: 'Created',
        icon: (
          <svg className={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ),
      }
    case 'comment.create':
      return {
        bg: 'bg-[#64748b]',
        ring: 'ring-[#64748b]/30',
        label: 'Commented',
        icon: (
          <svg className={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 2h8a1 1 0 011 1v5a1 1 0 01-1 1H7L5 11V9H2a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        ),
      }
  }
}

/* ─────────────────────────────────────────────
   ACTION LABEL MAP
───────────────────────────────────────────── */

const ACTION_LABELS: Record<WorkflowAction, string> = {
  'workflow.submit':   'Submitted for Review',
  'workflow.approve':  'Workflow Approved',
  'workflow.reject':   'Workflow Rejected',
  'workflow.escalate': 'Escalated to Senior Review',
  'project.create':    'Project Created',
  'approval.approve':  'Approval Granted',
  'approval.reject':   'Approval Denied',
  'comment.create':    'Comment Added',
}

/* ─────────────────────────────────────────────
   OBJECT TYPE BADGE VARIANTS
───────────────────────────────────────────── */

const OBJECT_BADGE_VARIANTS: Record<ObjectType, string> = {
  document:      'bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20',
  gate:          'bg-[#64ffda]/10 text-[#64ffda] border-[#64ffda]/30 font-mono tracking-wider',
  approval:      'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
  project:       'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20',
  comment:       'bg-[#64748b]/10 text-[#94a3b8] border-[#64748b]/20',
  budget:        'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20',
  contract:      'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20',
  'hse-event':   'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20',
  'change-order':'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20',
  risk:          'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/20',
}

const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  document:       'Document',
  gate:           'Gate',
  approval:       'Approval',
  project:        'Project',
  comment:        'Comment',
  budget:         'Budget',
  contract:       'Contract',
  'hse-event':    'HSE Event',
  'change-order': 'Change Order',
  risk:           'Risk',
}

/* ─────────────────────────────────────────────
   STATE BADGE VARIANT MAP
───────────────────────────────────────────── */

type BadgeVariantKey =
  | 'draft' | 'submitted' | 'under-review' | 'approved'
  | 'rejected' | 'escalated' | 'default' | 'outline'

function stateVariant(state: string): BadgeVariantKey {
  const s = state.toLowerCase().replace(/[_\s]/g, '-')
  const map: Record<string, BadgeVariantKey> = {
    draft:          'draft',
    submitted:      'submitted',
    'under-review': 'under-review',
    review:         'under-review',
    pending:        'submitted',
    approved:       'approved',
    rejected:       'rejected',
    escalated:      'escalated',
    active:         'approved',
    closed:         'draft',
    open:           'under-review',
  }
  return map[s] ?? 'outline'
}

/* ─────────────────────────────────────────────
   TIMESTAMP FORMATTER
───────────────────────────────────────────── */

function formatTimestamp(ts: string | Date): { relative: string; absolute: string } {
  const date = ts instanceof Date ? ts : new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr  = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  let relative: string
  if (diffMin < 1)       relative = 'just now'
  else if (diffMin < 60) relative = `${diffMin}m ago`
  else if (diffHr < 24)  relative = `${diffHr}h ago`
  else if (diffDay < 7)  relative = `${diffDay}d ago`
  else                   relative = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const absolute = date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return { relative, absolute }
}

/* ─────────────────────────────────────────────
   AVATAR
───────────────────────────────────────────── */

function ActorAvatar({ actor }: { actor: WorkflowActor }) {
  const initials = actor.avatarInitials ?? actor.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
        'bg-primary/10 text-primary text-[10px] font-semibold font-mono ring-1 ring-primary/20',
      )}
      title={actor.name}
    >
      {initials}
    </span>
  )
}

/* ─────────────────────────────────────────────
   SKELETON
───────────────────────────────────────────── */

function TimelineSkeleton() {
  return (
    <div className="relative pl-8 space-y-6" aria-busy="true" aria-label="Loading timeline">
      {/* vertical line */}
      <div className="absolute left-[11px] top-3 bottom-0 w-px bg-border" aria-hidden="true" />
      {[1, 2, 3].map(i => (
        <div key={i} className="relative flex gap-4 animate-pulse">
          {/* dot */}
          <div className="absolute -left-[29px] mt-1 h-5 w-5 rounded-full bg-muted ring-4 ring-background" />
          {/* card */}
          <div className="flex-1 rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
            </div>
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 rounded bg-muted" />
              <div className="h-3 w-4 rounded bg-muted" />
              <div className="h-5 w-20 rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────
   TIMELINE ENTRY
───────────────────────────────────────────── */

interface TimelineEntryProps {
  entry: WorkflowLogEntry
  showActor: boolean
  isLast: boolean
  index: number
}

function TimelineEntry({ entry, showActor, isLast, index }: TimelineEntryProps) {
  const dot = getDotConfig(entry.action)
  const { relative, absolute } = formatTimestamp(entry.timestamp)

  return (
    <li
      className={cn(
        'relative flex gap-4',
        'opacity-0 animate-[fade-in_0.3s_ease-out_forwards]',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
      aria-label={`${ACTION_LABELS[entry.action]} — ${entry.objectLabel}`}
    >
      {/* ── Connector line (hidden for last item) ── */}
      {!isLast && (
        <div
          className="absolute left-[9px] top-6 bottom-0 w-px bg-border"
          aria-hidden="true"
        />
      )}

      {/* ── Dot ── */}
      <div className="relative mt-1 shrink-0" aria-hidden="true">
        <div
          className={cn(
            'flex h-[22px] w-[22px] items-center justify-center rounded-full',
            'text-white ring-4 ring-background',
            'shadow-sm',
            dot.bg,
          )}
        >
          {dot.icon}
        </div>
        {/* subtle outer ring halo */}
        <div
          className={cn(
            'absolute inset-0 rounded-full opacity-0 ring-[3px] transition-opacity duration-200',
            dot.ring,
            'group-hover/entry:opacity-100',
          )}
        />
      </div>

      {/* ── Card ── */}
      <div
        className={cn(
          'group/entry flex-1 min-w-0 rounded-xl border border-border bg-card',
          'px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.2)]',
          'transition-shadow duration-150 hover:shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.35)]',
          'hover:border-border/70',
          'mb-1',
        )}
      >
        {/* Row 1: Action label + object type badge + timestamp */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-foreground leading-tight">
            {ACTION_LABELS[entry.action]}
          </span>

          {/* Object type pill */}
          <span
            className={cn(
              'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium',
              'border leading-none whitespace-nowrap',
              OBJECT_BADGE_VARIANTS[entry.objectType],
            )}
          >
            {OBJECT_TYPE_LABELS[entry.objectType]}
          </span>

          {/* Object label */}
          <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={entry.objectLabel}>
            {entry.objectLabel}
          </span>

          {/* Timestamp — pushed to end on wider layouts */}
          <time
            dateTime={new Date(entry.timestamp).toISOString()}
            title={absolute}
            className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums"
          >
            {relative}
          </time>
        </div>

        {/* Row 2: Actor */}
        {showActor && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <ActorAvatar actor={entry.actor} />
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{entry.actor.name}</span>
              {' · '}
              <span>{entry.actor.role}</span>
            </span>
          </div>
        )}

        {/* Row 3: State transition */}
        {(entry.stateBefore || entry.stateAfter) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="State change">
            {entry.stateBefore && (
              <Badge variant={stateVariant(entry.stateBefore)} dot className="text-[11px]">
                {entry.stateBefore}
              </Badge>
            )}
            {entry.stateBefore && entry.stateAfter && (
              /* Arrow */
              <svg
                className="h-3 w-3 text-muted-foreground shrink-0"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {entry.stateAfter && (
              <Badge variant={stateVariant(entry.stateAfter)} dot className="text-[11px]">
                {entry.stateAfter}
              </Badge>
            )}
          </div>
        )}

        {/* Row 4: Decision reason */}
        {entry.reason && (
          <p className="mt-1.5 text-xs italic text-muted-foreground leading-relaxed border-l-2 border-border pl-2">
            &ldquo;{entry.reason}&rdquo;
          </p>
        )}

        {/* Row 5: Additional detail */}
        {entry.detail && (
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            {entry.detail}
          </p>
        )}
      </div>
    </li>
  )
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */

export function WorkflowTimeline({
  logs,
  showActor = true,
  className,
  initialVisible = 10,
  loading = false,
  emptyMessage = 'No workflow events yet.',
}: WorkflowTimelineProps) {
  const [showAll, setShowAll] = React.useState(false)
  const visible = showAll ? logs : logs.slice(0, initialVisible)
  const hiddenCount = logs.length - initialVisible

  if (loading) return <TimelineSkeleton />

  if (logs.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 3v7l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      {/* ── Date grouping header line — decorative top cap ── */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest px-2">
          Activity Log · {logs.length} event{logs.length !== 1 ? 's' : ''}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <ol
        className="relative pl-8 space-y-1"
        aria-label="Workflow event timeline"
        role="list"
      >
        {/* Left line cap — drawn behind all entries */}
        <div
          className="pointer-events-none absolute left-[9px] top-1 h-full w-px bg-border"
          aria-hidden="true"
        />

        {visible.map((entry, idx) => (
          <TimelineEntry
            key={entry.id}
            entry={entry}
            showActor={showActor}
            isLast={idx === visible.length - 1}
            index={idx}
          />
        ))}
      </ol>

      {/* ── Show more / less ── */}
      {hiddenCount > 0 && (
        <div className="mt-4 pl-8">
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className={cn(
              'text-xs font-medium text-primary underline-offset-4 hover:underline',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
              'transition-colors duration-150',
            )}
            aria-expanded={showAll}
          >
            {showAll
              ? 'Show less'
              : `Show ${hiddenCount} more event${hiddenCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}

export default WorkflowTimeline
