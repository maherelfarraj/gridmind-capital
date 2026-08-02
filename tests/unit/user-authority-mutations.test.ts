import { beforeEach, describe, expect, it, vi } from 'vitest'

import { statusFromProfile } from '@/lib/admin/user-status'
import { assignableRolesFor } from '@/lib/auth/roles'

/**
 * Role change and activate/deactivate must actually persist, and must be
 * audited exactly once.
 *
 * The reported symptom was that Change Role did nothing and Deactivate
 * reverted on refresh. The canonical service was never at fault: these tests
 * pin the two layers that were — the read projection that decides Active vs
 * Inactive, and the authority mutations the UI now calls.
 *
 * Supabase is mocked at the module boundary, so no connection to production is
 * opened and no row is written.
 */

const { resolveActorState, tableHandlers, calls } = vi.hoisted(() => ({
  resolveActorState: vi.fn(),
  tableHandlers: new Map<string, unknown>(),
  calls: [] as { table: string; op: string; payload?: unknown }[],
}))

vi.mock('@/lib/auth/actor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/actor')>()
  return { ...actual, resolveActorState }
})

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
    auth: { admin: { deleteUser: vi.fn() } },
  }),
}))

const ACTOR_TENANT = 'tenant-a'
const OTHER_TENANT = 'tenant-b'
const ACTOR_ID = 'actor-1'
const TARGET_ID = 'target-1'

function actingAs(role: string, opts: { userId?: string; tenantId?: string } = {}) {
  resolveActorState.mockResolvedValue({
    kind: 'valid',
    actor: {
      userId: opts.userId ?? ACTOR_ID,
      role,
      tenantId: opts.tenantId ?? ACTOR_TENANT,
      isActive: true,
    },
  })
}

/** An ordinary, fully provisioned member of the actor's tenant. */
const ESTABLISHED_USER = {
  id: TARGET_ID,
  tenant_id: ACTOR_TENANT,
  role: 'project_director',
  is_active: true,
  user_type: 'internal',
  external_org: null,
  home_role_id: null,
  department: null,
} as const

