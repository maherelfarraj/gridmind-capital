import 'server-only'

/**
 * THE canonical, fail-closed provisioning service.
 *
 * This module is the ONLY application-level writer of the protected profile
 * authority fields:
 *
 *   tenant_id, role, is_active, user_type, external_org, home_role_id, department
 *
 * Everything else (server actions, route handlers, components) must delegate
 * here. Direct writes to those columns elsewhere are a P0 defect: they bypass
 * the authorization matrix, the target validation, and the audit trail all at
 * once, and each duplicate implementation drifts independently.
 *
 * Design rules:
 *  - Authorization is derived from the canonical actor ONLY. Caller role and
 *    caller tenant are never accepted as input.
 *  - There is no generic "patch this profile" export. Each operation states
 *    exactly which authority fields it may move, so a new field cannot be
 *    smuggled through an unrestricted object.
 *  - Auth metadata (auth.users.user_metadata) is never an authority source.
 *    The hardened handle_new_user trigger ignores it; so do we.
 *  - Every authority mutation is audited, and a failed audit fails the
 *    operation (see writeAuthorityAudit).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActorState, actorFailureMessage, type ResolvedActor } from '@/lib/auth/actor'
import { DB_USER_ROLES, isDbUserRole, type DbUserRole } from '@/lib/auth/roles'

type AdminClient = ReturnType<typeof createAdminClient>

// ─────────────────────────────────────────────────────────────
// Vocabulary
// ─────────────────────────────────────────────────────────────

export type UserTypeClass = 'internal' | 'external'

/**
 * THE exhaustive internal/external classification of the canonical role
 * vocabulary.
 *
 * This is a `Record<DbUserRole, …>`, NOT a filter over an external allowlist.
 * Derivation by exclusion is fail-open: a role added to DB_USER_ROLES and
 * forgotten would silently classify as `internal`, quietly granting staff
 * user_type — and, with it, whatever internal surfaces key off user_type — to a
 * role nobody ever reviewed.
 *
 * Because every key is required, adding a role to DB_USER_ROLES BREAKS
 * TYPECHECK here until it is explicitly classified. That compile error is the
 * control; the map is deliberately verbose so the failure is unmissable.
 */
export const USER_TYPE_BY_ROLE: Record<DbUserRole, UserTypeClass> = {
  system_admin: 'internal',
  tenant_admin: 'internal',
  project_director: 'internal',
  project_manager: 'internal',
  engineer: 'internal',
  hse_manager: 'internal',
  commissioning_manager: 'internal',
  finance_manager: 'internal',
  commercial_manager: 'internal',
  viewer: 'internal',
  subcontractor: 'external',
  client_viewer: 'external',
}

/** Roles an EXTERNAL identity may hold, derived from the exhaustive map. */
export const EXTERNAL_ROLES: readonly DbUserRole[] = DB_USER_ROLES.filter(
  (r) => USER_TYPE_BY_ROLE[r] === 'external',
)
export type ExternalRole = DbUserRole

/** Roles an INTERNAL identity may hold, derived from the exhaustive map. */
export const INTERNAL_ROLES: readonly DbUserRole[] = DB_USER_ROLES.filter(
  (r) => USER_TYPE_BY_ROLE[r] === 'internal',
)

/**
 * Classify a role. Unknown input is NOT classified — callers must treat an
 * unrecognised role as invalid rather than defaulting it to a user_type.
 */
export function userTypeForRole(role: DbUserRole): UserTypeClass {
  return USER_TYPE_BY_ROLE[role]
}

export function isExternalRole(value: unknown): value is ExternalRole {
  return isDbUserRole(value) && USER_TYPE_BY_ROLE[value] === 'external'
}

export function isInternalRole(value: unknown): value is DbUserRole {
  return isDbUserRole(value) && USER_TYPE_BY_ROLE[value] === 'internal'
}

