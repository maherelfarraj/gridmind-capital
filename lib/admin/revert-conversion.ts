/**
 * Reversal of an unintended internal → external conversion.
 *
 * An invite through the External access tab converted existing INTERNAL
 * accounts into subcontractors and reported success. The writer-level guard in
 * `provisionExternalUser` now refuses that conversion, but accounts already
 * converted must be restored, and restoring them must not become a second
 * uncontrolled write path.
 *
 * The rules this module enforces:
 *
 *  - The restored values are READ BACK OUT OF THE AUDIT ROW that performed the
 *    conversion. Nothing is hardcoded and nothing is guessed. If the audit
 *    trail cannot prove what the account used to be, the reversal is refused.
 *  - The current profile must still match what that conversion wrote. If
 *    anything changed afterwards, the reversal is refused rather than
 *    clobbering a later, possibly deliberate, edit.
 *  - Only `role`, `user_type` and `external_org` are restored. `tenant_id`,
 *    `is_active`, `full_name` and `department` are never touched.
 *
 * The planning is pure so every rule above is unit-testable with no database.
 */

import { isInternalIdentity } from '@/lib/admin/external-identity'

/** The subset of a profile this reversal reasons about. */
export interface ReversibleProfile {
  id: string
  email: string | null
  role: string | null
  user_type: string | null
  external_org: string | null
  tenant_id: string | null
  is_active: boolean | null
}

/** The audit row written by the conversion being reversed. */
export interface ConversionAuditRow {
  changed_at: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
}

/** The authority fields a reversal is allowed to write. */
export interface ReversalPatch {
  role: string
  user_type: string
  external_org: string | null
}

export interface ReversalPlan {
  patch: ReversalPatch
  /** Recorded as `old_values` on the reversal's own audit row. */
  before: Record<string, unknown>
  /** Recorded as `new_values` on the reversal's own audit row. */
  after: Record<string, unknown>
  /** Human-readable justification, stored in the audit row. */
  reason: string
  convertedAt: string | null
}

export const REVERSAL_OP = 'revert_unintended_external_conversion'

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

/**
 * Decide whether a conversion can be safely reversed, and to what.
 *
 * Returns an error string instead of throwing so callers can surface it
 * verbatim; a reversal that cannot be proven correct must not proceed.
 */
export function planConversionReversal(args: {
  profile: ReversibleProfile | null
  auditRow: ConversionAuditRow | null
}): { plan: ReversalPlan } | { error: string } {
  const { profile, auditRow } = args

  if (!profile) return { error: 'No such profile.' }

  // Nothing to reverse. Stated positively so a repeated run is a safe no-op
  // rather than a second write.
  if (isInternalIdentity({ role: profile.role, user_type: profile.user_type })) {
    return { error: `${profile.email ?? profile.id} is already an internal user. Nothing to reverse.` }
  }

  if (!auditRow) {
    return {
      error:
        'No conversion audit row was found for this account, so its previous ' +
        'identity cannot be proven. Refusing to guess.',
    }
  }

  const before = auditRow.old_values ?? {}
  const after = auditRow.new_values ?? {}

  const priorRole = str(before.role)
  const priorUserType = str(before.user_type)

  if (!priorRole || !priorUserType) {
    return {
      error:
        'The conversion audit row does not record the previous role and ' +
        'user_type, so the account cannot be restored from it.',
    }
  }

  // The row must describe an internal → external conversion. Reversing an
  // external → external re-invite would be meaningless, and reversing anything
  // else would be outside this repair's remit.
  if (!isInternalIdentity({ role: priorRole, user_type: priorUserType })) {
    return {
      error:
        `The most recent conversion did not change an internal account ` +
        `(it was already ${priorRole}/${priorUserType}). Nothing to reverse.`,
    }
  }

  // Fail closed on drift: the live row must still be exactly what the
  // conversion wrote. If someone has since edited the account deliberately,
  // this reversal must not silently overwrite that.
  const drift: string[] = []
  if (str(after.role) && profile.role !== str(after.role)) {
    drift.push(`role is "${profile.role}" but the conversion wrote "${after.role}"`)
  }
  if (str(after.user_type) && profile.user_type !== str(after.user_type)) {
    drift.push(`user_type is "${profile.user_type}" but the conversion wrote "${after.user_type}"`)
  }
  if (profile.tenant_id !== (str(after.tenant_id) ?? profile.tenant_id)) {
    drift.push(`tenant_id changed since the conversion`)
  }
  if (drift.length > 0) {
    return {
      error:
        `This account has changed since the unintended conversion ` +
        `(${drift.join('; ')}). Refusing to overwrite a later change.`,
    }
  }

  return {
    plan: {
      patch: {
        role: priorRole,
        user_type: priorUserType,
        // Restored to the recorded prior value, which for an internal account
        // is null. Written explicitly so the external organisation is cleared
        // rather than left dangling on an internal profile.
        external_org: str(before.external_org),
      },
      before: {
        role: profile.role,
        user_type: profile.user_type,
        external_org: profile.external_org,
        tenant_id: profile.tenant_id,
        is_active: profile.is_active,
      },
      after: {
        role: priorRole,
        user_type: priorUserType,
        external_org: str(before.external_org),
        // Echoed unchanged to make it evident in the audit trail that the
        // reversal did not touch them.
        tenant_id: profile.tenant_id,
        is_active: profile.is_active,
      },
      reason:
        'Reverses an unintended internal-to-external conversion performed during ' +
        'preview testing of the external invite flow. Restores the role and ' +
        'user_type recorded in the conversion audit row; tenant and active ' +
        'status unchanged.',
      convertedAt: auditRow.changed_at,
    },
  }
}

/**
 * Confirm the reversal actually persisted. "No error returned" is not "the
 * write happened" — that assumption is what allowed the original conversion to
 * be reported as a success over a wrong database state.
 */
export function verifyReversal(
  actual: Pick<ReversibleProfile, 'role' | 'user_type' | 'external_org'> | null,
  expected: ReversalPatch,
): string | null {
  if (!actual) return 'Reversal could not be verified: the profile could not be read back.'
  if (actual.role !== expected.role) {
    return `Reversal did not persist: role is "${actual.role}", expected "${expected.role}".`
  }
  if (actual.user_type !== expected.user_type) {
    return `Reversal did not persist: user_type is "${actual.user_type}", expected "${expected.user_type}".`
  }
  if ((actual.external_org ?? null) !== (expected.external_org ?? null)) {
    return `Reversal did not persist: external_org is "${actual.external_org}", expected "${expected.external_org}".`
  }
  return null
}
