import { ToastProvider } from '@/components/ui/toast'
import { ApprovalInboxWrapper } from '@/components/approvals/approval-inbox-wrapper'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Approvals — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      {/* Full ApprovalInbox with all filters */}
      <ApprovalInboxWrapper showFilters />
      <HelpHubPanel context="Approvals" userRole="ADMIN" />
    </ToastProvider>
  )
}
