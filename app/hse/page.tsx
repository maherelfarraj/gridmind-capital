import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { HsePage } from '@/components/hse/hse-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'HSE — GridMind Capital' }

export default function Page() {
  return (
    <AppShell
      title="HSE"
      breadcrumbs={[{ label: 'HSE' }]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <HsePage />
        <HelpHubPanel context="HSE" userRole="ADMIN" />
      </ToastProvider>
    </AppShell>
  )
}
