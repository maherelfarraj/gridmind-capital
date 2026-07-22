import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { SessionProvider } from '@/lib/session-context'
import { createClient } from '@/lib/supabase/server'
import { getUnreadCountAction } from '@/app/actions/notifications'
import {
  type AppSession,
  type AppRole,
  type AppPermission,
  mockSession,
} from '@/lib/session'

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

async function getSession(): Promise<AppSession> {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return mockSession

  // Fetch profile + tenant
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // Profile not yet created (trigger may still be running) — fall back gracefully
    return {
      ...mockSession,
      userId: user.id,
      email: user.email ?? '',
      fullName: user.user_metadata?.full_name ?? user.email ?? '',
    }
  }

  const appRole: AppRole = ROLE_MAP[profile.role] ?? 'viewer'
  const isSuperAdmin = appRole === 'super_admin'

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
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const session = await getSession()

  // External roles never see the internal dashboard — bounce to their portal.
  if (session.roles.includes('client_viewer')) redirect('/client')
  if (session.roles.includes('subcontractor')) redirect('/portal')

  // Count pending approvals scoped to this tenant
  const { count: approvalCount } = await supabase
    .from('approvals')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', session.tenantId)
    .eq('status', 'pending')

  // Live unread notification count for the bell badge
  const notificationCount = await getUnreadCountAction()

  return (
    <SessionProvider session={session}>
      <AppShell approvalCount={approvalCount ?? 0} notificationCount={notificationCount}>
        {children}
      </AppShell>
    </SessionProvider>
  )
}
