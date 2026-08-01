import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { SessionProvider } from '@/lib/session-context'
import { getUnreadCountAction } from '@/app/actions/notifications'
import { getPendingApprovalCount } from '@/app/actions/approvals'
import { signOutAction } from '@/app/actions/auth'
import { resolveSessionState } from '@/lib/auth/resolve-session'
import { dashboardDecision } from '@/lib/auth/routing'

// Shown when a user is authenticated but has no usable profile row.
// We deliberately do NOT grant any role, permission, or tenant in this state,
// and we render no dashboard data — the component below is a terminal screen.
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
  // resolveSessionState() is cached via React cache() inside the canonical
  // actor resolver, so repeated calls within this request are deduplicated.
  const state = await resolveSessionState()

  // The whole routing matrix lives in lib/auth/routing.ts so the unit tests
  // exercise this exact decision instead of a test-local copy of it.
  const decision = dashboardDecision(state)

  if (decision.action === 'redirect') {
    redirect(decision.to)
  }

  // Signed in, but the profile is missing/inactive/tenant-less/role-invalid.
  // Redirecting to /auth/login here would loop: the user IS authenticated, so
  // logging in again cannot fix it. Render a terminal screen with no dashboard
  // data and no session context instead — note this returns BEFORE any data
  // fetch below.
  if (decision.action === 'render-setup-incomplete') {
    return <AccountSetupIncomplete email={decision.email} />
  }

  // Only an `active` state reaches here; narrow for the session.
  if (state.kind !== 'active') redirect('/auth/login')
  const { session } = state

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
