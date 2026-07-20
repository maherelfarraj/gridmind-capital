'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, User, FileText, CheckCircle2, XCircle, RotateCcw, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { MOCK_APPROVAL_INBOX } from '@/components/approvals/approval-inbox'

// ── Relative time helper ──────────────────────────────────────
function relativeTime(isoDate: string | null): string {
  if (!isoDate) return '—'
  const diffMs = new Date(isoDate).getTime() - Date.now()
  const diffH = diffMs / 3_600_000
  if (Math.abs(diffH) < 1) return diffMs > 0 ? 'Due in <1h' : 'Overdue'
  if (diffH > 0 && diffH < 24) return `Due in ${Math.round(diffH)}h`
  if (diffH > 0 && diffH < 48) return 'Due tomorrow'
  if (diffH < 0 && diffH > -24) return 'Due today (overdue)'
  const days = Math.abs(Math.round(diffH / 24))
  return diffMs > 0 ? `Due in ${days}d` : `${days}d overdue`
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  pending:           { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: <Clock className="size-4" /> },
  urgent:            { bg: 'bg-red-500/15',   text: 'text-red-400',   icon: <Flame className="size-4" /> },
  escalated:         { bg: 'bg-red-500/15',   text: 'text-red-400',   icon: <Flame className="size-4" /> },
  under_review:      { bg: 'bg-blue-500/15',  text: 'text-blue-400',  icon: <RotateCcw className="size-4" /> },
  changes_requested: { bg: 'bg-orange-500/15',text: 'text-orange-400',icon: <RotateCcw className="size-4" /> },
  approved:          { bg: 'bg-green-500/15', text: 'text-green-400', icon: <CheckCircle2 className="size-4" /> },
  rejected:          { bg: 'bg-red-500/15',   text: 'text-red-400',   icon: <XCircle className="size-4" /> },
}

export default function ApprovalDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const approval = React.useMemo(
    // Match on record id (e.g. "ai-1") OR object_code (e.g. "PO-2026-001")
    () => MOCK_APPROVAL_INBOX.find((a) => a.id === id || a.object_code === id) ?? null,
    [id],
  )

  const isOverdue = approval?.due_date
    ? new Date(approval.due_date).getTime() < Date.now()
    : false

  if (!approval) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <p className="text-4xl font-bold text-foreground">404</p>
        <p className="text-muted-foreground text-sm">
          Approval request <span className="font-mono text-foreground">{id}</span> was not found.
        </p>
        <Button variant="outline" size="sm" onClick={() => router.push('/approvals')}>
          Back to Approvals
        </Button>
      </div>
    )
  }

  const style = STATUS_STYLES[approval.status] ?? STATUS_STYLES.pending
  const isUrgent = (['escalated'] as string[]).includes(approval.status)
  const isCompleted = (['approved', 'rejected'] as string[]).includes(approval.status)

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/approvals')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to approvals
      </button>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {approval.object_type}
            </p>
            <h1 className="text-2xl font-bold text-foreground font-mono">{approval.object_code}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Badge variant={approval.status === 'approved' ? 'default' : 'secondary'} className={cn(style.text, style.bg, 'capitalize border-0')}>
              {style.icon}
              <span className="ml-1">{approval.status.replace('_', ' ')}</span>
            </Badge>
            {isUrgent && (
              <Badge className="bg-red-500/20 text-red-400 border-0 animate-pulse">
                <Flame className="size-3 mr-1" />
                URGENT
              </Badge>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm border-t border-border pt-4">
          <div>
            <dt className="text-xs text-muted-foreground">Level</dt>
            <dd className="text-foreground font-medium mt-0.5">Level {approval.level}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Approver Role</dt>
            <dd className="text-foreground font-medium mt-0.5">{approval.approver_role}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Requested By</dt>
            <dd className="flex items-center gap-1.5 text-foreground font-medium mt-0.5">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#64ffda]/20 text-[#64ffda] text-[9px] font-bold shrink-0">
                {approval.requested_by_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
              {approval.requested_by_name}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Due Date</dt>
            <dd className={cn('font-medium mt-0.5', isOverdue ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-foreground')}>
              {relativeTime(approval.due_date)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Created</dt>
            <dd className="text-foreground font-medium mt-0.5">
              {new Date(approval.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </dd>
          </div>
          {approval.decided_at && (
            <div>
              <dt className="text-xs text-muted-foreground">Decided</dt>
              <dd className="text-foreground font-medium mt-0.5">
                {new Date(approval.decided_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </dd>
            </div>
          )}
          {approval.decision_reason && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Decision Reason</dt>
              <dd className="text-foreground mt-0.5 leading-relaxed">{approval.decision_reason}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Actions — only for pending/escalated */}
      {!isCompleted && (
        <div className="flex items-center gap-3">
          <Button
            className="bg-[#64ffda] text-[#0a192f] hover:bg-[#64ffda]/80 font-semibold"
            onClick={() => alert(`Approved: ${approval.id}`)}
          >
            <CheckCircle2 className="size-4 mr-1.5" />
            Approve
          </Button>
          <Button
            variant="outline"
            className="border-red-500/40 text-red-400 hover:bg-red-500/10"
            onClick={() => alert(`Rejected: ${approval.id}`)}
          >
            <XCircle className="size-4 mr-1.5" />
            Reject
          </Button>
          <Button variant="ghost" size="sm" onClick={() => alert(`Request changes: ${approval.id}`)}>
            <RotateCcw className="size-4 mr-1.5" />
            Request Changes
          </Button>
        </div>
      )}
    </div>
  )
}
