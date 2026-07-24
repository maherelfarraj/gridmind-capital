import { createClient } from '@/lib/supabase/server'
import {
  type AppSession,
  type AppRole,
  type AppPermission,
  type AppDigitStyle,
} from '@/lib/session'

// Map DB user_role → AppRole
const ROLE_MAP: Record<string, AppRole> = {
  system_admin:          'super_admin',
  tenant_admin:          'tenant_admin',
  project_director:      'pmo_director',
  project_manager:       'project_manager',
  engineer:              'engineering_manager',
  hse_manager:           'hse_manager',
  commissioning_manager: 'commissioning_manager',
  finance_manager:       'finance_controller',
  commercial_manager:    'procurement_manager',
  viewer:                'viewer',
  subcontractor:         'subcontractor',
  client_viewer:         'client_viewer',
}

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

/**
 * Resolve the current authenticated user's app session from Supabase auth +
 * their profile row. Returns null when unauthenticated OR authenticated but
 * unprovisioned (no profile). Never falls back to a mock identity.
 */
export async function resolveSession(): Promise<AppSession | null> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, tenant_id, locale, digit_style')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const appRole: AppRole = ROLE_MAP[profile.role] ?? 'viewer'
  const isSuperAdmin = appRole === 'super_admin'

  const locale: string = (profile as Record<string, unknown>).locale as string | null ?? 'en'
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
}
