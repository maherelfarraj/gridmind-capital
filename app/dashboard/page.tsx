import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Dashboard — GridMind Capital' }

export default function Page() {
  return (
    <AppShell title="Dashboard" breadcrumbs={[{ label: 'Dashboard' }]} notificationCount={3} approvalCount={7}>
      <ToastProvider position="bottom-right">
        <DashboardPage />
        <HelpHubPanel context="Dashboard" userRole="ADMIN" />
      </ToastProvider>
    </AppShell>
  )
}
