'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ApprovalInbox, type FilterOption } from './approval-inbox'
import { MobileApprovalList } from './mobile-approval-list'
import { getApprovals } from '@/app/actions/approvals'
import { useSession } from '@/lib/session-context'
import { ROLE_LABELS } from '@/lib/session'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

interface ApprovalInboxWrapperProps {
  showFilters?: boolean
}

export function ApprovalInboxWrapper({ showFilters = true }: ApprovalInboxWrapperProps) {
  const router = useRouter()
  const session = useSession()
  const tenantId = session.tenantId ?? TENANT_ID

  // Scope the inbox to the current user's approver role (admins see all).
  const approverRole = session.isSuperAdmin
    ? undefined
    : session.roles[0]
      ? ROLE_LABELS[session.roles[0]]
      : undefined

  const [filter, setFilter] = React.useState<FilterOption>(showFilters ? 'all' : 'pending')

  const { data: approvals, isLoading, mutate } = useSWR(
    ['approvals', approverRole ?? 'all'],
    () => getApprovals(approverRole),
  )

  const openDetail = (id: string) => router.push(`/approvals/${id}`)

  return (
    <>
      {/* Mobile: large-thumb, swipeable decision cards (≤768px) */}
      <div className="md:hidden">
        <MobileApprovalList
          approvals={approvals ?? []}
          onOpen={openDetail}
          onChanged={() => mutate()}
        />
      </div>

      {/* Desktop / tablet: full inbox with filters (≥768px) */}
      <div className="hidden md:block">
        <ApprovalInbox
          approvals={approvals}
          filter={filter}
          onFilterChange={showFilters ? setFilter : undefined}
          onApprovalClick={openDetail}
          showFilters={showFilters}
        />
      </div>
    </>
  )
}
