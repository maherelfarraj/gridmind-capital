import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { DocumentsPage } from '@/components/documents/documents-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Documents — GridMind Capital' }

export default function Page() {
  return (
    <AppShell
      title="Documents"
      breadcrumbs={[{ label: 'Documents' }]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <DocumentsPage />
        <HelpHubPanel context="Documents" userRole="ADMIN" />
      </ToastProvider>
    </AppShell>
  )
}
