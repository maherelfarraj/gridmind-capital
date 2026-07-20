import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { ApprovalsPage } from '@/components/approvals/approvals-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Approvals — GridMind Capital' }

export default function Page() {
  return (
    <AppShell
      title="Approvals"
      breadcrumbs={[{ label: 'Approvals' }]}
      notificationCount={3}
      approvalCount={7}
    >
      <ToastProvider position="bottom-right">
        <ApprovalsPage />
        <HelpHubPanel context="Approvals" userRole="ADMIN" />
      </ToastProvider>
    </AppShell>
  )
}