function targetProfile(over: Record<string, unknown> = {}) {
  tableHandlers.set('profiles', (op: string) => {
    if (op === 'select') return { data: { ...ESTABLISHED_USER, ...over }, error: null }
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
  okTable('tenants')
  okTable('roles')
  okTable('projects', [])
  okTable('audit_log', null)
})

const profileWrites = () => calls.filter((c) => c.table === 'profiles' && c.op === 'update')
const auditWrites = () => calls.filter((c) => c.table === 'audit_log')
const patch = () => profileWrites()[0]?.payload as Record<string, unknown> | undefined

// ─────────────────────────────────────────────────────────────
// A. Read projection — the bug that survived a correct write
// ─────────────────────────────────────────────────────────────

describe('statusFromProfile', () => {
  it('reports inactive when is_active is false', () => {
    expect(statusFromProfile({ is_active: false })).toBe('inactive')
  })

  it('reports active when is_active is true', () => {
    expect(statusFromProfile({ is_active: true })).toBe('active')
  })

  /**
   * The exact production defect. Every row has department = NULL and no row
   * carries the legacy 'Deactivated' marker, so the old predicate returned
   * 'active' unconditionally — a deactivated user still rendered as Active.
   */
  it('ignores the legacy department marker entirely', () => {
    expect(statusFromProfile({ is_active: false } as { is_active: boolean })).toBe('inactive')
    expect(
      statusFromProfile({ is_active: true, department: 'Deactivated' } as never),
    ).toBe('active')
  })

  it('treats a missing or null flag as inactive, never as active', () => {
    expect(statusFromProfile({})).toBe('inactive')
    expect(statusFromProfile({ is_active: null })).toBe('inactive')
  })
})

// ─────────────────────────────────────────────────────────────
// B. Role change
// ─────────────────────────────────────────────────────────────

describe('changeUserRole', () => {
  it('lets a tenant_admin change project_director to viewer', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: TARGET_ID, role: 'viewer' })

    expect(res).not.toHaveProperty('error')
    expect(profileWrites()).toHaveLength(1)
    expect(patch()).toMatchObject({ role: 'viewer' })
  })

  it('writes exactly one audit row for one role change', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { changeUserRole } = await load()

    await changeUserRole({ userId: TARGET_ID, role: 'viewer' })

    expect(auditWrites()).toHaveLength(1)
  })

  it('rejects an actor changing their own role', async () => {
    actingAs('tenant_admin', { userId: TARGET_ID })
    targetProfile()
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: TARGET_ID, role: 'viewer' })

    expect(res).toHaveProperty('error')
    expect(profileWrites()).toHaveLength(0)
    expect(auditWrites()).toHaveLength(0)
  })

  it('rejects a role change against a user in another tenant', async () => {
    actingAs('tenant_admin')
    targetProfile({ tenant_id: OTHER_TENANT })
    const { changeUserRole } = await load()

    const res = await changeUserRole({ userId: TARGET_ID, role: 'viewer' })

    expect(res).toMatchObject({ error: expect.stringMatching(/outside your tenant/i) })
    expect(profileWrites()).toHaveLength(0)
  })

  it('rejects a role that is not a member of the enum', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { changeUserRole } = await load()

    const res = await changeUserRole({
      userId: TARGET_ID,
      role: 'wizard' as never,
    })

    expect(res).toHaveProperty('error')
    expect(profileWrites()).toHaveLength(0)
  })

  /** Mirrors what the modal offers, so UI and server cannot drift apart. */
  it('does not offer system_admin to a tenant_admin', () => {
    expect(assignableRolesFor('tenant_admin')).not.toContain('system_admin')
    expect(assignableRolesFor('tenant_admin')).toContain('project_director')
    expect(assignableRolesFor('system_admin')).toContain('system_admin')
  })

  it('offers nothing to a non-admin, so the editor cannot be used', () => {
    expect(assignableRolesFor('project_director')).toHaveLength(0)
    expect(assignableRolesFor(null)).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────
// C. Deactivate / reactivate
// ─────────────────────────────────────────────────────────────

describe('deactivateUser', () => {
  it('persists is_active = false', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { deactivateUser } = await load()

    const res = await deactivateUser({ userId: TARGET_ID })

    expect(res).not.toHaveProperty('error')
    expect(profileWrites()).toHaveLength(1)
    expect(patch()).toMatchObject({ is_active: false })
  })

  /**
   * Deactivation must not be simulated by demoting the role. If it were, the
   * original role would be destroyed and reactivation could not restore it.
   */
  it('preserves the role, touching only is_active', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { deactivateUser } = await load()

    await deactivateUser({ userId: TARGET_ID })

    expect(patch()).toEqual({ is_active: false })
    expect(patch()).not.toHaveProperty('role')
    expect(patch()).not.toHaveProperty('department')
  })

  it('writes exactly one audit row', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { deactivateUser } = await load()

    await deactivateUser({ userId: TARGET_ID })

    expect(auditWrites()).toHaveLength(1)
  })

  it('rejects self-deactivation', async () => {
    actingAs('tenant_admin', { userId: TARGET_ID })
    targetProfile()
    const { deactivateUser } = await load()

    const res = await deactivateUser({ userId: TARGET_ID })

    expect(res).toHaveProperty('error')
    expect(profileWrites()).toHaveLength(0)
    expect(auditWrites()).toHaveLength(0)
  })

  it('rejects deactivating a user in another tenant', async () => {
    actingAs('tenant_admin')
    targetProfile({ tenant_id: OTHER_TENANT })
    const { deactivateUser } = await load()

    const res = await deactivateUser({ userId: TARGET_ID })

    expect(res).toMatchObject({ error: expect.stringMatching(/outside your tenant/i) })
    expect(profileWrites()).toHaveLength(0)
  })

  /**
   * A rejected mutation must leave nothing behind: no profile write, no audit
   * row. This is the server half of "failed mutation leaves UI and database
   * unchanged"; the client half is the rollback in handleToggleStatus.
   */
  it('leaves no trace at all when refused', async () => {
    actingAs('project_director')
    targetProfile()
    const { deactivateUser } = await load()

    const res = await deactivateUser({ userId: TARGET_ID })

    expect(res).toHaveProperty('error')
    expect(calls.filter((c) => c.op !== 'select')).toHaveLength(0)
  })
})

describe('activateUser', () => {
  it('persists is_active = true', async () => {
    actingAs('tenant_admin')
    targetProfile({ is_active: false })
    const { activateUser } = await load()

    const res = await activateUser({ userId: TARGET_ID })

    expect(res).not.toHaveProperty('error')
    expect(patch()).toMatchObject({ is_active: true })
  })

  it('writes exactly one audit row', async () => {
    actingAs('tenant_admin')
    targetProfile({ is_active: false })
    const { activateUser } = await load()

    await activateUser({ userId: TARGET_ID })

    expect(auditWrites()).toHaveLength(1)
  })

  /** The round trip must return the user to their original role. */
  it('preserves the role across deactivate then reactivate', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { deactivateUser } = await load()
    await deactivateUser({ userId: TARGET_ID })
    const deactivatePatch = patch()

    calls.length = 0
    vi.resetModules()
    actingAs('tenant_admin')
    targetProfile({ is_active: false })
    const { activateUser } = await load()
    await activateUser({ userId: TARGET_ID })

    expect(deactivatePatch).toEqual({ is_active: false })
    expect(patch()).toEqual({ is_active: true })
    // Neither direction rewrote the role, so project_director survives intact.
    expect(patch()).not.toHaveProperty('role')
  })

  it('refuses to activate a user with no tenant', async () => {
    actingAs('tenant_admin')
    targetProfile({ tenant_id: null, is_active: false })
    const { activateUser } = await load()

    const res = await activateUser({ userId: TARGET_ID })

    expect(res).toMatchObject({ error: expect.stringMatching(/tenant/i) })
    expect(profileWrites()).toHaveLength(0)
  })

  it('refuses to activate a user with an invalid role', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'legacy_role', is_active: false })
    const { activateUser } = await load()

    const res = await activateUser({ userId: TARGET_ID })

    expect(res).toMatchObject({ error: expect.stringMatching(/canonical role/i) })
    expect(profileWrites()).toHaveLength(0)
  })
})
