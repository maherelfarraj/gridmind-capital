'use client'

import * as React from 'react'
import { Check, X, Clock, MessageSquare, ChevronRight, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApprovalRecord } from './approval-inbox'

export type Decision = 'approved' | 'rejected'

interface MobileApprovalCardProps {
  record: ApprovalRecord
  /** Fired when the user commits a decision (via swipe or button). */
  onDecide: (record: ApprovalRecord, decision: Decision, comment: string) => void
  /** Navigate to detail. */
  onOpen: (id: string) => void
}

const SWIPE_COMMIT = 96 // px drag distance that commits a decision

/**
 * Large-thumb, swipeable approval card optimised for one-handed mobile use
 * at 375px. Swipe right (or tap the green thumb) to approve, swipe left
 * (or tap the red thumb) to reject. A comment field is always available.
 */
export function MobileApprovalCard({ record, onDecide, onOpen }: MobileApprovalCardProps) {
  const [comment, setComment] = React.useState('')
  const [showComment, setShowComment] = React.useState(false)
  const [dragX, setDragX] = React.useState(0)
  const startX = React.useRef<number | null>(null)
  const dragging = React.useRef(false)

  const urgent = record.due_date
    ? new Date(record.due_date).getTime() - Date.now() < 24 * 3_600_000
    : false

  // ── Touch handlers ─────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    dragging.current = true
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || startX.current === null) return
    const delta = e.touches[0].clientX - startX.current
    // Cap the visual drag so it feels rubber-banded.
    setDragX(Math.max(-140, Math.min(140, delta)))
  }
  const onTouchEnd = () => {
    dragging.current = false
    if (dragX > SWIPE_COMMIT) {
      onDecide(record, 'approved', comment.trim())
    } else if (dragX < -SWIPE_COMMIT) {
      onDecide(record, 'rejected', comment.trim())
    }
    setDragX(0)
  }

  const revealApprove = dragX > 24
  const revealReject = dragX < -24

  return (
    <li className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {/* Swipe action backdrops */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 flex w-1/2 items-center justify-start gap-2 rounded-l-2xl bg-emerald-500 pl-6 text-white transition-opacity',
          revealApprove ? 'opacity-100' : 'opacity-0',
        )}
      >
        <Check className="size-6" />
        <span className="text-sm font-bold uppercase tracking-wide">Approve</span>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 flex w-1/2 items-center justify-end gap-2 rounded-r-2xl bg-red-500 pr-6 text-white transition-opacity',
          revealReject ? 'opacity-100' : 'opacity-0',
        )}
      >
        <span className="text-sm font-bold uppercase tracking-wide">Reject</span>
        <X className="size-6" />
      </div>

      {/* Foreground card (draggable) */}
      <div
        className="relative bg-card"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging.current ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Tap target → detail */}
        <button
          type="button"
          onClick={() => onOpen(record.id)}
          className="flex w-full items-start gap-3 p-4 text-left"
        >
          <span
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
              urgent ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30',
            )}
            aria-hidden="true"
          >
            {urgent ? (
              <Flame className="size-4 text-red-600 dark:text-red-400" />
            ) : (
              <Clock className="size-4 text-amber-600 dark:text-amber-400" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {record.object_type}
              </span>
              {urgent && (
                <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  Urgent
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold text-foreground">
              {record.object_code}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Level {record.level} · {record.approver_role} · {record.requested_by_name}
            </p>
          </div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>

        {/* Comment field (collapsible) */}
        {showComment && (
          <div className="px-4 pb-2">
            <label htmlFor={`comment-${record.id}`} className="sr-only">
              Comment for {record.object_code}
            </label>
            <textarea
              id={`comment-${record.id}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)…"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {/* Large-thumb action row */}
        <div className="flex items-center gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={() => onDecide(record, 'rejected', comment.trim())}
            aria-label={`Reject ${record.object_code}`}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-600 active:opacity-80 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400"
          >
            <X className="size-5" />
            Reject
          </button>
          <button
            type="button"
            onClick={() => setShowComment((v) => !v)}
            aria-label={showComment ? 'Hide comment' : 'Add comment'}
            aria-pressed={showComment}
            className={cn(
              'flex min-h-12 w-12 items-center justify-center rounded-xl border transition-colors',
              showComment || comment
                ? 'border-[#64ffda] bg-[#64ffda]/10 text-[#0a192f] dark:text-[#64ffda]'
                : 'border-border text-muted-foreground',
            )}
          >
            <MessageSquare className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => onDecide(record, 'approved', comment.trim())}
            aria-label={`Approve ${record.object_code}`}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-white active:opacity-80"
          >
            <Check className="size-5" />
            Approve
          </button>
        </div>
      </div>
    </li>
  )
}
