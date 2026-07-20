import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { DesignSystemShowcase } from '@/components/design-system/showcase'

export default function Home() {
  return (
    <AppShell
      title="Design System"
      breadcrumbs={[
        { label: 'GridMind Capital', href: '/' },
        { label: 'Design System' },
      ]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <DesignSystemShowcase />
      </ToastProvider>
    </AppShell>
  )
}
