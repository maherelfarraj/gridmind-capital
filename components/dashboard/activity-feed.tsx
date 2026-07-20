'use client'

import * as React from 'react'
import {
  GitBranch,
  CheckCircle2,
  MessageSquare,
  FileUp,
  AlertTriangle,
  ShieldAlert,
  Flag,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityItem, ActivityVerb } from './dashboard-data'

// ─────────────────────────────────────────────────────────────
// Verb metadata
// ─────────────────────────────────────────────────────────────

const VERB_META: Record<ActivityVerb, { Icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  'gate-advanced':   { Icon: GitBranch,    color: '#64ffda', bgColor: 'rgba(100,255,218,0.12)', label: 'Gate Advanced'  },
  'approved':        { Icon: CheckCircle2, color: '#22c55e', bgColor: 'rgba(34,197,94,0.12)',   label: 'Approved'       },
  'comment':         { Icon: MessageSquare,color: '#3b82f6', bgColor: 'rgba(59,130,246,0.12)',  label: 'Comment'        },
  'document-upload': { Icon: FileUp,       color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.12)',  label: 'Document'       },
  'risk-raised':     { Icon: AlertTriangle,color: '#f97316', bgColor: 'rgba(249,115,22,0.12)',  label: 'Risk Raised'    },
  'hse-incident':    { Icon: ShieldAlert,  color: '#ef4444', bgColor: 'rgba(239,68,68,0.12)',   label: 'HSE Incident'   },
  'milestone':       { Icon: Flag,         color: '#f59e0b', bgColor: 'rgba(245,158,11,0.12)',  label: 'Milestone'      },
  'user-joined':     { Icon: UserPlus,     color: '#a855f7', bgColor: 'rgba(168,85,247,0.12)',  label: 'User Joined'    },
}

// ─────────────────────────────────────────────────────────────
// Single event row
// ─────────────────────────────────────────────────────────────

interface EventRowProps {
  item: ActivityItem
  isLast: boolean
}

function EventRow({ item, isLast }: EventRowProps) {
  const verb = VERB_META[item.verb]

  return (
    <li className="relative flex gap-3">
      {/* Vertical connector line */}
      {!isLast && (
        <span
          className="absolute left-[18px] top-8 bottom-0 w-px bg-border"
          aria-hidden="true"
        />
      )}

      {/* Actor avatar */}
      <div
        className="relative z-10 mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm border border-border"
        style={{ backgroundColor: `${item.actorColor}20`, color: item.actorColor }}
        aria-hidden="true"
      >
        {item.actorInitials}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-4">
        {/* First line */}
        <p className="text-xs leading-snug text-foreground">
          <span className="font-semibold">{item.actor}</span>
          {' '}
          <span className="text-muted-foreground">{item.subject}</span>
        </p>

        {/* Project + verb badge */}
        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
            {item.projectCode}
          </span>
          <span className="text-muted-foreground/40 text-[10px]">·</span>
          <span
            className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: verb.bgColor, color: verb.color }}
          >
            <verb.Icon className="size-2.5" aria-hidden="true" />
            {verb.label}
          </span>
          <span className="text-muted-foreground/40 text-[10px]">·</span>
          <time
            className="text-[10px] text-muted-foreground/70"
            dateTime={item.timestamp}
          >
            {item.timestamp}
          </time>
        </div>

        {/* Optional detail (document name, comment snippet) */}
        {item.detail && (
          <p className={cn(
            'mt-1 text-[11px] leading-snug rounded-md px-2 py-1.5 border border-border/60',
            item.verb === 'comment'
              ? 'italic text-muted-foreground bg-muted/40'
              : 'font-mono text-muted-foreground bg-muted/30',
          )}>
            {item.detail}
          </p>
        )}
      </div>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="flex gap-3 pb-4 animate-pulse">
      <div className="mt-1 size-9 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-2.5 w-1/2 rounded bg-muted" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Activity Feed
// ─────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  items: ActivityItem[]
  loading?: boolean
  maxVisible?: number
}

export function ActivityFeed({ items, loading = false, maxVisible = 8 }: ActivityFeedProps) {
  const [showAll, setShowAll] = React.useState(false)
  const visible = showAll ? items : items.slice(0, maxVisible)
  const hasMore = items.length > maxVisible

  return (
    <section
      className="flex flex-col rounded-xl border border-border bg-card overflow-hidden"
      aria-label="Recent Activity"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
        <span className="text-[11px] text-muted-foreground">{items.length} events today</span>
      </div>

      {/* Timeline */}
      <div className="px-4 pt-4 overflow-y-auto max-h-[460px]">
        {loading ? (
          <div>
            {Array.from({ length: maxVisible }).map((_, i) => (
              <FeedSkeleton key={i} />
            ))}
          </div>
        ) : (
          <ul className="space-y-0">
            {visible.map((item, i) => (
              <EventRow
                key={item.id}
                item={item}
                isLast={i === visible.length - 1}
              />
            ))}
          </ul>
        )}

        {/* Show all toggle */}
        {!loading && hasMore && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mb-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            {showAll ? 'Show less' : `Show ${items.length - maxVisible} more events`}
          </button>
        )}
      </div>
    </section>
  )
}
