import { ApprovalInboxWrapper } from '@/components/approvals/approval-inbox-wrapper'

export const metadata = { title: 'Approvals' }

export default function Page() {
  return (
    <ApprovalInboxWrapper showFilters />
  )
}
