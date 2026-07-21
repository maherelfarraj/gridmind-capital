'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ApprovalInbox, type FilterOption } from './approval-inbox'
import { getApprovals } from '@/app/actions/approvals'
import { useSession } from '@/lib/session-context'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

interface ApprovalInboxWrapperProps {
  showFilters?: boolean
}

export function ApprovalInboxWrapper({ showFilters = true }: ApprovalInboxWrapperProps) {
  const router = useRouter()
  const session = useSession()
  const tenantId = session.tenantId ?? TENANT_ID

  const [filter, setFilter] = React.useState<FilterOption>(showFilters ? 'all' : 'pending')

  const { data: approvals, isLoading } = useSWR('approvals', getApprovals)

  return (
    <ApprovalInbox
      approvals={approvals}
      filter={filter}
      onFilterChange={showFilters ? setFilter : undefined}
      onApprovalClick={(id) => router.push(`/approvals/${id}`)}
      showFilters={showFilters}
    />
  )
}