/** Roles permitted to provision anyone at all. */
const PROVISIONER_ROLES: readonly DbUserRole[] = ['system_admin', 'tenant_admin']

export type ProvisioningResult<T = void> = { data: T } | { error: string }

// ─────────────────────────────────────────────────────────────
// Caller authorization
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the caller through the canonical identity algorithm and require that
 * they may provision. Returns the ACTOR, never anything caller-supplied.
 */
async function requireProvisioner(): Promise<{ actor: ResolvedActor } | { error: string }> {
  const state = await resolveActorState()
  if (state.kind === 'invalid') return { error: actorFailureMessage(state.reason) }

  const actor = state.actor
  if (!PROVISIONER_ROLES.includes(actor.role)) {
    return { error: 'Not authorized: only tenant_admin or system_admin can provision users' }
  }
  return { actor }
}

/**
 * The protected authority fields, as stored.
 *
 * external_org is protected, not cosmetic: it is the organisation an external
 * identity acts on behalf of, so it is part of who that identity IS. The P0
 * migration's profile_protect_sensitive_fields trigger already lists it
 * alongside role and tenant_id, so leaving it out of this service would mean
 * the one column the database treats as authority had no application-level
 * owner, no validation, and no audit trail.
 */
interface ProfileAuthority {
  id: string
  tenant_id: string | null
  role: string | null
  is_active: boolean | null
  user_type: string | null
  external_org: string | null
  home_role_id: string | null
  department: string | null
}

const AUTHORITY_COLUMNS =
  'id, tenant_id, role, is_active, user_type, external_org, home_role_id, department'

/**
 * Enforce the authorization matrix against a concrete target.
 *
 * system_admin  — may act across tenants and may assign or modify system_admin.
 * tenant_admin  — confined to actor.tenantId, may not create/modify/demote a
 *                 system_admin, and may not move a user between tenants.
 *
 * Self-mutation of role or active state is refused for BOTH, which is what
 * "may not elevate themselves" requires; a system_admin who genuinely needs a
 * role change must be changed by a different system_admin, so the audit trail
 * always names a second party.
 */
