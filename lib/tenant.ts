/**
 * Tenant resolution helper for server actions.
 *
 * getCurrentTenantId() requires an authenticated session. It throws an error
 * when no session exists or when profile lookup fails. Pages that legitimately
 * render unauthenticated must redirect to login instead of catching this error.
 *
 * Wrapped in React cache() to dedupe per HTTP request. Multiple calls within
 * the same request will return the same result without additional network calls.
 */

import { cache } from 'react'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolves the calling user's tenant_id from their session profile.
 *
 * Throws 'Unauthorized' when no authenticated session exists.
 * Throws 'Profile lookup failed' when profile lookup errors occur.
 * Throws 'No tenant configured' when profile has no tenant_id set.
 *
 * Callers MUST handle these errors explicitly. Do not fall back to demo-tenant.
 */
export const getCurrentTenantId = cache(async (): Promise<string> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized: No authenticated session')

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(`Profile lookup failed: ${error.message}`)
  if (!profile?.tenant_id) throw new Error('No tenant configured for user')

  return profile.tenant_id
})
