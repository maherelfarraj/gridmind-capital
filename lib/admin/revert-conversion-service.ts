/**
 * Executes the reversal planned by `planConversionReversal`.
 *
 * The admin client is injected rather than constructed here so this runs
 * identically from a server action and from a one-off repair script, and so
 * the sequencing is testable without a live database. There is exactly one
 * implementation of the repair; nothing writes these columns "by hand".
 */

import {
  planConversionReversal,
  verifyReversal,
  REVERSAL_OP,
  type ReversalPlan,
  type ReversibleProfile,
} from '@/lib/admin/revert-conversion'

type AnyClient = {
  from: (table: string) => any
}

export interface ReversalOutcome {
  profile: ReversibleProfile
  plan: ReversalPlan
  revokedGrants: number
}

/**
 * Restore an account that was unintentionally converted to an external
 * identity.
 *
 * `dryRun` performs every read and every check and returns the plan without
 * writing, so the exact change can be reviewed before it is applied.
 */
export async function revertExternalConversion(
  admin: AnyClient,
  args: { email: string; actorId: string; dryRun?: boolean },
): Promise<{ error: string } | ReversalOutcome> {
  // 1. Current state.
  const { data: profile, error: readErr } = await admin
    .from('profiles')
    .select('id, email, role, user_type, external_org, tenant_id, is_active')
    .eq('email', args.email)
    .maybeSingle()

  if (readErr) return { error: `Could not read profile: ${readErr.message}` }
  if (!profile) return { error: `No profile found for ${args.email}.` }

  // 2. The conversion that must be undone: the most recent provision_external
  //    audit row for this profile. The prior identity is taken from here, never
  //    assumed.
  const { data: auditRows, error: auditErr } = await admin
    .from('audit_log')
    .select('changed_at, old_values, new_values')
    .eq('table_name', 'profiles')
    .eq('record_id', profile.id)
    .order('changed_at', { ascending: false })
    .limit(25)

  if (auditErr) return { error: `Could not read audit history: ${auditErr.message}` }

  const conversion =
    (auditRows ?? []).find(
      (r: any) =>
        r?.new_values?.op === 'provision_external' &&
        r?.old_values &&
        r.old_values.user_type === 'internal',
    ) ?? null

  // 3. Plan and validate. Refuses on drift, on a missing audit trail, or when
  //    the account is already internal.
  const planned = planConversionReversal({ profile, auditRow: conversion })
  if ('error' in planned) return planned
  const { plan } = planned

  // 4. Count the external grants that must not survive the reversal. An
  //    internal profile carrying live external_access rows would keep the
  //    containment predicate treating it as a guest.
  const { data: liveGrants, error: grantErr } = await admin
    .from('external_access')
    .select('project_id')
    .eq('user_id', profile.id)
    .is('revoked_at', null)

  if (grantErr) return { error: `Could not read project access: ${grantErr.message}` }
  const revokedGrants = (liveGrants ?? []).length

  if (args.dryRun) return { profile, plan, revokedGrants }

  // 5. Revoke external project access FIRST. If the run fails after this the
  //    account is left with fewer privileges, not more.
  if (revokedGrants > 0) {
    const { error: revokeErr } = await admin
      .from('external_access')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .is('revoked_at', null)
    if (revokeErr) return { error: `Could not revoke project access: ${revokeErr.message}` }
  }

  // 6. Restore the authority fields. tenant_id, is_active, full_name and
  //    department are deliberately absent from this patch.
  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      role: plan.patch.role,
      user_type: plan.patch.user_type,
      external_org: plan.patch.external_org,
    })
    .eq('id', profile.id)

  if (updateErr) return { error: `Could not restore profile: ${updateErr.message}` }

  // 7. Audit the reversal itself, with the justification attached.
  const { error: auditWriteErr } = await admin.from('audit_log').insert({
    tenant_id: profile.tenant_id,
    table_name: 'profiles',
    record_id: profile.id,
    action: 'update',
    changed_by: args.actorId,
    old_values: plan.before,
    new_values: {
      op: REVERSAL_OP,
      ...plan.after,
      reason: plan.reason,
      reverses_conversion_at: plan.convertedAt,
      revoked_external_grants: revokedGrants,
    },
  })
  if (auditWriteErr) return { error: `Reversal audit write failed: ${auditWriteErr.message}` }

  // 8. Prove it persisted before reporting success.
  const { data: after, error: verifyErr } = await admin
    .from('profiles')
    .select('role, user_type, external_org')
    .eq('id', profile.id)
    .maybeSingle()

  if (verifyErr) return { error: `Reversal could not be verified: ${verifyErr.message}` }
  const mismatch = verifyReversal(after, plan.patch)
  if (mismatch) return { error: mismatch }

  return { profile, plan, revokedGrants }
}
