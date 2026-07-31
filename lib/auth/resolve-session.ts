import { createClient } from '@/lib/supabase/server'
import {
  type AppSession,
  type AppRole,
  type AppDigitStyle,
} from '@/lib/session'
import { isDbUserRole } from '@/lib/auth/guard'

/**
 * Resolve the current authenticated user's app session from Supabase auth +
 * their profile row.
 *
 * Returns null when:
 *   - Unauthenticated
 *   - Profile does not exist (unprovisioned)
 *   - Profile is inactive
 *   - Profile has no tenant_id (unprovisioned)
 *   - Profile role is not canonical
 *
 * FAIL-CLOSED: Never falls back to a mock identity or viewer role.
 */
export async function resolveSession(): Promise<AppSession | null> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, tenant_id, is_active, locale, digit_style')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // FAIL-CLOSED: User must be active
  if (!profile.is_active) return null

  // FAIL-CLOSED: User must have a provisioned tenant
  if (!profile.tenant_id) return null

  // FAIL-CLOSED: Role must be in canonical whitelist (no fallback to viewer)
  if (!isDbUserRole(profile.role)) return null

  const appRole: AppRole = profile.role
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
