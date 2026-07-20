import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { ProjectsListPage } from '@/components/projects/projects-list-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Projects — GridMind Capital' }

export default function Page() {
  return (
    <AppShell
      title="Projects"
      breadcrumbs={[{ label: 'Projects' }]}
      notificationCount={3}
      approvalCount={7}
    >
      <ToastProvider position="bottom-right">
        <ProjectsListPage />
        <HelpHubPanel context="Projects" userRole="ADMIN" />
      </ToastProvider>
    </AppShell>
  )
}
