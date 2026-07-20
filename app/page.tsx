import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { ProjectDetailPage } from '@/components/projects/project-detail-page'

export default function Home() {
  return (
    <AppShell
      title="Sirius 400MW Solar Farm"
      breadcrumbs={[
        { label: 'Projects', href: '/projects' },
        { label: 'SRS-400 — Sirius 400MW Solar Farm' },
      ]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <ProjectDetailPage />
      </ToastProvider>
    </AppShell>
  )
}
