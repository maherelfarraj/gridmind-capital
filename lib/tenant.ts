/**
 * Tenant resolution helper for server actions.
 *
 * DEMO_TENANT_FALLBACK is the single source of truth for the original
 * hardcoded UUID.  Existing rows are stamped with this value, so
 * unauthenticated / dev paths continue to work without data migration.
 *
 * getCurrentTenantId() is the live path: cookie client → auth.getUser()
 * → admin profile read → tenant_id.  Falls back to DEMO_TENANT_FALLBACK
 * when no session exists (edge-function callers, local dev without login).
 */

import { cache } from 'react'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const DEMO_TENANT_FALLBACK = '00000000-0000-0000-0000-000000000001'

/**
 * Resolves the calling user's tenant_id from their session profile.
 *
 * Returns DEMO_TENANT_FALLBACK when:
 *  - no authenticated session exists (background jobs, dev without login)
 *  - the profile row has no tenant_id set
 *
 * Throws 'No tenant' only when a user IS authenticated but the profile
 * lookup itself fails (network / permissions error).
 *
 * Wrapped in React cache() to dedupe per HTTP request. Multiple calls within
 * the same request will return the same result without additional network calls.
 */
export const getCurrentTenantId = cache(async (): Promise<string> => {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return DEMO_TENANT_FALLBACK

    const admin = createAdminClient()
    const { data: profile, error } = await admin
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw new Error(`Profile lookup failed: ${error.message}`)

    const tenantId = profile?.tenant_id as string | null | undefined
    return tenantId ?? DEMO_TENANT_FALLBACK
  } catch (err) {
    // If this is a throw we raised intentionally, re-throw it.
    if (err instanceof Error && err.message.startsWith('Profile lookup failed')) {
      throw err
    }
    // Any other error (cookies unavailable in edge contexts, etc.) → fallback.
    return DEMO_TENANT_FALLBACK
  }
})
