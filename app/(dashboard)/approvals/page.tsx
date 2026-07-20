import { ToastProvider } from '@/components/ui/toast'
import { ApprovalsPage } from '@/components/approvals/approvals-page'
import { ApprovalInboxWrapper } from '@/components/approvals/approval-inbox-wrapper'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Approvals — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      {/* ApprovalInbox — spec preview */}
      <div className="mb-8 max-w-3xl">
        <ApprovalInboxWrapper />
      </div>
      <ApprovalsPage />
      <HelpHubPanel context="Approvals" userRole="ADMIN" />
    </ToastProvider>
  )
}
