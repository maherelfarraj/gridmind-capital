import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { SessionProvider } from '@/lib/session-context'
import { createClient } from '@/lib/supabase/server'
import { getUnreadCountAction } from '@/app/actions/notifications'
import { getPendingApprovalCount } from '@/app/actions/approvals'
import { signOutAction } from '@/app/actions/auth'
import {
  type AppSession,
  type AppRole,
  type AppPermission,
  type AppDigitStyle,
} from '@/lib/session'

import { cache } from 'react'

// Map DB user_role → AppRole
const ROLE_MAP: Record<string, AppRole> = {
  system_admin:         'super_admin',
  tenant_admin:         'tenant_admin',
  project_director:     'pmo_director',
  project_manager:      'project_manager',
  engineer:             'engineering_manager',
  hse_manager:          'hse_manager',
  commissioning_manager:'commissioning_manager',
  finance_manager:      'finance_controller',
  commercial_manager:   'procurement_manager',
  viewer:               'viewer',
  subcontractor:        'subcontractor',
  client_viewer:        'client_viewer',
}

// Permissions granted per role
const ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  super_admin:           ['project.read','project.create','project.update','project.delete','approval.decide','approval.read','document.read','document.upload','document.approve','finance.read','finance.edit','hse.read','hse.report','admin.users','admin.settings','admin.audit'],
  tenant_admin:          ['project.read','project.create','project.update','project.delete','approval.decide','approval.read','document.read','document.upload','document.approve','finance.read','finance.edit','hse.read','hse.report','admin.users','admin.settings','admin.audit'],
  pmo_director:          ['project.read','project.create','project.update','approval.decide','approval.read','document.read','document.upload','document.approve','finance.read','hse.read','hse.report'],
  project_manager:       ['project.read','project.create','project.update','approval.decide','approval.read','document.read','document.upload','finance.read','hse.read','hse.report'],
  engineering_manager:   ['project.read','project.update','approval.read','document.read','document.upload','hse.read'],
  hse_manager:           ['project.read','approval.read','document.read','document.upload','hse.read','hse.report'],
  commissioning_manager: ['project.read','approval.read','document.read','document.upload','hse.read'],
  construction_manager:  ['project.read','approval.read','document.read','document.upload','hse.read','hse.report'],
  finance_controller:    ['project.read','approval.read','document.read','finance.read','finance.edit'],
  procurement_manager:   ['project.read','approval.decide','approval.read','document.read','document.upload'],
  qaqc_manager:          ['project.read','approval.read','document.read','document.upload','hse.read'],
  om_manager:            ['project.read','approval.read','document.read','hse.read'],
  executive_sponsor:     ['project.read','approval.read','document.read','finance.read','hse.read'],
  client_pmc:            ['project.read','approval.read','document.read'],
  viewer:                ['project.read','approval.read','document.read'],
  subcontractor:         ['project.read','document.read'],
  client_viewer:         ['project.read','document.read'],
}

// Returns the resolved session, or null when the authenticated user has no
// profile row. We NEVER fall back to a mock/default identity here — doing so
// would silently grant a real role, permissions and tenant to an account that
// has not been provisioned.
//
// Wrapped in React cache() to dedupe per HTTP request.
const getSession = cache(async (): Promise<AppSession | null> => {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null

  // Fetch profile + tenant + i18n preferences
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, tenant_id, locale, digit_style')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // Authenticated but not provisioned — caller must show the setup screen.
    return null
  }

  const appRole: AppRole = ROLE_MAP[profile.role] ?? 'viewer'
  const isSuperAdmin = appRole === 'super_admin'

  // Resolve i18n preferences from profile columns. These columns may not exist
  // yet in older migrations — coerce nulls to safe defaults.
  const locale: string     = (profile as Record<string, unknown>).locale as string | null ?? 'en'
  const digitStyle: AppDigitStyle =
    ((profile as Record<string, unknown>).digit_style as string | null) === 'arabic_indic'
      ? 'arabic_indic'
      : 'western'

  return {
    userId:      profile.id,
    tenantId:    profile.tenant_id,
    roles:       [appRole],
    permissions: isSuperAdmin
      ? (Object.values(ROLE_PERMISSIONS).flat() as AppPermission[])
      : (ROLE_PERMISSIONS[appRole] ?? ['project.read']),
    fullName:    profile.full_name || user.email?.split('@')[0] || 'User',
    email:       profile.email || user.email || '',
    isSuperAdmin,
    locale,
    digitStyle,
  }
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
