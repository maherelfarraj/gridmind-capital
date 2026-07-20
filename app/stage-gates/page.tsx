import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { StageGateReviewPage } from '@/components/stage-gate/stage-gate-review-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Stage Gates — GridMind Capital' }

export default function Page() {
  return (
    <AppShell
      title="Stage Gate Control"
      breadcrumbs={[{ label: 'Stage Gates' }]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <StageGateReviewPage />
        <HelpHubPanel context="Stage Gates" userRole="ADMIN" />
      </ToastProvider>
    </AppShell>
  )
}
