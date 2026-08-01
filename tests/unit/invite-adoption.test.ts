import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Safe adoption of a freshly invited, fail-closed profile.
 *
 * After P0, `handle_new_user` writes role='viewer', tenant_id=NULL,
 * is_active=FALSE and leaves user_type on its 'internal' column default. That
 * made every tenant_admin invite fail: the service saw a tenantless profile and
 * refused it as "outside your tenant".
 *
 * The fix permits ONE narrow exception — adopting the shell this very invite
 * created — and these tests exist mainly to prove the exception did not become
 * a hole. Supabase is mocked at the module boundary, so no connection to
 * production is ever opened and no auth user is really created or deleted.
 */

const { resolveActorState, tableHandlers, calls, deleteUser } = vi.hoisted(() => ({
  resolveActorState: vi.fn(),
  tableHandlers: new Map<string, unknown>(),
  calls: [] as { table: string; op: string; payload?: unknown }[],
  deleteUser: vi.fn(),
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

/**
 * Exactly what handle_new_user leaves behind, verified against the live
 * function source and the profiles column defaults.
 */
const NEWLY_INVITED_SHELL = {
  id: 'target-1',
  tenant_id: null,
  role: 'viewer',
  is_active: false,
  user_type: 'internal',
  external_org: null,
  home_role_id: null,
  department: null,
} as const

function targetProfile(over: Record<string, unknown> = {}) {
  tableHandlers.set('profiles', (op: string) => {
    if (op === 'select') {
      return { data: { ...NEWLY_INVITED_SHELL, ...over }, error: null }
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
  okTable('projects', [])
  okTable('audit_log', null)
})

const profileWrites = () => calls.filter((c) => c.table === 'profiles' && c.op === 'update')
const auditWrites = () => calls.filter((c) => c.table === 'audit_log')

// ─────────────────────────────────────────────────────────────
// The predicate itself
// ─────────────────────────────────────────────────────────────

describe('A. isAdoptableInviteProfile — shape only, every field pinned', () => {
  it('A1. accepts the exact handle_new_user shell', async () => {
    const { isAdoptableInviteProfile } = await load()
    expect(isAdoptableInviteProfile(NEWLY_INVITED_SHELL)).toBe(true)
  })

  const REJECTED: [string, Record<string, unknown>][] = [
    ['already in a tenant', { tenant_id: ACTOR_TENANT }],
    ['already in another tenant', { tenant_id: OTHER_TENANT }],
    ['already has a real role', { role: 'project_manager' }],
    ['already elevated', { role: 'tenant_admin' }],
    ['already active', { is_active: true }],
    ['active flag unknown', { is_active: null }],
    ['already external', { user_type: 'external' }],
    ['already attributed to an organisation', { external_org: 'Acme' }],
  ]

  for (const [label, over] of REJECTED) {
    it(`A2. rejects a profile that is ${label}`, async () => {
      const { isAdoptableInviteProfile } = await load()
      expect(isAdoptableInviteProfile({ ...NEWLY_INVITED_SHELL, ...over })).toBe(false)
    })
  }
})

// ─────────────────────────────────────────────────────────────
// The reported production failure
// ─────────────────────────────────────────────────────────────

describe('B. the invite that was failing in production', () => {
  it('B1. tenant_admin adopts the new invite shell into their own tenant', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({
      userId: 'target-1',
      role: 'project_manager',
      adoptNewlyInvited: true,
    })

    expect(res).toEqual({ data: undefined })
    expect(profileWrites()[0]?.payload).toMatchObject({
      tenant_id: ACTOR_TENANT,
      role: 'project_manager',
      user_type: 'internal',
      is_active: true,
      external_org: null,
    })
  })

  it('B2. writes exactly one audit row naming the actor', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { provisionInternalUser } = await load()

    await provisionInternalUser({
      userId: 'target-1',
      role: 'project_manager',
      adoptNewlyInvited: true,
      reason: 'invite_new_user',
    })

    const audits = auditWrites()
    expect(audits).toHaveLength(1)
    expect(audits[0]?.payload).toMatchObject({
      table_name: 'profiles',
      record_id: 'target-1',
      action: 'update',
      changed_by: 'actor-1',
      tenant_id: ACTOR_TENANT,
    })
    expect((audits[0]?.payload as any).new_values).toMatchObject({
      op: 'provision_internal',
      reason: 'invite_new_user',
    })
  })

  it('B3. system_admin can still adopt across tenants', async () => {
    actingAs('system_admin')
    targetProfile()
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({
      userId: 'target-1',
      role: 'project_manager',
      tenantId: OTHER_TENANT,
      adoptNewlyInvited: true,
    })
    expect(res).toEqual({ data: undefined })
  })
})

// ─────────────────────────────────────────────────────────────
// The exception must not become a hole
// ─────────────────────────────────────────────────────────────

describe('C. rejections preserved', () => {
  it('C1. an existing tenantless user is NOT adoptable without the flag', async () => {
    actingAs('tenant_admin')
    targetProfile() // identical shape — only provenance differs
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({ userId: 'target-1', role: 'project_manager' })

    expect(res).toEqual({ error: 'Cannot modify users outside your tenant' })
    expect(profileWrites()).toHaveLength(0)
    expect(auditWrites()).toHaveLength(0)
  })

  it('C2. a foreign-tenant profile is rejected even WITH the flag', async () => {
    actingAs('tenant_admin')
    targetProfile({ tenant_id: OTHER_TENANT, role: 'engineer', is_active: true })
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({
      userId: 'target-1',
      role: 'project_manager',
      adoptNewlyInvited: true,
    })

    expect(res).toEqual({ error: 'Cannot modify users outside your tenant' })
    expect(profileWrites()).toHaveLength(0)
  })

  it('C3. an ACTIVE tenantless profile is rejected even WITH the flag', async () => {
    actingAs('tenant_admin')
    targetProfile({ is_active: true })
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({
      userId: 'target-1',
      role: 'project_manager',
      adoptNewlyInvited: true,
    })
    expect(res).toEqual({ error: 'Cannot modify users outside your tenant' })
  })

  it('C4. a tenantless NON-viewer profile is rejected even WITH the flag', async () => {
    actingAs('tenant_admin')
    targetProfile({ role: 'project_manager' })
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({
      userId: 'target-1',
      role: 'engineer',
      adoptNewlyInvited: true,
    })
    expect(res).toEqual({ error: 'Cannot modify users outside your tenant' })
  })

  it('C5. tenant_admin cannot assign system_admin to an adopted invite', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({
      userId: 'target-1',
      role: 'system_admin',
      adoptNewlyInvited: true,
    })

    expect(res).toEqual({ error: 'Only system_admin can assign the system_admin role' })
    expect(profileWrites()).toHaveLength(0)
  })

  it('C6. adoption cannot land the user in a tenant other than the actor own', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({
      userId: 'target-1',
      role: 'project_manager',
      tenantId: OTHER_TENANT,
      adoptNewlyInvited: true,
    })

    expect(res).toEqual({
      error: 'An invited user must be provisioned into your own tenant',
    })
    expect(profileWrites()).toHaveLength(0)
  })

  it('C7. self role/active mutation is still refused', async () => {
    actingAs('tenant_admin', { userId: 'target-1' })
    targetProfile()
    const { provisionInternalUser } = await load()

    const res = await provisionInternalUser({
      userId: 'target-1',
      role: 'project_manager',
      adoptNewlyInvited: true,
    })
    expect(res).toEqual({ error: 'You cannot change your own role or active state' })
  })
})

// ─────────────────────────────────────────────────────────────
// External invite
// ─────────────────────────────────────────────────────────────

describe('D. external invite adoption', () => {
  it('D1. adopts the shell and converts it to an external identity', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({
      userId: 'target-1',
      role: 'subcontractor',
      externalOrg: 'Acme Contracting',
      adoptNewlyInvited: true,
    })

    expect(res).toEqual({ data: undefined })
    expect(profileWrites()[0]?.payload).toMatchObject({
      tenant_id: ACTOR_TENANT,
      role: 'subcontractor',
      user_type: 'external',
      external_org: 'Acme Contracting',
    })
  })

  it('D2. still requires external_org — adoption does not waive it', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({
      userId: 'target-1',
      role: 'subcontractor',
      adoptNewlyInvited: true,
    })

    expect(res).toEqual({
      error: 'An external organisation is required for a subcontractor.',
    })
    expect(profileWrites()).toHaveLength(0)
  })

  it('D3. an existing tenantless profile is still rejected without the flag', async () => {
    actingAs('tenant_admin')
    targetProfile()
    const { provisionExternalUser } = await load()

    const res = await provisionExternalUser({
      userId: 'target-1',
      role: 'subcontractor',
      externalOrg: 'Acme Contracting',
    })
    expect(res).toEqual({ error: 'Cannot modify users outside your tenant' })
  })
})

