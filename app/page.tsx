import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { DataRegisterDemo } from '@/components/ui/data-register-demo'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export default function Home() {
  return (
    <AppShell
      title="Project Register"
      breadcrumbs={[
        { label: 'Projects', href: '/projects' },
        { label: 'Register' },
      ]}
      notificationCount={3}
      approvalCount={7}
    >
      <ToastProvider position="bottom-right">
        <DataRegisterDemo />
        <HelpHubPanel context="Projects" userRole="PROJECT_MANAGER" />
      </ToastProvider>
    </AppShell>
  )
}
