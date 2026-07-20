import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { Dashboard } from '@/components/dashboard/dashboard'

export default function Home() {
  return (
    <AppShell
      title="Executive Dashboard"
      breadcrumbs={[{ label: 'Dashboard' }]}
      notificationCount={3}
      approvalCount={7}
    >
      <ToastProvider position="bottom-right">
        <Dashboard />
      </ToastProvider>
    </AppShell>
  )
}