// ─────────────────────────────────────────────────────────────
// Compensation
// ─────────────────────────────────────────────────────────────

describe('E. compensation residue', () => {
  it('E1. a failed NEW invite deletes the auth user it created', async () => {
    const { provisionInvitedUser } = await load()

    const res = await provisionInvitedUser({
      userId: 'target-1',
      wasNewlyInvited: true,
      provision: async () => ({ error: 'Only system_admin can assign the system_admin role' }),
    })

    expect(deleteUser).toHaveBeenCalledTimes(1)
    expect(deleteUser).toHaveBeenCalledWith('target-1')
    expect(res).toEqual({
      error:
        'Only system_admin can assign the system_admin role. The pending invitation was cancelled.',
    })
  })

  it('E2. an EXISTING user is never deleted by compensation', async () => {
    const { provisionInvitedUser } = await load()

    const res = await provisionInvitedUser({
      userId: 'target-1',
      wasNewlyInvited: false,
      provision: async () => ({ error: 'Cannot modify users outside your tenant' }),
    })

    expect(deleteUser).not.toHaveBeenCalled()
    expect(res).toEqual({ error: 'Cannot modify users outside your tenant' })
  })

  it('E3. a successful invite deletes nothing', async () => {
    const { provisionInvitedUser } = await load()

    const res = await provisionInvitedUser({
      userId: 'target-1',
      wasNewlyInvited: true,
      provision: async () => ({ data: undefined }),
    })

    expect(deleteUser).not.toHaveBeenCalled()
    expect(res).toEqual({ data: undefined })
  })

  it('E4. a failed cleanup is reported as repair-required, never as success', async () => {
    deleteUser.mockResolvedValue({ data: null, error: { message: 'network down' } })
    const { provisionInvitedUser } = await load()

    const res = await provisionInvitedUser({
      userId: 'target-1',
      wasNewlyInvited: true,
      provision: async () => ({ error: 'provisioning failed' }),
    })

    expect('error' in res).toBe(true)
    expect((res as { error: string }).error).toContain('CRITICAL')
    expect((res as { error: string }).error).toContain('target-1')
  })
})

// ─────────────────────────────────────────────────────────────
// Provenance must reach the service
// ─────────────────────────────────────────────────────────────

describe('F. invite callers pass their provenance', () => {
  const FILES = [
    'app/actions/admin.ts',
    'app/actions/external-access.ts',
    'app/actions/procurement.ts',
  ]

  for (const file of FILES) {
    it(`F1. ${file} forwards wasNewlyInvited as adoptNewlyInvited`, async () => {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const code = readFileSync(join(__dirname, '../..', file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')

      expect(
        /adoptNewlyInvited:\s*wasNewlyInvited/.test(code),
        `${file} invites users but never forwards the provenance flag, so every ` +
          `invite into a fail-closed profile would be rejected again.`,
      ).toBe(true)
    })
  }
})
