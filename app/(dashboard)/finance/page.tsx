import { ToastProvider } from '@/components/ui/toast'
import { FinancePage } from '@/components/finance/finance-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'Finance — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      <FinancePage />
      <HelpHubPanel context="Finance" userRole="ADMIN" />
    </ToastProvider>
  )
}
