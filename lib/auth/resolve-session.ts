import 'server-only'
import {
  resolveActorState,
  type ActorFailureReason,
} from '@/lib/auth/actor'
import {
  type AppSession,
  type AppRole,
  type AppDigitStyle,
} from '@/lib/session'

/**
 * Session resolution for layouts and pages.
 *
 * `resolveSession()` collapses every failure into `null`, which forced callers
 * to treat "not signed in" and "signed in but not provisioned" identically —
 * so an authenticated user with no profile got bounced to the login page they
 * had already completed. `resolveSessionState()` distinguishes the two.
 *
 * Identity validation itself is NOT reimplemented here; it delegates to the
 * canonical resolver in lib/auth/actor.ts.
 */

/** Why an authenticated user is not yet usable. Mirrors the resolver's reasons. */
export type UnprovisionedReason = Exclude<ActorFailureReason, 'not_authenticated'>

export type SessionResolution =
  | { kind: 'unauthenticated' }
  | {
      kind: 'unprovisioned'
      email: string
      reason: UnprovisionedReason
    }
  | {
      kind: 'active'
      session: AppSession
    }

/**
 * Resolve the caller into one of three mutually exclusive states.
 *
 *   no user                → unauthenticated
 *   profile query error    → unprovisioned / profile_lookup_failed
 *   no profile row         → unprovisioned / profile_missing
 *   is_active false        → unprovisioned / profile_inactive
 *   null tenant_id         → unprovisioned / tenant_missing
 *   non-canonical role     → unprovisioned / role_invalid
 *   otherwise              → active
 *
 * No Supabase or Postgres error text is ever included in the result.
 */
export async function resolveSessionState(): Promise<SessionResolution> {
  const state = await resolveActorState()

  if (state.kind === 'invalid') {
    if (state.reason === 'not_authenticated') return { kind: 'unauthenticated' }

    return {
      kind: 'unprovisioned',
      email: state.email ?? '',
      reason: state.reason,
    }
  }

  const { actor, profile, email } = state

  const appRole: AppRole = actor.role
  const digitStyle: AppDigitStyle =
    profile.digitStyle === 'arabic_indic' ? 'arabic_indic' : 'western'

  return {
    kind: 'active',
    session: {
      userId: actor.userId,
      tenantId: actor.tenantId,
      roles: [appRole],
      // Permissions are evaluated via requireRole/requireInternalRole guards.
      permissions: [],
      fullName: profile.fullName || email.split('@')[0] || 'User',
      email,
      isSuperAdmin: appRole === 'system_admin',
      locale: profile.locale ?? 'en',
      digitStyle,
    },
  }
}

/**
 * Compatibility wrapper for call sites that still expect `AppSession | null`.
 *
 * This does NOT weaken authorization: it returns a session only for the
 * `active` state, exactly as before. It merely discards the distinction
 * between unauthenticated and unprovisioned. Prefer resolveSessionState() in
 * new code so the unprovisioned case can be rendered instead of redirected.
 */
export async function resolveSession(): Promise<AppSession | null> {
  const state = await resolveSessionState()
  return state.kind === 'active' ? state.session : null
}
