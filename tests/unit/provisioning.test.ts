import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests for the canonical provisioning service.
 *
 * Supabase is mocked at the MODULE boundary (`@/lib/supabase/admin`), so no
 * connection to production or staging is ever opened. The actor resolver is
 * likewise mocked so each case can state exactly who is calling.
 */

const { resolveActorState, tableHandlers, calls, deleteUser } = vi.hoisted(() => ({
  resolveActorState: vi.fn(),
  tableHandlers: new Map<string, unknown>(),
  calls: [] as { table: string; op: string; payload?: unknown }[],
  // The Auth Admin API is mocked too — no real auth user is ever created or
  // deleted, and no network call is made.
  deleteUser: vi.fn(),
}))

vi.mock('@/lib/auth/actor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/actor')>()
  return { ...actual, resolveActorState }
})

/**
 * Minimal PostgREST-shaped stub. Each table gets a scripted response; every
 * mutation is recorded so tests can assert exactly what was written.
 */
function makeQuery(table: string) {
  const state: { op: string; payload?: unknown } = { op: 'select' }

  const result = () => {
    const handler = tableHandlers.get(table) as
      | ((op: string, payload?: unknown) => { data?: unknown; error?: { message: string } })
      | undefined
    return handler ? handler(state.op, state.payload) : { data: null, error: null }
  }

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    maybeSingle: async () => result(),
    single: async () => result(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  }

  for (const op of ['insert', 'update', 'upsert'] as const) {
    builder[op] = (payload: unknown) => {
      state.op = op
      state.payload = payload
      calls.push({ table, op, payload })
      return builder
    }
  }
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => makeQuery(table),
    auth: { admin: { deleteUser } },
  }),
}))

const ACTOR_TENANT = 'tenant-a'
const OTHER_TENANT = 'tenant-b'

function actingAs(role: string, opts: { userId?: string; tenantId?: string } = {}) {
  resolveActorState.mockResolvedValue({
    kind: 'valid',
    actor: {
      userId: opts.userId ?? 'actor-1',
      role,
      tenantId: opts.tenantId ?? ACTOR_TENANT,
      isActive: true,
    },
  })
}

/** Script the profiles table to return one target row. */
function targetProfile(over: Record<string, unknown> = {}) {
  tableHandlers.set('profiles', (op: string) => {
    if (op === 'select') {
      return {
        data: {
          id: 'target-1',
          tenant_id: ACTOR_TENANT,
          role: 'engineer',
          is_active: true,
          user_type: 'internal',
          external_org: null,
          home_role_id: null,
          department: null,
          ...over,
        },
        error: null,
      }
    }
    return { data: null, error: null }
  })
}

function okTable(name: string, data: unknown = { id: 'x' }) {
  tableHandlers.set(name, () => ({ data, error: null }))
}

async function load() {
  return import('@/lib/auth/provisioning')
}

beforeEach(() => {
  vi.resetModules()
  tableHandlers.clear()
  calls.length = 0
  resolveActorState.mockReset()
  deleteUser.mockReset()
  deleteUser.mockResolvedValue({ data: null, error: null })
  okTable('tenants')
  okTable('roles')
  okTable('audit_log', null)
})

/** The profile mutation actually sent to the DB (not the audit row). */
function profileWrite() {
  return calls.find((c) => c.table === 'profiles' && c.op === 'update')
}
function auditWrite() {
  return calls.find((c) => c.table === 'audit_log')
}