function authorizeTargetMutation(args: {
  actor: ResolvedActor
  target: ProfileAuthority
  nextRole?: DbUserRole
  nextTenantId?: string
  nextActive?: boolean
}): { error: string } | null {
  const { actor, target, nextRole, nextTenantId, nextActive } = args

  const roleChanges = nextRole !== undefined && nextRole !== target.role
  const activeChanges = nextActive !== undefined && nextActive !== target.is_active

  if (actor.userId === target.id && (roleChanges || activeChanges)) {
    return { error: 'You cannot change your own role or active state' }
  }

  if (actor.role === 'system_admin') return null

  // ── tenant_admin ───────────────────────────────────────────
  if (target.tenant_id !== actor.tenantId) {
    return { error: 'Cannot modify users outside your tenant' }
  }
  if (nextTenantId !== undefined && nextTenantId !== actor.tenantId) {
    return { error: 'Cannot move users to another tenant' }
  }
  if (target.role === 'system_admin') {
    return { error: 'Cannot modify a system_admin account' }
  }
  if (nextRole === 'system_admin') {
    return { error: 'Only system_admin can assign the system_admin role' }
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────

async function loadTarget(
  admin: AdminClient,
  userId: string,
): Promise<{ target: ProfileAuthority } | { error: string }> {
  const { data, error } = await admin
    .from('profiles')
    .select(AUTHORITY_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  // maybeSingle(), not single(): single() errors on zero rows, which would
  // collapse "no such user" into an opaque lookup failure.
  if (error) return { error: `Profile lookup failed: ${error.message}` }
  if (!data) return { error: 'Target user not found' }
  return { target: data as ProfileAuthority }
}

async function assertTenantExists(
  admin: AdminClient,
  tenantId: string,
): Promise<{ error: string } | null> {
  const { data, error } = await admin.from('tenants').select('id').eq('id', tenantId).maybeSingle()
  if (error) return { error: `Tenant lookup failed: ${error.message}` }
  if (!data) return { error: 'Target tenant does not exist' }
  return null
}

/** home_role_id must reference a real seat in the role catalogue. */
async function assertHomeRoleValid(
  admin: AdminClient,
  homeRoleId: string,
): Promise<{ error: string } | null> {
  const { data, error } = await admin.from('roles').select('id').eq('id', homeRoleId).maybeSingle()
  if (error) return { error: `Role catalogue lookup failed: ${error.message}` }
  if (!data) return { error: 'home_role_id does not reference a known role' }
  return null
}

/**
 * Resolve the external_org value to store for an external role.
 *
 * Rules, in one place so no caller can invent its own:
 *  - subcontractor ALWAYS requires a non-empty organisation. A subcontractor
 *    with no organisation is not a meaningful identity.
 *  - client_viewer may omit it in general, but NOT when the target is currently
 *    internal: promoting an internal user into an external role without stating
 *    the organisation would leave the identity externally-scoped while silently
 *    unattributed.
 *  - The value is trimmed. It is NEVER derived from auth metadata, which is
 *    attacker-influenced and is not an authority source.
 */
function resolveExternalOrg(args: {
  role: DbUserRole
  externalOrg: string | null | undefined
  targetIsInternal: boolean
}): { value: string | null } | { error: string } {
  const trimmed = typeof args.externalOrg === 'string' ? args.externalOrg.trim() : null
  const provided = trimmed !== null && trimmed.length > 0

  if (args.role === 'subcontractor' && !provided) {
    return { error: 'An external organisation is required for a subcontractor.' }
  }
  if (!provided && args.targetIsInternal) {
    return {
      error:
        'An external organisation is required when converting an internal user to an external role.',
    }
  }
  return { value: provided ? trimmed : null }
}

/** Every project must belong to the tenant the user is being provisioned into. */
async function assertProjectsInTenant(
  admin: AdminClient,
  projectIds: readonly string[],
  tenantId: string,
): Promise<{ error: string } | null> {
  if (projectIds.length === 0) return null

  const { data, error } = await admin
    .from('projects')
    .select('id')
    .in('id', [...projectIds])
    .eq('tenant_id', tenantId)

  if (error) return { error: `Project lookup failed: ${error.message}` }

  const found = new Set((data ?? []).map((p) => p.id as string))
  const foreign = projectIds.filter((id) => !found.has(id))
  if (foreign.length > 0) {
    return { error: `Project(s) not in this tenant: ${foreign.join(', ')}` }
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// Audited authority write
// ─────────────────────────────────────────────────────────────

/**
 * The audit contract is the REAL `audit_log` shape, verified against the live
 * schema: table_name / record_id / changed_by / old_values / new_values, and
 * `action` CHECK-constrained by audit_log_action_check to insert|update|delete.
 *
 * The domain verb ("provision_internal", "deactivate", …) therefore travels in
 * new_values.op rather than in `action`, which would raise 23514.
 */
async function writeAuthorityAudit(
  admin: AdminClient,
  args: {
    tenantId: string | null
    userId: string
    action: 'insert' | 'update'
    actorId: string
    op: string
    before: Partial<ProfileAuthority> | null
    after: Partial<ProfileAuthority>
    reason?: string
    correlationId?: string
  },
): Promise<{ error: string } | null> {
  const { error } = await admin.from('audit_log').insert({
    tenant_id: args.tenantId,
    table_name: 'profiles',
    record_id: args.userId,
    action: args.action,
    changed_by: args.actorId,
    old_values: args.before,
    new_values: {
      op: args.op,
      ...args.after,
      ...(args.reason ? { reason: args.reason } : {}),
      ...(args.correlationId ? { correlation_id: args.correlationId } : {}),
    },
  })

  // supabase-js does NOT throw on a rejected insert — it returns { error }. A
  // try/catch here would prove nothing, so the error is checked explicitly.
  if (error) return { error: `Audit write failed: ${error.message}` }
  return null
}

/**
 * Apply an authority change and audit it as one logical unit.
 *
 * If the audit insert fails after the profile write succeeded, the profile is
 * rolled back to its previous authority values and the operation reports
 * failure. An unaudited authority change must never be reported as success.
 *
 * A single PostgreSQL RPC transaction is the preferred end state; this
 * compensating rollback is the Batch 1 approach and surfaces explicit evidence
 * when the compensation itself fails.
 */
async function applyAuthorityChange(
  admin: AdminClient,
  args: {
    actor: ResolvedActor
    userId: string
    before: ProfileAuthority
    patch: Partial<ProfileAuthority>
    op: string
    reason?: string
    correlationId?: string
  },
): Promise<{ error: string } | null> {
  const { error: updateErr } = await admin
    .from('profiles')
    .update(args.patch)
    .eq('id', args.userId)

  if (updateErr) return { error: `Profile update failed: ${updateErr.message}` }

  const auditErr = await writeAuthorityAudit(admin, {
    tenantId: args.patch.tenant_id ?? args.before.tenant_id,
    userId: args.userId,
    action: 'update',
    actorId: args.actor.userId,
    op: args.op,
    before: pickChanged(args.before, args.patch),
    after: args.patch,
    reason: args.reason,
    correlationId: args.correlationId,
  })

  if (auditErr) {
    const rollback: Partial<ProfileAuthority> = {}
    for (const key of Object.keys(args.patch) as (keyof ProfileAuthority)[]) {
      // @ts-expect-error — index write across a heterogeneous partial.
      rollback[key] = args.before[key]
    }
    const { error: rollbackErr } = await admin
      .from('profiles')
      .update(rollback)
      .eq('id', args.userId)

    if (rollbackErr) {
      return {
        error:
          `${auditErr.error}. CRITICAL: rollback also failed (${rollbackErr.message}) — ` +
          `profile ${args.userId} may hold an unaudited authority change.`,
      }
    }
    return { error: `${auditErr.error}. Change was rolled back.` }
  }

  return null
}

/** Narrow a "before" snapshot to only the keys the patch touches. */
function pickChanged(
  before: ProfileAuthority,
  patch: Partial<ProfileAuthority>,
): Partial<ProfileAuthority> {
  const out: Partial<ProfileAuthority> = {}
  for (const key of Object.keys(patch) as (keyof ProfileAuthority)[]) {
    // @ts-expect-error — index write across a heterogeneous partial.
    out[key] = before[key]
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────

export interface ProvisionInternalUserArgs {
  userId: string
  role: DbUserRole
  /** Defaults to the actor's tenant. Only system_admin may pass another. */
  tenantId?: string
  department?: string | null
  homeRoleId?: string | null
  isActive?: boolean
  reason?: string
  correlationId?: string
}

/** Provision (or re-provision) an INTERNAL staff identity. */
export async function provisionInternalUser(
  args: ProvisionInternalUserArgs,
): Promise<ProvisioningResult> {
  const gate = await requireProvisioner()
  if ('error' in gate) return gate
  const { actor } = gate

  if (!isInternalRole(args.role)) {
    return { error: `"${args.role}" is not a valid internal role.` }
  }

  const admin = createAdminClient()
  const tenantId = args.tenantId ?? actor.tenantId

  const tenantErr = await assertTenantExists(admin, tenantId)
  if (tenantErr) return tenantErr

  const found = await loadTarget(admin, args.userId)
  if ('error' in found) return found
  const { target } = found

  const authErr = authorizeTargetMutation({
    actor,
    target,
    nextRole: args.role,
    nextTenantId: tenantId,
    nextActive: args.isActive,
  })
  if (authErr) return authErr

  if (args.homeRoleId) {
    const homeErr = await assertHomeRoleValid(admin, args.homeRoleId)
    if (homeErr) return homeErr
  }

  const patch: Partial<ProfileAuthority> = {
    tenant_id: tenantId,
    role: args.role,
    user_type: userTypeForRole(args.role),
    is_active: args.isActive ?? true,
    // An internal identity acts for the tenant itself, never on behalf of an
    // outside organisation. Clearing this explicitly means converting a former
    // subcontractor to staff cannot leave their old firm attached.
    external_org: null,
  }
  if (args.department !== undefined) patch.department = args.department
  if (args.homeRoleId !== undefined) patch.home_role_id = args.homeRoleId

  const err = await applyAuthorityChange(admin, {
    actor,
    userId: args.userId,
    before: target,
    patch,
    op: 'provision_internal',
    reason: args.reason,
    correlationId: args.correlationId,
  })
  if (err) return err

  return { data: undefined }
}

export interface ProvisionExternalUserArgs {
  userId: string
  role: ExternalRole
  tenantId?: string
  /** Projects the external identity may reach. All must be in the tenant. */
  projectIds?: readonly string[]
  /**
   * The organisation this identity acts for. Required for subcontractor, and
   * required whenever the target is currently an internal user.
   */
  externalOrg?: string | null
  isActive?: boolean
  reason?: string
  correlationId?: string
}

/** Provision (or re-provision) an EXTERNAL identity. */
export async function provisionExternalUser(
  args: ProvisionExternalUserArgs,
): Promise<ProvisioningResult> {
  const gate = await requireProvisioner()
  if ('error' in gate) return gate
  const { actor } = gate

  // An external identity must never receive an internal role.
  if (!isExternalRole(args.role)) {
    return { error: `"${args.role}" is not a valid external role.` }
  }

  const admin = createAdminClient()
  const tenantId = args.tenantId ?? actor.tenantId

  const tenantErr = await assertTenantExists(admin, tenantId)
  if (tenantErr) return tenantErr

  const projectErr = await assertProjectsInTenant(admin, args.projectIds ?? [], tenantId)
  if (projectErr) return projectErr

  const found = await loadTarget(admin, args.userId)
  if ('error' in found) return found
  const { target } = found

  const authErr = authorizeTargetMutation({
    actor,
    target,
    nextRole: args.role,
    nextTenantId: tenantId,
    nextActive: args.isActive,
  })
  if (authErr) return authErr

  const org = resolveExternalOrg({
    role: args.role,
    externalOrg: args.externalOrg,
    targetIsInternal: isInternalRole(target.role),
  })
  if ('error' in org) return org

  const patch: Partial<ProfileAuthority> = {
    tenant_id: tenantId,
    role: args.role,
    user_type: userTypeForRole(args.role),
    is_active: args.isActive ?? true,
    external_org: org.value,
  }

  const err = await applyAuthorityChange(admin, {
    actor,
    userId: args.userId,
    before: target,
    patch,
    op: 'provision_external',
    reason: args.reason,
    correlationId: args.correlationId,
  })
  if (err) return err

  return { data: undefined }
}

/**
 * Change the role of an existing user, keeping user_type and external_org
 * coherent with it.
 *
 * A role change can cross the internal/external boundary, so it cannot treat
 * role as an isolated column: promoting a subcontractor to staff must drop
 * their organisation, and moving staff to an external role must state one.
 */
export async function changeUserRole(args: {
  userId: string
  role: DbUserRole
  /** Required when converting an internal user into an external role. */
  externalOrg?: string | null
  reason?: string
  correlationId?: string
}): Promise<ProvisioningResult> {
  const gate = await requireProvisioner()
  if ('error' in gate) return gate
  const { actor } = gate

  if (!isDbUserRole(args.role)) {
    return { error: `"${args.role}" is not a valid role.` }
  }

  const admin = createAdminClient()
  const found = await loadTarget(admin, args.userId)
  if ('error' in found) return found
  const { target } = found

  const authErr = authorizeTargetMutation({ actor, target, nextRole: args.role })
  if (authErr) return authErr

  // Keep user_type AND external_org coherent with the new role rather than
  // leaving an internal user_type attached to an external role, or a stale
  // organisation attached to someone who is now staff.
  const patch: Partial<ProfileAuthority> = {
    role: args.role,
    user_type: userTypeForRole(args.role),
  }

  if (isExternalRole(args.role)) {
    const org = resolveExternalOrg({
      role: args.role,
      externalOrg: args.externalOrg,
      targetIsInternal: isInternalRole(target.role),
    })
    if ('error' in org) return org
    patch.external_org = org.value
  } else {
    patch.external_org = null
  }

  const err = await applyAuthorityChange(admin, {
    actor,
    userId: args.userId,
    before: target,
    patch,
    op: 'change_role',
    reason: args.reason,
    correlationId: args.correlationId,
  })
  if (err) return err

  return { data: undefined }
}

/**
 * Deactivate a user.
 *
 * Sets is_active = false and NOTHING else. Deactivation is never simulated by
 * demoting the role, rewriting department, or adding a text marker: those are
 * lossy (the original role is destroyed), they leave the account able to sign
 * in, and "Deactivated" in a free-text column is not an authorization state.
 */
export async function deactivateUser(args: {
  userId: string
  reason?: string
  correlationId?: string
}): Promise<ProvisioningResult> {
  const gate = await requireProvisioner()
  if ('error' in gate) return gate
  const { actor } = gate

  const admin = createAdminClient()
  const found = await loadTarget(admin, args.userId)
  if ('error' in found) return found
  const { target } = found

  const authErr = authorizeTargetMutation({ actor, target, nextActive: false })
  if (authErr) return authErr

  const err = await applyAuthorityChange(admin, {
    actor,
    userId: args.userId,
    before: target,
    patch: { is_active: false },
    op: 'deactivate',
    reason: args.reason,
    correlationId: args.correlationId,
  })
  if (err) return err

  return { data: undefined }
}

/** Reactivate a user — only once tenant and canonical role are both valid. */
export async function activateUser(args: {
  userId: string
  reason?: string
  correlationId?: string
}): Promise<ProvisioningResult> {
  const gate = await requireProvisioner()
  if ('error' in gate) return gate
  const { actor } = gate

  const admin = createAdminClient()
  const found = await loadTarget(admin, args.userId)
  if ('error' in found) return found
  const { target } = found

  // Activation must not resurrect an account into an unusable authority state.
  if (!target.tenant_id) {
    return { error: 'Cannot activate: user has no tenant assigned' }
  }
  if (!isDbUserRole(target.role)) {
    return { error: 'Cannot activate: user has no valid canonical role' }
  }
  const tenantErr = await assertTenantExists(admin, target.tenant_id)
  if (tenantErr) return tenantErr

  const authErr = authorizeTargetMutation({ actor, target, nextActive: true })
  if (authErr) return authErr

  const err = await applyAuthorityChange(admin, {
    actor,
    userId: args.userId,
    before: target,
    patch: { is_active: true },
    op: 'activate',
    reason: args.reason,
    correlationId: args.correlationId,
  })
  if (err) return err

  return { data: undefined }
}

/**
 * Compensate a provisioning failure that happened after an Auth user was
 * created in the SAME operation.
 *
 * Without this, a failed invite leaves an orphan: an Auth identity that can
 * complete the email link and sign in, attached to a profile row that never
 * received a tenant, role, or active state. That is precisely the
 * unprovisioned-but-authenticated state the identity work exists to prevent,
 * and it is created by the error path rather than the happy path — so it is
 * invisible in normal use.
 *
 * Rules encoded here so no caller can get them subtly wrong:
 *  - An EXISTING (re-invited) user is never deleted. Their Auth identity
 *    predates this operation and deleting it would destroy an unrelated account
 *    because an unrelated update failed.
 *  - The deletion result is checked explicitly. supabase-js returns errors, it
 *    does not throw, so an unchecked call would silently leave the orphan it
 *    was written to remove.
 *  - Failure is never reported as success.
 *  - If cleanup itself fails, the caller gets a repair-required error naming
 *    the user id — an operator cannot fix an orphan they cannot identify. No
 *    token, link, or secret is included.
 */
async function compensateFailedProvisioning(args: {
  admin: AdminClient
  userId: string
  wasNewlyInvited: boolean
  provisioningError: string
}): Promise<{ error: string }> {
  if (!args.wasNewlyInvited) {
    return { error: args.provisioningError }
  }

  const { error: deleteErr } = await args.admin.auth.admin.deleteUser(args.userId)

  if (deleteErr) {
    return {
      error:
        `${args.provisioningError}. CRITICAL: the newly created auth user could not be ` +
        `removed (${deleteErr.message}). Manual repair required for auth user ${args.userId}, ` +
        `which now exists without valid provisioning.`,
    }
  }

  return { error: `${args.provisioningError}. The pending invitation was cancelled.` }
}

/**
 * Provision a freshly invited identity, cleaning up the Auth user if the
 * provisioning step fails.
 *
 * `wasNewlyInvited` must describe THIS operation: it is the difference between
 * cancelling an invitation nobody has used yet and deleting a colleague's
 * account.
 */
export async function provisionInvitedUser(args: {
  wasNewlyInvited: boolean
  provision: () => Promise<ProvisioningResult>
  userId: string
}): Promise<ProvisioningResult> {
  const result = await args.provision()
  if (!('error' in result)) return result

  const admin = createAdminClient()
  return compensateFailedProvisioning({
    admin,
    userId: args.userId,
    wasNewlyInvited: args.wasNewlyInvited,
    provisioningError: result.error,
  })
}

/**
 * Assign (or clear) the user's seat in the 19-role org catalogue.
 *
 * home_role_id is a protected authority field, so this cannot be a loose
 * profile update in a feature action: it needs the same tenant confinement and
 * audit trail as any other authority change.
 */
export async function assignHomeRole(args: {
  userId: string
  homeRoleId: string | null
  reason?: string
  correlationId?: string
}): Promise<ProvisioningResult> {
  const gate = await requireProvisioner()
  if ('error' in gate) return gate
  const { actor } = gate

  const admin = createAdminClient()

  if (args.homeRoleId) {
    const homeErr = await assertHomeRoleValid(admin, args.homeRoleId)
    if (homeErr) return homeErr
  }

  const found = await loadTarget(admin, args.userId)
  if ('error' in found) return found
  const { target } = found

  const authErr = authorizeTargetMutation({ actor, target })
  if (authErr) return authErr

  const err = await applyAuthorityChange(admin, {
    actor,
    userId: args.userId,
    before: target,
    patch: { home_role_id: args.homeRoleId },
    op: 'assign_home_role',
    reason: args.reason,
    correlationId: args.correlationId,
  })
  if (err) return err

  return { data: undefined }
}

/**
 * Authorize a vendor-portal invitation or reissue.
 *
 * Vendor provisioning is an internal-writer capability. viewer, subcontractor
 * and client_viewer must never be able to mint portal access — previously this
 * path required only "any authenticated user", so a subcontractor could invite
 * arbitrary emails into the portal.
 */
export async function authorizeVendorProvisioning(): Promise<
  { actor: ResolvedActor } | { error: string }
> {
  const state = await resolveActorState()
  if (state.kind === 'invalid') return { error: actorFailureMessage(state.reason) }

  const actor = state.actor
  if (isExternalRole(actor.role) || actor.role === 'viewer') {
    return { error: 'Not authorized: this role cannot issue vendor invitations' }
  }
  return { actor }
}
