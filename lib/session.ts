// ─────────────────────────────────────────────────────────────
// Session types + mock
// Replace mockSession with a real auth call (e.g. Better Auth /
// Supabase) when wiring up the backend.
// ─────────────────────────────────────────────────────────────

export type AppRole =
  | 'super_admin'
  | 'tenant_admin'
  | 'executive_sponsor'
  | 'pmo_director'
  | 'project_manager'
  | 'engineering_manager'
  | 'procurement_manager'
  | 'construction_manager'
  | 'hse_manager'
  | 'qaqc_manager'
  | 'commissioning_manager'
  | 'om_manager'
  | 'finance_controller'
  | 'client_pmc'
  | 'viewer'
  | 'subcontractor'
  | 'client_viewer'

export type AppPermission =
  | 'project.read'
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'approval.decide'
  | 'approval.read'
  | 'document.read'
  | 'document.upload'
  | 'document.approve'
  | 'finance.read'
  | 'finance.edit'
  | 'hse.read'
  | 'hse.report'
  | 'admin.users'
  | 'admin.settings'
  | 'admin.audit'

export type AppDigitStyle = 'western' | 'arabic_indic'

export interface AppSession {
  userId: string
  tenantId: string
  roles: AppRole[]
  permissions: AppPermission[]
  fullName: string
  email: string
  isSuperAdmin: boolean
  /** BCP-47 locale read from profiles.locale ('en' | 'ar'). Defaults to 'en'. */
  locale: string
  /** Digit style read from profiles.digit_style. Defaults to 'western'. */
  digitStyle: AppDigitStyle
}

// ─────────────────────────────────────────────────────────────
// Mock session — matches the pasted shape exactly.
// Swap this for a real session fetch when auth is wired up.
// ─────────────────────────────────────────────────────────────

export const mockSession: AppSession = {
  userId: '123',
  tenantId: '456',
  roles: ['project_manager'],
  permissions: ['project.read', 'project.create', 'approval.decide'],
  fullName: 'John Doe',
  email: 'john@example.com',
  isSuperAdmin: false,
  locale: 'en',
  digitStyle: 'western',
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Returns the user's initials (up to 2 chars) */
export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Human-readable label for a role */
export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  tenant_admin: 'Tenant Admin',
  executive_sponsor: 'Executive Sponsor',
  pmo_director: 'PMO Director',
  project_manager: 'Project Manager',
  engineering_manager: 'Engineering Manager',
  procurement_manager: 'Procurement Manager',
  construction_manager: 'Construction Manager',
  hse_manager: 'HSE Manager',
  qaqc_manager: 'QA/QC Manager',
  commissioning_manager: 'Commissioning Manager',
  om_manager: 'O&M Manager',
  finance_controller: 'Finance Controller',
  client_pmc: 'Client / PMC',
  viewer: 'Viewer',
  subcontractor: 'Subcontractor',
  client_viewer: 'Client Viewer',
}

/** Returns true if session has the given permission */
export function hasPermission(
  session: AppSession,
  permission: AppPermission,
): boolean {
  if (session.isSuperAdmin) return true
  return session.permissions.includes(permission)
}

/** Returns true if session has any of the given roles */
export function hasRole(session: AppSession, ...roles: AppRole[]): boolean {
  if (session.isSuperAdmin) return true
  return roles.some((r) => session.roles.includes(r))
}

/** Maps a session to the NavConfig UserRole bucket used for sidebar filtering */
export function toNavRole(session: AppSession): import('@/components/app-shell/nav-config').UserRole {
  if (session.isSuperAdmin) return 'admin'
  const role = session.roles[0]
  if (role === 'super_admin' || role === 'tenant_admin') return 'admin'
  if (role === 'subcontractor') return 'subcontractor'
  if (role === 'client_viewer') return 'client_viewer'
  if (role === 'viewer') return 'viewer'
  if (role === 'engineering_manager') return 'engineer'
  if (role === 'project_manager' || role === 'pmo_director') return 'pm'
  return 'pm'
}
