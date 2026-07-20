import { AppShell } from '@/components/layout/AppShell'
import { SessionProvider } from '@/lib/session-context'
import { mockSession } from '@/lib/session'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Replace mockSession with a real server-side session fetch
  // (e.g. auth.api.getSession()) when the auth backend is wired up.
  return (
    <SessionProvider session={mockSession}>
      <AppShell approvalCount={3}>
        {children}
      </AppShell>
    </SessionProvider>
  )
}
