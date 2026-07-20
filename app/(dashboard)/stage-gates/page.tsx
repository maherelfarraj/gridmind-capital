import { ToastProvider } from '@/components/ui/toast'
import { StageGateReviewPage } from '@/components/stage-gate/stage-gate-review-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Stage Gates — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      <StageGateReviewPage />
      <HelpHubPanel context="Stage Gates" userRole="ADMIN" />
    </ToastProvider>
  )
}
