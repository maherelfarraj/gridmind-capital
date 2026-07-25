'use client'

import * as React from 'react'
import {
  GitBranch,
  DollarSign,
  FileText,
  FilePen,
  ShieldAlert,
  ChevronRight,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ApprovalItem, ApprovalType } from './dashboard-data'

// ─────────────────────────────────────────────────────────────
// Type icons + labels
// ─────────────────────────────────────────────────────────────

const TYPE_META: Record<ApprovalType, { label: string; Icon: React.ElementType; color: string }> = {
  'gate-review':     { label: 'Gate Review',     Icon: GitBranch,   color: '#64ffda' },
  'budget-variance': { label: 'Budget Variance',  Icon: DollarSign,  color: '#f59e0b' },
  'change-order':    { label: 'Change Order',     Icon: FilePen,     color: '#8b5cf6' },
  'contract':        { label: 'Contract',         Icon: FileText,    color: '#3b82f6' },
  'hse-incident':    { label: 'HSE Incident',     Icon: ShieldAlert, color: '#ef4444' },
}

// ─────────────────────────────────────────────────────────────
// Single row
// ─────────────────────────────────────────────────────────────

interface ApprovalRowProps {
  item: ApprovalItem
}

const TYPE_META_FALLBACK: { label: string; Icon: React.ElementType; color: string } = {
  label: 'Approval', Icon: FileText, color: '#64748b',
}

function ApprovalRow({ item }: ApprovalRowProps) {
  const meta = TYPE_META[item.type] ?? TYPE_META_FALLBACK

  const priorityVariant =
    item.priority === 'critical' ? 'critical' :
    item.priority === 'high'     ? 'high' :
    item.priority === 'medium'   ? 'medium' : 'low'

  return (
    <li>
      <button
        type="button"
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left rounded-lg',
          'hover:bg-muted/60 transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'group',
        )}
        aria-label={`${item.title} — ${meta.label} for ${item.projectName}`}
      >
        {/* Type icon */}
        <span
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
          aria-hidden="true"
        >
          <meta.Icon className="size-3.5" />
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-foreground leading-snug line-clamp-1">
              {item.title}
            </p>
            <Badge variant={priorityVariant} className="shrink-0 ms-1">
              {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
            </Badge>
          </div>

          <p className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="font-mono tracking-wider">{item.projectCode}</span>
            {' · '}
            {item.projectName}
            {' · '}
            <span className="text-muted-foreground/70">by {item.requestedBy}</span>
          </p>

          {/* Days open */}
          <div className={cn(
            'mt-1 flex items-center gap-1 text-[11px] font-medium',
            item.isOverdue ? 'text-[#ef4444]' : 'text-muted-foreground',
          )}>
            {item.isOverdue ? (
              <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <Clock className="size-3 shrink-0" aria-hidden="true" />
            )}
            {item.isOverdue
              ? `Overdue · ${item.daysOpen}d open`
              : item.daysOpen === 0
              ? 'Received today'
              : `${item.daysOpen}d open`}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight
          className="size-4 shrink-0 mt-1 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors"
          aria-hidden="true"
        />
      </button>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────

function ApprovalSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 animate-pulse">
      <div className="mt-0.5 size-7 rounded-md bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-2.5 w-1/2 rounded bg-muted" />
        <div className="h-2.5 w-1/3 rounded bg-muted" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Approval Queue
// ─────────────────────────────────────────────────────────────

interface ApprovalQueueProps {
  items: ApprovalItem[]
  loading?: boolean
  maxVisible?: number
}

export function ApprovalQueue({ items, loading = false, maxVisible = 5 }: ApprovalQueueProps) {
  const [expanded, setExpanded] = React.useState(false)

  const overdueCount = items.filter((i) => i.isOverdue).length
  const visible = expanded ? items : items.slice(0, maxVisible)
  const hasMore = items.length > maxVisible

  return (
    <section
      className="flex flex-col rounded-xl border border-border bg-card overflow-hidden"
      aria-label="Pending Approvals"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Pending Approvals</h2>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#ef4444]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#ef4444]">
              <AlertTriangle className="size-2.5" aria-hidden="true" />
              {overdueCount} overdue
            </span>
          )}
        </div>
        <Badge
          className="tabular-nums"
          style={{
            backgroundColor: 'rgba(100,255,218,0.1)',
            color: '#64ffda',
            borderColor: 'rgba(100,255,218,0.2)',
          }}
        >
          {items.length} pending
        </Badge>
      </div>

      {/* List */}
      <ul className="flex-1 divide-y divide-border/50">
        {loading
          ? Array.from({ length: maxVisible }).map((_, i) => (
              <li key={i}><ApprovalSkeleton /></li>
            ))
          : visible.map((item) => (
              <ApprovalRow key={item.id} item={item} />
            ))}
      </ul>

      {/* Show more / collapse */}
      {!loading && hasMore && (
        <div className="border-t border-border px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? 'Show fewer'
              : `Show ${items.length - maxVisible} more`}
          </Button>
        </div>
      )}
    </section>
  )
}
