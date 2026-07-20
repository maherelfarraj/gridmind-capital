import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { TenantSettingsPage } from '@/components/settings/tenant-settings-page'

export default function Home() {
  return (
    <AppShell
      title="Tenant Settings"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Tenant Settings' },
      ]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <TenantSettingsPage />
      </ToastProvider>
    </AppShell>
  )
}
