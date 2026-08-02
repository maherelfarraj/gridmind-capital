/**
 * External vs internal identity classification, and the guards the external
 * invite path needs.
 *
 * Pure and dependency-free so it is testable under the `node` vitest
 * environment, and importable from both server actions and client components
 * (`lib/auth/provisioning.ts` is `import 'server-only'`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Why identity is decided by TWO signals, not one
 * ─────────────────────────────────────────────────────────────────────────
 * Production contains a profile that is external by role and internal by
 * column: `role='subcontractor'`, `user_type='internal'`, `external_org=NULL`
 * (seeded 2026-07-28, before the canonical provisioning service existed).
 *
 * The canonical server predicate `isExternalRole()` keys off ROLE ONLY, so that
 * row is already treated as external for containment. Anything here that keyed
 * off `user_type` alone would disagree with the security boundary and leak the
 * row into internal surfaces. So a profile is external when EITHER signal says
 * so — the fail-safe direction, since misclassifying an external user as
 * internal is the direction that grants visibility rather than withholding it.
 */

import { DB_EXTERNAL_ROLES } from '@/lib/auth/roles'

/** The subset of a profile needed to classify its identity. */
export interface IdentityShape {
  role?: string | null
  user_type?: string | null
}

/**
 * True when the profile is an external identity by EITHER signal.
 *
 * Deliberately not `user_type === 'external'`: see the module note above.
 */
export function isExternalIdentity(profile: IdentityShape | null | undefined): boolean {
  if (!profile) return false
  const roleIsExternal =
    typeof profile.role === 'string' &&
    (DB_EXTERNAL_ROLES as readonly string[]).includes(profile.role)
  return roleIsExternal || profile.user_type === 'external'
}

/** True when the profile is an internal identity (the complement). */
export function isInternalIdentity(profile: IdentityShape | null | undefined): boolean {
  return !isExternalIdentity(profile)
}

/**
 * Explicit conflict message for an external invite aimed at an email that
 * already belongs to an INTERNAL user.
 *
 * Returns null when the invite may proceed (no existing profile, or the
 * existing profile is already external and is simply being re-invited).
 *
 * Silently converting an internal colleague into a subcontractor would be a
 * privilege change disguised as an invite: it rewrites role, user_type and
 * external_org on an account the admin did not intend to touch, and reports
 * success. Refuse instead, and name the account so the admin can act on it.
 */
export function externalInviteConflict(
  existing: (IdentityShape & { email?: string | null }) | null | undefined,
): string | null {
  if (!existing) return null
  if (isExternalIdentity(existing)) return null

  const who = existing.email?.trim() || 'That email'
  return (
    `${who} already belongs to an internal user (role "${existing.role ?? 'unknown'}"). ` +
    'Converting an internal account to an external one is not done through an invite. ' +
    'Remove or deactivate the internal account first, or invite a different address.'
  )
}

/** What the caller asked to persist, for post-write verification. */
export interface ExpectedExternalState {
  role: string
  externalOrg: string
  tenantId: string
}

/**
 * Verify the row that is actually in the database after provisioning.
 *
 * The invite reported success purely because no error was returned. A silent
 * partial write — the exact failure reported for this flow — then looks
 * identical to a correct one. Reading the row back and asserting every field
 * makes "success" mean "persisted", not "did not throw".
 */
export function verifyPersistedExternalState(
  actual: (IdentityShape & { external_org?: string | null; tenant_id?: string | null }) | null | undefined,
  expected: ExpectedExternalState,
): string | null {
  if (!actual) {
    return 'Invite could not be verified: the profile was not found after provisioning.'
  }

  const problems: string[] = []
  if (actual.role !== expected.role) {
    problems.push(`role is "${actual.role ?? 'null'}", expected "${expected.role}"`)
  }
  if (actual.user_type !== 'external') {
    problems.push(`user_type is "${actual.user_type ?? 'null'}", expected "external"`)
  }
  if ((actual.external_org ?? '') !== expected.externalOrg) {
    problems.push(
      `external_org is "${actual.external_org ?? 'null'}", expected "${expected.externalOrg}"`,
    )
  }
  if (actual.tenant_id !== expected.tenantId) {
    problems.push('tenant_id does not match the inviting tenant')
  }

  if (problems.length === 0) return null
  return `Invite did not persist as an external user (${problems.join('; ')}).`
}
