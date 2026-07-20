import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { DeploymentChecklist } from '@/components/admin/deployment-checklist'

export default function Home() {
  return (
    <AppShell
      title="Deployment Checklist"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Deployment Checklist' },
      ]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <DeploymentChecklist />
      </ToastProvider>
    </AppShell>
  )
}
