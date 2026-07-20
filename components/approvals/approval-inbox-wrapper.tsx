'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ApprovalInbox, type FilterOption } from './approval-inbox'

/**
 * Thin client wrapper that owns filter state and wires navigation
 * for the ApprovalInbox spec preview on /approvals.
 */
export function ApprovalInboxWrapper() {
  const router = useRouter()
  const [filter, setFilter] = React.useState<FilterOption>('all')

  return (
    <ApprovalInbox
      filter={filter}
      onFilterChange={setFilter}
      onApprovalClick={(id) => router.push(`/approvals/${id}`)}
    />
  )
}
