import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { FinancePage } from '@/components/finance/finance-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Finance — GridMind Capital' }

export default function Page() {
  return (
    <AppShell
      title="Finance"
      breadcrumbs={[{ label: 'Finance' }]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <FinancePage />
        <HelpHubPanel context="Finance" userRole="ADMIN" />
      </ToastProvider>
    </AppShell>
  )
}
