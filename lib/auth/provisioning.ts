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

/** Explicit allowlist of roles an EXTERNAL identity may hold. */
export const EXTERNAL_ROLES = ['subcontractor', 'client_viewer'] as const
export type ExternalRole = (typeof EXTERNAL_ROLES)[number]

export function isExternalRole(value: unknown): value is ExternalRole {
  return typeof value === 'string' && (EXTERNAL_ROLES as readonly string[]).includes(value)
}

/**
 * Roles an INTERNAL identity may hold — derived from the canonical vocabulary
 * by removing the external allowlist, so a role added to DB_USER_ROLES is
 * internal-provisionable by default only if it is not an external role.
 */
export const INTERNAL_ROLES: readonly DbUserRole[] = DB_USER_ROLES.filter((r) => !isExternalRole(r))

export function isInternalRole(value: unknown): value is DbUserRole {
  return isDbUserRole(value) && !isExternalRole(value)
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

/** The protected authority fields, as stored. */
interface ProfileAuthority {
  id: string
  tenant_id: string | null
  role: string | null
  is_active: boolean | null
  user_type: string | null
  home_role_id: string | null
  department: string | null
}

const AUTHORITY_COLUMNS = 'id, tenant_id, role, is_active, user_type, home_role_id, department'

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
    user_type: 'internal',
    is_active: args.isActive ?? true,
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

  const patch: Partial<ProfileAuthority> = {
    tenant_id: tenantId,
    role: args.role,
    user_type: 'external',
    is_active: args.isActive ?? true,
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

/** Change only the role of an existing user. */
export async function changeUserRole(args: {
  userId: string
  role: DbUserRole
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

  // Keep user_type coherent with the new role rather than leaving an internal
  // user_type attached to an external role (or vice versa).
  const patch: Partial<ProfileAuthority> = {
    role: args.role,
    user_type: isExternalRole(args.role) ? 'external' : 'internal',
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
