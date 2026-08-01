import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDbUserRole, type DbUserRole } from '@/lib/auth/roles'

/**
 * THE canonical server-side identity resolver.
 *
 * Every authorization path in the app funnels through this module:
 *   • lib/auth/guard.ts        → getAuthActor() for server-action guards
 *   • lib/db/queries.ts        → getActor() for data-layer tenant scoping
 *   • lib/auth/resolve-session → resolveSessionState() for layout routing
 *   • lib/tenant.ts            → getCurrentTenantId()
 *
 * There is deliberately ONE identity algorithm. Maintaining a second one is how
 * the weaker `getActor()` drifted into accepting inactive profiles, null
 * tenants and unvalidated roles while `getAuthActor()` rejected them.
 *
 * FAIL-CLOSED: a partial or malformed identity is never coerced into a working
 * one. There is no `?? 'viewer'` fallback and no demo/default tenant.
 */

/** Why an identity was rejected. Internal — never surface raw DB text. */
export type ActorFailureReason =
  | 'not_authenticated'
  | 'profile_lookup_failed'
  | 'profile_missing'
  | 'profile_inactive'
  | 'tenant_missing'
  | 'role_invalid'

/** A fully validated identity. Every field is non-null by construction. */
export interface ResolvedActor {
  userId: string
  role: DbUserRole
  tenantId: string
  isActive: true
}

/**
 * Profile columns carried alongside the actor so presentation callers
 * (resolveSessionState) do not need a second round trip.
 */
export interface ResolvedProfile {
  fullName: string | null
  email: string | null
  locale: string | null
  digitStyle: string | null
}

export type ActorResolution =
  | {
      kind: 'invalid'
      reason: ActorFailureReason
      /** Auth email when known — lets the UI say who is signed in. */
      email: string | null
    }
  | {
      kind: 'valid'
      actor: ResolvedActor
      profile: ResolvedProfile
      /** Auth email, falling back to the profile email. */
      email: string
    }

/** Operator-facing messages. Deliberately free of database error text. */
const FAILURE_MESSAGES: Record<ActorFailureReason, string> = {
  not_authenticated: 'Not authenticated',
  profile_lookup_failed: 'Unable to verify your account. Contact administrator.',
  profile_missing: 'User profile not found. Contact administrator.',
  profile_inactive: 'User account is inactive. Contact administrator.',
  tenant_missing: 'User is not provisioned to any tenant. Contact administrator.',
  role_invalid: 'User role is invalid or unassigned. Contact administrator.',
}

/** Safe, non-leaking message for a rejection reason. */
export function actorFailureMessage(reason: ActorFailureReason): string {
  return FAILURE_MESSAGES[reason]
}

/**
 * Resolve and validate the caller's identity.
 *
 * Success requires ALL of:
 *   1. an authenticated Supabase user
 *   2. a profile query that did not error
 *   3. a profile row that exists
 *   4. is_active IS TRUE
 *   5. a non-null tenant_id
 *   6. a role accepted by isDbUserRole()
 *
 * Wrapped in React cache() so repeated calls within one request share a result.
 */
export const resolveActorState = cache(async (): Promise<ActorResolution> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { kind: 'invalid', reason: 'not_authenticated', email: null }

  const authEmail = user.email ?? null

  // The profile lookup uses the admin client on purpose: reading one's own
  // identity must not itself depend on the RLS policies being evaluated.
  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, full_name, email, role, tenant_id, is_active, locale, digit_style')
    .eq('id', user.id)
    // maybeSingle(), not single(): single() raises an error for zero rows, which
    // would collapse `profile_missing` into `profile_lookup_failed`.
    .maybeSingle()

  // The database error is intentionally not propagated to the caller.
  if (error) return { kind: 'invalid', reason: 'profile_lookup_failed', email: authEmail }
  if (!profile) return { kind: 'invalid', reason: 'profile_missing', email: authEmail }

  if (profile.is_active !== true) {
    return { kind: 'invalid', reason: 'profile_inactive', email: authEmail }
  }

  if (!profile.tenant_id) {
    return { kind: 'invalid', reason: 'tenant_missing', email: authEmail }
  }

  // No silent downgrade: an unrecognised role is rejected, never mapped to viewer.
  if (!isDbUserRole(profile.role)) {
    return { kind: 'invalid', reason: 'role_invalid', email: authEmail }
  }

  return {
    kind: 'valid',
    actor: {
      userId: user.id,
      role: profile.role,
      tenantId: profile.tenant_id,
      isActive: true,
    },
    profile: {
      fullName: profile.full_name ?? null,
      email: profile.email ?? null,
      locale: profile.locale ?? null,
      digitStyle: profile.digit_style ?? null,
    },
    email: authEmail ?? profile.email ?? '',
  }
})
