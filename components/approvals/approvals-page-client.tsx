'use client'

import * as React from 'react'
import useSWR from 'swr'
import { loadApprovalsDashboard } from '@/app/actions/approvals'
import type { ApprovalsDashboard } from '@/app/actions/approvals'

interface ApprovalsPageClientProps {
  initialDashboard: ApprovalsDashboard
}

export function ApprovalsPageClient({ initialDashboard }: ApprovalsPageClientProps) {
  // SWR with server-fetched data as fallback (avoids refetch on mount)
  const { data, mutate } = useSWR('approvals-dashboard', loadApprovalsDashboard, {
    fallbackData: initialDashboard,
    revalidateOnFocus: false,
  })

  const dashboard = data ?? initialDashboard

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {dashboard?.scope === 'tenant'
            ? 'Review and action pending approvals across all projects'
            : 'Review and action approvals routed to your role'}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">Dashboard ready. Approvals: {dashboard?.total ?? 0} total</p>
    </div>
  )
}