describe('caller authorization', () => {
  it('1. tenant_admin provisions a user in the same tenant', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({ userId: 'target-1', role: 'project_manager' })

    expect(res).toEqual({ data: undefined })
    expect(profileWrite()?.payload).toMatchObject({
      role: 'project_manager',
      tenant_id: ACTOR_TENANT,
      user_type: 'internal',
    })
  })

  it('2. tenant_admin cannot provision into another tenant', async () => {
    actingAs('tenant_admin')
    targetProfile({ tenant_id: OTHER_TENANT })
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({
      userId: 'target-1',
      role: 'engineer',
      tenantId: OTHER_TENANT,
    })

    expect(res).toEqual({ error: 'Cannot modify users outside your tenant' })
    expect(profileWrite()).toBeUndefined()
  })

  it('3. tenant_admin cannot assign system_admin', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'target-1', role: 'system_admin' })

    expect(res).toEqual({ error: 'Only system_admin can assign the system_admin role' })
    expect(profileWrite()).toBeUndefined()
  })

  it('4. tenant_admin cannot modify an existing system_admin', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'system_admin' })
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'target-1', role: 'viewer' })

    expect(res).toEqual({ error: 'Cannot modify a system_admin account' })
    expect(profileWrite()).toBeUndefined()
  })

  it('5. a user cannot elevate themselves', async () => {
    actingAs('tenant_admin', { userId: 'self-1' })
    targetProfile({ id: 'self-1', role: 'tenant_admin' })
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'self-1', role: 'system_admin' })

    expect(res).toEqual({ error: 'You cannot change your own role or active state' })
    expect(profileWrite()).toBeUndefined()
  })

  it('6. system_admin can provision cross-tenant', async () => {
    actingAs('system_admin')
    targetProfile({ tenant_id: OTHER_TENANT })
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({
      userId: 'target-1',
      role: 'project_director',
      tenantId: OTHER_TENANT,
    })

    expect(res).toEqual({ data: undefined })
    expect(profileWrite()?.payload).toMatchObject({ tenant_id: OTHER_TENANT })
  })

  it('rejects a role with no provisioning authority', async () => {
    actingAs('project_manager')
    targetProfile()
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'target-1', role: 'viewer' })

    expect(res).toEqual({
      error: 'Not authorized: only tenant_admin or system_admin can provision users',
    })
  })
})

describe('target validation', () => {
  it('7. an invalid role is rejected', async () => {
    actingAs('system_admin')
    targetProfile()
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'target-1', role: 'wizard' as never })

    expect(res).toEqual({ error: '"wizard" is not a valid role.' })
    expect(profileWrite()).toBeUndefined()
  })

  it('8. an external user cannot receive an internal role', async () => {
    actingAs('system_admin')
    targetProfile()
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({ userId: 'target-1', role: 'engineer' as never })

    expect(res).toEqual({ error: '"engineer" is not a valid external role.' })
    expect(profileWrite()).toBeUndefined()
  })

  it('9. an external project from another tenant is rejected', async () => {
    actingAs('tenant_admin')
    targetProfile()
    // The project lookup is tenant-filtered, so a foreign project returns none.
    tableHandlers.set('projects', () => ({ data: [], error: null }))
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({
      userId: 'target-1',
      role: 'subcontractor',
      projectIds: ['foreign-project'],
    })

    expect(res).toEqual({ error: 'Project(s) not in this tenant: foreign-project' })
    expect(profileWrite()).toBeUndefined()
  })

  it('rejects a target that does not exist', async () => {
    actingAs('system_admin')
    tableHandlers.set('profiles', () => ({ data: null, error: null }))
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'ghost', role: 'viewer' })

    expect(res).toEqual({ error: 'Target user not found' })
  })

  it('rejects a tenant that does not exist', async () => {
    actingAs('system_admin')
    targetProfile()
    tableHandlers.set('tenants', () => ({ data: null, error: null }))
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({ userId: 'target-1', role: 'engineer' })

    expect(res).toEqual({ error: 'Target tenant does not exist' })
  })

  it('rejects a home_role_id that is not in the role catalogue', async () => {
    actingAs('system_admin')
    targetProfile()
    tableHandlers.set('roles', () => ({ data: null, error: null }))
    const { assignHomeRole } = await load()

    const res = await assignHomeRole({ userId: 'target-1', homeRoleId: 'bogus' })

    expect(res).toEqual({ error: 'home_role_id does not reference a known role' })
  })
})

describe('activation and deactivation', () => {
  it('10. deactivate sets is_active=false and nothing else', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'engineer', department: 'Delivery' })
    const { deactivateUser } = await load()

    const res = await deactivateUser({ userId: 'target-1' })

    expect(res).toEqual({ data: undefined })
    // Exactly one key: no role demotion, no department marker.
    expect(profileWrite()?.payload).toEqual({ is_active: false })
  })

  it('10b. deactivation never demotes the role to viewer', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'project_director' })
    const { deactivateUser } = await load()

    await deactivateUser({ userId: 'target-1' })

    const payload = profileWrite()?.payload as Record<string, unknown>
    expect(payload).not.toHaveProperty('role')
    expect(payload).not.toHaveProperty('department')
  })

  it('11. activate requires a tenant', async () => {
    actingAs('system_admin')
    targetProfile({ tenant_id: null, is_active: false })
    const { activateUser } = await load()

    const res = await activateUser({ userId: 'target-1' })

    expect(res).toEqual({ error: 'Cannot activate: user has no tenant assigned' })
    expect(profileWrite()).toBeUndefined()
  })

  it('11b. activate requires a canonical role', async () => {
    actingAs('system_admin')
    targetProfile({ role: 'legacy_role', is_active: false })
    const { activateUser } = await load()

    const res = await activateUser({ userId: 'target-1' })

    expect(res).toEqual({ error: 'Cannot activate: user has no valid canonical role' })
    expect(profileWrite()).toBeUndefined()
  })

  it('11c. activate succeeds when tenant and role are valid', async () => {
    actingAs('system_admin')
    targetProfile({ is_active: false })
    const { activateUser } = await load()

    const res = await activateUser({ userId: 'target-1' })

    expect(res).toEqual({ data: undefined })
    expect(profileWrite()?.payload).toEqual({ is_active: true })
  })
})

