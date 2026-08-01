import 'server-only'
import { resolveActorState, actorFailureMessage } from '@/lib/auth/actor'

/**
 * Tenant resolution helper for server actions.
 *
 * Delegates to the canonical resolver in lib/auth/actor.ts rather than running
 * a third independent identity algorithm. Caching is inherited from that
 * resolver, so repeated calls within one request share a single lookup.
 */

/**
 * Resolves the calling user's tenant_id.
 *
 * FAIL-CLOSED: throws when the caller is unauthenticated, the profile lookup
 * fails, the profile is missing, the profile is inactive, the tenant is null,
 * or the role is not canonical.
 *
 * The tenant is ALWAYS derived from the authenticated session. It is never
 * accepted from caller input, and there is no demo/default tenant fallback.
 * Callers must handle the throw explicitly; pages that legitimately render
 * unauthenticated must redirect to login instead of catching it.
 */
export async function getCurrentTenantId(): Promise<string> {
  const state = await resolveActorState()

  if (state.kind === 'invalid') {
    throw new Error(actorFailureMessage(state.reason))
  }

  return state.actor.tenantId
}
