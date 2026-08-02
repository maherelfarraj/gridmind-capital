import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The internal→external conversion guard, tested at the CANONICAL WRITER.
 *
 * A guard in `inviteExternalUser` protects one entry point. Browser
 * verification of PR #73 showed an internal `engineer` converted to a
 * subcontractor even though that action-level guard was deployed and its own
 * tests passed — so a guard that only one caller consults is not enough
 * evidence that the conversion cannot happen.
 *
 * `provisionExternalUser` is the single writer every caller must pass through
 * (external invite, vendor reissue, anything added later). Proving the refusal
 * here proves it for all of them.
 *
 * Supabase and the actor resolver are mocked at the module boundary: no
 * connection to production is opened and no real profile is touched.
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

const TENANT = 'tenant-a'

function actingAs(role: string) {
  resolveActorState.mockResolvedValue({
    kind: 'valid',
    actor: { userId: 'actor-1', role, tenantId: TENANT, isActive: true },
  })
}

function targetProfile(over: Record<string, unknown> = {}) {
  tableHandlers.set('profiles', (op: string) => {
    if (op === 'select') {
      return {
        data: {
          id: 'target-1',
          tenant_id: TENANT,
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

const load = () => import('@/lib/auth/provisioning')
const profileWrite = () => calls.find((c) => c.table === 'profiles' && c.op === 'update')
const auditWrite = () => calls.find((c) => c.table === 'audit_log')

beforeEach(() => {
  vi.resetModules()
  tableHandlers.clear()
  calls.length = 0
  resolveActorState.mockReset()
  okTable('tenants')
  okTable('roles')
  okTable('audit_log', null)
})

describe('provisionExternalUser refuses to convert an existing internal user', () => {
  const INVITE = {
    userId: 'target-1',
    role: 'subcontractor' as const,
    externalOrg: 'Test Vendor Company',
  }

  it('rejects an internal engineer (the reported production case)', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'engineer', user_type: 'internal' })
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser(INVITE)

    expect(res).toHaveProperty('error')
    expect((res as { error: string }).error).toMatch(/internal user/i)
  })

  it('writes nothing to profiles when it refuses', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'engineer', user_type: 'internal' })
    const { provisionExternalUser } = await load()

    await provisionExternalUser(INVITE)

    expect(profileWrite()).toBeUndefined()
  })

  it('writes no audit row when it refuses', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'engineer', user_type: 'internal' })
    const { provisionExternalUser } = await load()

    await provisionExternalUser(INVITE)

    // A provision_external row in the audit log is the production fingerprint
    // of this bug; refusing must leave none.
    expect(auditWrite()).toBeUndefined()
  })

  it('refuses a tenant_admin target', async () => {
    actingAs('system_admin')
    targetProfile({ role: 'tenant_admin', user_type: 'internal' })
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser(INVITE)

    expect(res).toHaveProperty('error')
    expect(profileWrite()).toBeUndefined()
  })

  it('refuses a viewer whose user_type is internal', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'viewer', user_type: 'internal' })
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser(INVITE)

    expect(res).toHaveProperty('error')
    expect(profileWrite()).toBeUndefined()
  })
})

describe('provisionExternalUser still allows the legitimate paths', () => {
  it('adopts a freshly invited internal shell (adoptNewlyInvited)', async () => {
    // handle_new_user writes role='viewer', user_type='internal' for every new
    // invite. Blocking that shape unconditionally would break all external
    // invites, so provenance — not shape alone — decides.
    actingAs('tenant_admin')
    targetProfile({ role: 'viewer', user_type: 'internal', tenant_id: TENANT })
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({
      ...{ userId: 'target-1', role: 'subcontractor' as const, externalOrg: 'Acme' },
      adoptNewlyInvited: true,
    })

    expect(res).toEqual({ data: undefined })
    expect(profileWrite()?.payload).toMatchObject({
      role: 'subcontractor',
      user_type: 'external',
      external_org: 'Acme',
    })
  })

  it('re-provisions an existing external user', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'subcontractor', user_type: 'external', external_org: 'Old Firm' })
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({
      userId: 'target-1',
      role: 'subcontractor',
      externalOrg: 'New Firm',
    })

    expect(res).toEqual({ data: undefined })
    expect(profileWrite()?.payload).toMatchObject({ external_org: 'New Firm' })
  })

  it('re-provisions the legacy split-signal row (external role, internal column)', async () => {
    // Production holds role='subcontractor' + user_type='internal'. The
    // canonical predicate treats it as external, so it must remain reachable.
    actingAs('tenant_admin')
    targetProfile({ role: 'subcontractor', user_type: 'internal', external_org: null })
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({
      userId: 'target-1',
      role: 'subcontractor',
      externalOrg: 'Acme',
    })

    expect(res).toEqual({ data: undefined })
    expect(profileWrite()?.payload).toMatchObject({ user_type: 'external' })
  })
})