describe('audit integrity', () => {
  it('12. audit insert failure prevents success and rolls back', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'engineer' })
    tableHandlers.set('audit_log', () => ({ data: null, error: { message: 'audit down' } }))
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'target-1', role: 'viewer' })

    expect(res).toHaveProperty('error')
    expect((res as { error: string }).error).toContain('Audit write failed')
    expect((res as { error: string }).error).toContain('rolled back')

    // The compensating write must restore the prior role.
    const writes = calls.filter((c) => c.table === 'profiles' && c.op === 'update')
    expect(writes).toHaveLength(2)
    expect(writes[1]?.payload).toMatchObject({ role: 'engineer' })
  })

  it('12b. reports critical evidence when the rollback also fails', async () => {
    actingAs('tenant_admin')
    let updates = 0
    tableHandlers.set('profiles', (op: string) => {
      if (op === 'select') {
        return {
          data: {
            id: 'target-1',
            tenant_id: ACTOR_TENANT,
            role: 'engineer',
            is_active: true,
            user_type: 'internal',
            home_role_id: null,
            department: null,
          },
          error: null,
        }
      }
      updates += 1
      return updates === 1
        ? { data: null, error: null }
        : { data: null, error: { message: 'rollback failed' } }
    })
    tableHandlers.set('audit_log', () => ({ data: null, error: { message: 'audit down' } }))
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'target-1', role: 'viewer' })

    expect((res as { error: string }).error).toContain('CRITICAL')
  })

  it('13. profile update failure prevents any audit row', async () => {
    actingAs('tenant_admin')
    tableHandlers.set('profiles', (op: string) => {
      if (op === 'select') {
        return {
          data: {
            id: 'target-1',
            tenant_id: ACTOR_TENANT,
            role: 'engineer',
            is_active: true,
            user_type: 'internal',
            home_role_id: null,
            department: null,
          },
          error: null,
        }
      }
      return { data: null, error: { message: 'update rejected' } }
    })
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'target-1', role: 'viewer' })

    expect(res).toEqual({ error: 'Profile update failed: update rejected' })
    expect(auditWrite()).toBeUndefined()
  })

  it('audits with the real audit_log contract', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'engineer' })
    const { changeUserRole } = await load()

    await changeUserRole({ userId: 'target-1', role: 'viewer', reason: 'demoted' })

    const row = auditWrite()?.payload as Record<string, unknown>
    // Real columns, not entity_type/actor_id/details/timestamp.
    expect(row).toMatchObject({
      table_name: 'profiles',
      record_id: 'target-1',
      changed_by: 'actor-1',
      action: 'update',
    })
    // `action` is CHECK-constrained to insert|update|delete, so the domain verb
    // must live in new_values.op.
    expect(['insert', 'update', 'delete']).toContain(row.action)
    expect(row.new_values).toMatchObject({ op: 'change_role', reason: 'demoted' })
    expect(row.old_values).toMatchObject({ role: 'engineer' })
  })
})

describe('vendor provisioning authorization', () => {
  const cases: [string, string][] = [
    ['14. rejects viewer', 'viewer'],
    ['15. rejects subcontractor', 'subcontractor'],
    ['16. rejects client_viewer', 'client_viewer'],
  ]

  for (const [name, role] of cases) {
    it(name, async () => {
      actingAs(role)
      const { authorizeVendorProvisioning } = await load()

      const res = await authorizeVendorProvisioning()

      expect(res).toEqual({
        error: 'Not authorized: this role cannot issue vendor invitations',
      })
    })
  }

  it('17. permits an authorized internal writer', async () => {
    actingAs('project_manager')
    const { authorizeVendorProvisioning } = await load()

    const res = await authorizeVendorProvisioning()

    expect(res).toHaveProperty('actor')
  })

  it('rejects an unauthenticated caller', async () => {
    resolveActorState.mockResolvedValue({ kind: 'invalid', reason: 'not_authenticated' })
    const { authorizeVendorProvisioning } = await load()

    expect(await authorizeVendorProvisioning()).toHaveProperty('error')
  })
})

