import { ToastProvider } from '@/components/ui/toast'
import { HsePage } from '@/components/hse/hse-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export const metadata = { title: 'HSE — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      <HsePage />
      <HelpHubPanel context="HSE" userRole="ADMIN" />
    </ToastProvider>
  )
}
