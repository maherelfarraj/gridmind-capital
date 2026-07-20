'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ApprovalInbox, type FilterOption } from './approval-inbox'

interface ApprovalInboxWrapperProps {
  /** true = full page with all filter tabs; false = compact widget (default: true) */
  showFilters?: boolean
}

/**
 * Client wrapper that owns filter state + wires `router.push` navigation.
 * Used on /approvals (showFilters=true) and dashboard widget (showFilters=false).
 */
export function ApprovalInboxWrapper({ showFilters = true }: ApprovalInboxWrapperProps) {
  const router = useRouter()
  const [filter, setFilter] = React.useState<FilterOption>(showFilters ? 'all' : 'pending')

  return (
    <ApprovalInbox
      filter={filter}
      onFilterChange={showFilters ? setFilter : undefined}
      onApprovalClick={(id) => router.push(`/approvals/${id}`)}
      showFilters={showFilters}
    />
  )
}
