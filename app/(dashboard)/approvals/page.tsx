import { ToastProvider } from '@/components/ui/toast'
import { ApprovalsPage } from '@/components/approvals/approvals-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Approvals — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      <ApprovalsPage />
      <HelpHubPanel context="Approvals" userRole="ADMIN" />
    </ToastProvider>
  )
}
