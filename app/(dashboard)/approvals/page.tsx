'use client'

import { ApprovalInboxWrapper } from '@/components/approvals/approval-inbox-wrapper'

export const metadata = { title: 'Approvals — GridMind Capital' }

export default function Page() {
  return (
    <ApprovalInboxWrapper showFilters />
  )
}