// ─────────────────────────────────────────────────────────────
// Correction pass: exhaustive classification, external_org,
// and failed-invitation compensation.
// ─────────────────────────────────────────────────────────────

describe('exhaustive user-type classification', () => {
  it('C1. every canonical role has an explicit internal/external classification', async () => {
    const { USER_TYPE_BY_ROLE } = await load()
    const { DB_USER_ROLES } = await import('@/lib/auth/roles')

    for (const role of DB_USER_ROLES) {
      expect(USER_TYPE_BY_ROLE[role], `${role} is unclassified`).toMatch(/^(internal|external)$/)
    }
    // No stray keys beyond the canonical vocabulary.
    expect(Object.keys(USER_TYPE_BY_ROLE).sort()).toEqual([...DB_USER_ROLES].sort())
  })

  it('C2. the classification is a source-level exhaustive Record, not a filter', async () => {
    // A new role must break TYPECHECK. That is only guaranteed while the map is
    // annotated Record<DbUserRole, …>; if someone relaxes the annotation or
    // rebuilds it by exclusion, adding a role silently defaults to internal.
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('lib/auth/provisioning.ts', 'utf8')

    expect(src).toMatch(/USER_TYPE_BY_ROLE:\s*Record<DbUserRole,\s*UserTypeClass>/)
    // Classification must not be derived by excluding an allowlist.
    expect(src).not.toMatch(/DB_USER_ROLES\.filter\(\(r\) => !isExternalRole/)
  })

  it('C3. internal and external sets are disjoint and cover the vocabulary', async () => {
    const { INTERNAL_ROLES, EXTERNAL_ROLES } = await load()
    const { DB_USER_ROLES } = await import('@/lib/auth/roles')

    expect([...INTERNAL_ROLES, ...EXTERNAL_ROLES].sort()).toEqual([...DB_USER_ROLES].sort())
    expect(INTERNAL_ROLES.filter((r) => EXTERNAL_ROLES.includes(r))).toEqual([])
  })
})

describe('external_org is protected authority', () => {
  it('C4. subcontractor requires an external organisation', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'subcontractor', user_type: 'external', external_org: 'Acme' })
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({ userId: 'target-1', role: 'subcontractor' })

    expect(res).toEqual({ error: 'An external organisation is required for a subcontractor.' })
    expect(profileWrite()).toBeUndefined()
  })

  it('C5. a blank/whitespace organisation is not accepted as provided', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'subcontractor', user_type: 'external', external_org: 'Acme' })
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({
      userId: 'target-1',
      role: 'subcontractor',
      externalOrg: '   ',
    })

    expect(res).toHaveProperty('error')
    expect(profileWrite()).toBeUndefined()
  })

  it('C6. external provisioning writes external_org, trimmed', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'subcontractor', user_type: 'external', external_org: 'Old Firm' })
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({
      userId: 'target-1',
      role: 'subcontractor',
      externalOrg: '  Bechtel  ',
    })

    expect(res).toEqual({ data: undefined })
    expect(profileWrite()?.payload).toMatchObject({
      role: 'subcontractor',
      user_type: 'external',
      external_org: 'Bechtel',
    })
  })

  it('C7. external-to-internal conversion clears external_org', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'subcontractor', user_type: 'external', external_org: 'Bechtel' })
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'target-1', role: 'engineer' })

    expect(res).toEqual({ data: undefined })
    expect(profileWrite()?.payload).toMatchObject({
      role: 'engineer',
      user_type: 'internal',
      external_org: null,
    })
  })

  it('C8. internal-to-external conversion without an organisation is rejected', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'engineer', user_type: 'internal', external_org: null })
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: 'target-1', role: 'client_viewer' })

    expect(res).toEqual({
      error:
        'An external organisation is required when converting an internal user to an external role.',
    })
    expect(profileWrite()).toBeUndefined()
  })

  it('C9. internal-to-external conversion succeeds when an organisation is given', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'engineer', user_type: 'internal', external_org: null })
    const { changeUserRole } = await load()

    const res = await changeUserRole({
      userId: 'target-1',
      role: 'client_viewer',
      externalOrg: 'Client Co',
    })

    expect(res).toEqual({ data: undefined })
    expect(profileWrite()?.payload).toMatchObject({
      user_type: 'external',
      external_org: 'Client Co',
    })
  })

  it('C10. internal provisioning clears any stale external_org', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'subcontractor', user_type: 'external', external_org: 'Bechtel' })
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({ userId: 'target-1', role: 'engineer' })

    expect(res).toEqual({ data: undefined })
    expect(profileWrite()?.payload).toMatchObject({ user_type: 'internal', external_org: null })
  })

  it('C11. external_org appears in BOTH audit before and after values', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'subcontractor', user_type: 'external', external_org: 'Old Firm' })
    const { provisionExternalUser } = await load()

    await provisionExternalUser({
      userId: 'target-1',
      role: 'subcontractor',
      externalOrg: 'New Firm',
    })

    const audit = auditWrite()?.payload as { old_values: unknown; new_values: unknown }
    expect(audit.old_values).toMatchObject({ external_org: 'Old Firm' })
    expect(audit.new_values).toMatchObject({ external_org: 'New Firm' })
  })

  it('C12. external_org is restored when audit compensation runs', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'subcontractor', user_type: 'external', external_org: 'Old Firm' })
    tableHandlers.set('audit_log', () => ({ data: null, error: { message: 'audit down' } }))
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({
      userId: 'target-1',
      role: 'subcontractor',
      externalOrg: 'New Firm',
    })

    expect(res).toHaveProperty('error')
    const writes = calls.filter((c) => c.table === 'profiles' && c.op === 'update')
    expect(writes).toHaveLength(2)
    // The rollback must put the ORIGINAL organisation back, not null it.
    expect(writes[1].payload).toMatchObject({ external_org: 'Old Firm' })
  })
})

