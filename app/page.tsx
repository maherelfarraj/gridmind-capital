import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { NewProjectWizardPage } from '@/components/projects/new-project-wizard'

export default function Home() {
  return (
    <AppShell
      title="New Project"
      breadcrumbs={[
        { label: 'Projects', href: '/projects' },
        { label: 'New Project' },
      ]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <NewProjectWizardPage />
      </ToastProvider>
    </AppShell>
  )
}
