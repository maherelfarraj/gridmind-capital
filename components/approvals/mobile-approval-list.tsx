'use client'

import * as React from 'react'
import { CheckCircle2, ClipboardCheck } from 'lucide-react'
import { MobileApprovalCard, type Decision } from './mobile-approval-card'
import type { ApprovalRecord } from './approval-inbox'
import { useToast } from '@/components/ui/toast'
import { useOnlineStatus } from '@/lib/pwa/use-online-status'
import { enqueueApproval } from '@/lib/pwa/offline-queue'
import { syncQueuedApproval } from '@/app/actions/approvals'

interface MobileApprovalListProps {
  approvals: ApprovalRecord[]
  onOpen: (id: string) => void
  /** Revalidate the SWR cache after a change. */
  onChanged: () => void
}

const isPending = (a: ApprovalRecord) => a.status === 'pending' || a.status === 'under_review'

/**
 * Mobile approval queue: shows only actionable (pending) items as large
 * swipeable cards. Decisions apply optimistically, dispatch to the server
 * when online, and queue in IndexedDB when offline (synced on reconnect).
 */
export function MobileApprovalList({ approvals, onOpen, onChanged }: MobileApprovalListProps) {
  const { toast } = useToast()
  const online = useOnlineStatus()

  // Track ids the user has just actioned so they disappear immediately
  // (optimistic update) even before SWR revalidates.
  const [actioned, setActioned] = React.useState<Set<string>>(new Set())

  const pending = React.useMemo(
    () => approvals.filter((a) => isPending(a) && !actioned.has(a.id)),
    [approvals, actioned],
  )

  const handleDecide = React.useCallback(
    async (record: ApprovalRecord, decision: Decision, comment: string) => {
      // Optimistic: remove from the list right away.
      setActioned((prev) => new Set(prev).add(record.id))

      const verb = decision === 'approved' ? 'Approved' : 'Rejected'

      if (!online) {
        await enqueueApproval({
          approvalId: record.id,
          objectCode: record.object_code,
          decision,
          comment,
        })
        toast({
          title: `${verb} · queued offline`,
          description: `${record.object_code} will sync when you reconnect.`,
          variant: 'warning',
        })
        return
      }

      const res = await syncQueuedApproval({ id: record.id, decision, comment })
      if (res.error) {
        // Roll back the optimistic removal on failure.
        setActioned((prev) => {
          const next = new Set(prev)
          next.delete(record.id)
          return next
        })
        toast({
          title: 'Could not save decision',
          description: res.error,
          variant: 'danger',
        })
      } else {
        toast({
          title: `${verb} · ${record.object_code}`,
          variant: decision === 'approved' ? 'success' : 'default',
        })
        onChanged()
      }
    },
    [online, toast, onChanged],
  )

  // Re-sync SWR after the global queue-sync event fires.
  React.useEffect(() => {
    const handler = () => onChanged()
    window.addEventListener('gmc:queue-synced', handler)
    return () => window.removeEventListener('gmc:queue-synced', handler)
  }, [onChanged])

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card py-12 text-center">
        <CheckCircle2 className="size-12 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-base font-medium text-foreground">All caught up</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          No approvals are waiting on you right now.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <ClipboardCheck className="size-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">
          {pending.length} awaiting your decision
        </h2>
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        Swipe right to approve, left to reject — or use the buttons.
      </p>
      <ul className="space-y-3">
        {pending.map((record) => (
          <MobileApprovalCard
            key={record.id}
            record={record}
            onDecide={handleDecide}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </div>
  )
}