describe('failed invitation compensation', () => {
  const failingProvision = async () => ({ error: 'provisioning refused' })

  it('C13. a newly invited auth user is deleted when provisioning fails', async () => {
    actingAs('tenant_admin')
    const { provisionInvitedUser } = await load()

    const res = await provisionInvitedUser({
      userId: 'new-user-1',
      wasNewlyInvited: true,
      provision: failingProvision,
    })

    expect(deleteUser).toHaveBeenCalledWith('new-user-1')
    expect(res).toHaveProperty('error')
    expect(res).not.toHaveProperty('data')
    expect((res as { error: string }).error).toContain('provisioning refused')
  })

  it('C14. an EXISTING user is never deleted when provisioning fails', async () => {
    actingAs('tenant_admin')
    const { provisionInvitedUser } = await load()

    const res = await provisionInvitedUser({
      userId: 'existing-user-1',
      wasNewlyInvited: false,
      provision: failingProvision,
    })

    expect(deleteUser).not.toHaveBeenCalled()
    expect(res).toEqual({ error: 'provisioning refused' })
  })

  it('C15. cleanup failure returns a repair-required error naming the user id', async () => {
    actingAs('tenant_admin')
    deleteUser.mockResolvedValue({ data: null, error: { message: 'auth unreachable' } })
    const { provisionInvitedUser } = await load()

    const res = await provisionInvitedUser({
      userId: 'orphan-1',
      wasNewlyInvited: true,
      provision: failingProvision,
    })

    const err = (res as { error: string }).error
    expect(err).toContain('CRITICAL')
    expect(err).toContain('orphan-1')
    expect(err).toContain('auth unreachable')
    // No secret material may leak into an operator-facing error.
    expect(err).not.toMatch(/token|hashed|secret|password/i)
  })

  it('C16. successful provisioning never deletes the auth user', async () => {
    actingAs('tenant_admin')
    const { provisionInvitedUser } = await load()

    const res = await provisionInvitedUser({
      userId: 'new-user-2',
      wasNewlyInvited: true,
      provision: async () => ({ data: undefined }),
    })

    expect(deleteUser).not.toHaveBeenCalled()
    expect(res).toEqual({ data: undefined })
  })

  it('C17. deletion result error is checked, not assumed', async () => {
    // supabase-js RESOLVES with { error } rather than rejecting. A helper that
    // ignored the result would return the plain failure and silently strand the
    // orphan, so the repair path must be reached without any throw.
    actingAs('tenant_admin')
    deleteUser.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { provisionInvitedUser } = await load()

    const res = await provisionInvitedUser({
      userId: 'orphan-2',
      wasNewlyInvited: true,
      provision: failingProvision,
    })

    expect((res as { error: string }).error).toContain('Manual repair required')
  })
})
