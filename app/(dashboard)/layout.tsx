import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { SessionProvider } from '@/lib/session-context'
import { getUnreadCountAction } from '@/app/actions/notifications'
import { getPendingApprovalCount } from '@/app/actions/approvals'
import { signOutAction } from '@/app/actions/auth'
import { type AppSession } from '@/lib/session'
import { resolveSession } from '@/lib/auth/resolve-session'

import { cache } from 'react'

// Returns the resolved session, or null when the authenticated user has no
// profile row. We NEVER fall back to a mock/default identity here — doing so
// would silently grant a real role, permissions and tenant to an account that
// has not been provisioned.
//
// Wrapped in React cache() to dedupe per HTTP request.
const getSession = cache(async (): Promise<AppSession | null> => {
  return await resolveSession()
})

// Shown when a user is authenticated but has no provisioned profile row.
// We deliberately do NOT grant any role, permission, or tenant in this state.
function AccountSetupIncomplete({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="text-balance text-xl font-semibold text-card-foreground">
          Account setup incomplete
        </h1>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Your account is authenticated{email ? ` as ${email}` : ''}, but it has not
          been fully provisioned yet. Please contact your administrator to have your
          profile and role assigned before accessing the dashboard.
        </p>
        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  // getSession() is cached via React cache(), so it deduplicates multiple calls
  // within this request. If auth failed, session is null.
  if (!session) {
    // Not authenticated — redirect to login
    redirect('/auth/login')
  }

  // External roles never see the internal dashboard — bounce to their portal.
  if (session.roles.includes('client_viewer')) redirect('/client')
  if (session.roles.includes('subcontractor')) redirect('/portal')

  // Fetch pending approvals and notifications in parallel
  const [approvalCount, notificationCount] = await Promise.all([
    getPendingApprovalCount(),
    getUnreadCountAction(),
  ])

  return (
    <SessionProvider session={session}>
      <AppShell approvalCount={approvalCount ?? 0} notificationCount={notificationCount}>
        {children}
      </AppShell>
    </SessionProvider>
  )
}
