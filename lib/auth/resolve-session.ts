import { createClient } from '@/lib/supabase/server'
import {
  type AppSession,
  type AppRole,
  type AppPermission,
  type AppDigitStyle,
} from '@/lib/session'
import { isDbUserRole } from '@/lib/auth/roles'

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

  // Validate role is canonical; fall back to 'viewer' if not recognized
  const appRole: AppRole = isDbUserRole(profile.role) ? profile.role : 'viewer'
  const isSuperAdmin = appRole === 'system_admin'

  const locale: string = (profile as Record<string, unknown>).locale as string | null ?? 'en'
  const digitStyle: AppDigitStyle =
    ((profile as Record<string, unknown>).digit_style as string | null) === 'arabic_indic'
      ? 'arabic_indic'
      : 'western'

  return {
    userId:      profile.id,
    tenantId:    profile.tenant_id,
    roles:       [appRole],
    permissions: [], // Permissions are now evaluated via requireRole/requireInternalRole guards
    fullName:    profile.full_name || user.email?.split('@')[0] || 'User',
    email:       profile.email || user.email || '',
    isSuperAdmin,
    locale,
    digitStyle,
  }
}
