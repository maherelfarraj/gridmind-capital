import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { Dashboard } from '@/components/dashboard/dashboard'
import { WorkflowTimelineDemoSection } from '@/components/workflow/workflow-timeline-demo'

export default function Home() {
  return (
    <AppShell
      title="Executive Dashboard"
      breadcrumbs={[{ label: 'Dashboard' }]}
      notificationCount={3}
      approvalCount={7}
    >
      <ToastProvider position="bottom-right">
        <div className="space-y-10">
          <Dashboard />
          <div className="border-t border-border pt-8">
            <WorkflowTimelineDemoSection />
          </div>
        </div>
      </ToastProvider>
    </AppShell>
  )
}
