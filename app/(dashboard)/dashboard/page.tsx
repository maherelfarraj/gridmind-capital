import { ToastProvider } from '@/components/ui/toast'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Dashboard — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      <DashboardPage />
      <HelpHubPanel context="Dashboard" userRole="ADMIN" />
    </ToastProvider>
  )
}
