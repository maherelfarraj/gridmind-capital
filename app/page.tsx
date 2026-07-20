import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { DataRegisterDemo } from '@/components/ui/data-register-demo'

export default function Home() {
  return (
    <AppShell
      title="Project Register"
      breadcrumbs={[
        { label: 'Projects', href: '/projects' },
        { label: 'Register' },
      ]}
      notificationCount={3}
      approvalCount={7}
    >
      <ToastProvider position="bottom-right">
        <DataRegisterDemo />
      </ToastProvider>
    </AppShell>
  )
}
