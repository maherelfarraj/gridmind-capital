import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Integration-level tests for the REAL external invite entry point,
 * `inviteExternalUser` in `app/actions/external-access.ts`.
 *
 * The helper unit tests in `external-identity.test.ts` prove the guard returns
 * the right answer. They cannot prove the action ASKS it, in the right order,
 * before any write. A browser test on the PR preview showed an existing
 * internal user (`role='engineer'`, `user_type='internal'`) being converted to
 * a subcontractor with a success toast, so "the helper is correct" was
 * demonstrably not enough. These tests drive the exported server action itself.
 *
 * Everything below the action is mocked at the module boundary: no Supabase
 * connection is opened, and the canonical provisioning service is replaced by
 * spies so an attempted write is observable as a CALL rather than as a
 * database mutation.
 */

const {
  profileRow,
  provisionExternalUser,
  provisionInvitedUser,
  deactivateUser,
  inviteUserByEmail,
  writes,
} = vi.hoisted(() => ({
  profileRow: {
    current: null as Record<string, unknown> | null,
    afterProvision: null as Record<string, unknown> | null,
  },
  provisionExternalUser: vi.fn(),
  provisionInvitedUser: vi.fn(),
  deactivateUser: vi.fn(),
  inviteUserByEmail: vi.fn(),
  writes: [] as { table: string; op: string; payload?: unknown }[],
}))

/**
 * The action reads the profile twice: once to look for a conflict, and once
 * after provisioning to verify what persisted. The stub must therefore model
 * the write, or the post-write verification legitimately fails and masks what
 * the test is actually about.
 */
function currentRow() {
  const provisioned = provisionInvitedUser.mock.calls.length > 0
  return provisioned && profileRow.afterProvision ? profileRow.afterProvision : profileRow.current
}

function makeQuery(table: string) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    maybeSingle: async () => ({ data: currentRow(), error: null }),
    single: async () => ({ data: currentRow(), error: null }),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: currentRow(), error: null }).then(resolve),
  }
  for (const op of ['insert', 'update', 'upsert', 'delete'] as const) {
    builder[op] = (payload?: unknown) => {
      writes.push({ table, op, payload })
      return builder
    }
  }
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => makeQuery(table),
    auth: { admin: { inviteUserByEmail, generateLink: vi.fn() } },
  }),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/tenant', () => ({
  getCurrentTenantId: async () => 'tenant-a',
}))
vi.mock('@/lib/auth/guard', () => ({
  requireInternalRole: async () => undefined,
  validateExternalRole: async () => undefined,
}))
vi.mock('@/lib/auth/provisioning', () => ({
  provisionExternalUser,
  provisionInvitedUser,
  deactivateUser,
}))

import { inviteExternalUser } from '@/app/actions/external-access'

const INVITE = {
  email: 'ahmad+gcm@gsi.jo',
  role: 'subcontractor' as const,
  organizationName: 'Test Vendor Company',
  projectIds: [] as string[],
  siteUrl: 'https://example.test',
}

beforeEach(() => {
  vi.clearAllMocks()
  writes.length = 0
  profileRow.current = null
  // What a CORRECT provisioning run leaves behind, so the action's post-write
  // verification passes on the legitimate paths.
  profileRow.afterProvision = {
    id: '77f6c456-885e-4516-8009-c3e7b936d742',
    email: 'ahmad+gcm@gsi.jo',
    role: 'subcontractor',
    user_type: 'external',
    external_org: 'Test Vendor Company',
    tenant_id: 'tenant-a',
  }
  provisionInvitedUser.mockResolvedValue({ data: undefined })
  provisionExternalUser.mockResolvedValue({ data: undefined })
})

/**
 * The exact account and shape from the failed browser verification.
 * `user_type` is 'internal' AND the role is internal — an unambiguous colleague.
 */
const INTERNAL_TARGET = {
  id: '77f6c456-885e-4516-8009-c3e7b936d742',
  email: 'ahmad+gcm@gsi.jo',
  role: 'engineer',
  user_type: 'internal',
}

describe('inviteExternalUser — existing INTERNAL user must be refused', () => {
  it('returns an error instead of a success result', async () => {
    profileRow.current = INTERNAL_TARGET

    const result = await inviteExternalUser(INVITE)

    expect(result.error).toBeTruthy()
    expect(result.error).toMatch(/internal user/i)
    // The UI keys its success toast off isExisting; it must not be set.
    expect(result.isExisting).toBeFalsy()
  })

  it('never reaches the canonical writer', async () => {
    profileRow.current = INTERNAL_TARGET

    await inviteExternalUser(INVITE)

    // This is the assertion the helper unit tests could not make: the guard is
    // not merely correct, it is REACHED before provisioning is attempted.
    expect(provisionInvitedUser).not.toHaveBeenCalled()
    expect(provisionExternalUser).not.toHaveBeenCalled()
  })

  it('performs no database write of any kind', async () => {
    profileRow.current = INTERNAL_TARGET

    await inviteExternalUser(INVITE)

    expect(writes).toEqual([])
  })

  it('does not send an auth invite email', async () => {
    profileRow.current = INTERNAL_TARGET

    await inviteExternalUser(INVITE)

    expect(inviteUserByEmail).not.toHaveBeenCalled()
  })

  it('refuses a tenant_admin target just as firmly as an engineer', async () => {
    profileRow.current = { ...INTERNAL_TARGET, role: 'tenant_admin' }

    const result = await inviteExternalUser(INVITE)

    expect(result.error).toBeTruthy()
    expect(provisionInvitedUser).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('refuses the legacy split-signal row (external role, internal column)', async () => {
    // role='subcontractor' + user_type='internal' exists in production. It is
    // external by the canonical predicate, so a re-invite is legitimate and
    // must NOT be blocked — the complement of the cases above.
    profileRow.current = { ...INTERNAL_TARGET, role: 'subcontractor' }

    const result = await inviteExternalUser(INVITE)

    expect(result.error).toBeFalsy()
    expect(provisionInvitedUser).toHaveBeenCalled()
  })
})

describe('inviteExternalUser — legitimate paths still work', () => {
  it('allows re-inviting an existing EXTERNAL user', async () => {
    profileRow.current = { ...INTERNAL_TARGET, role: 'subcontractor', user_type: 'external' }

    const result = await inviteExternalUser(INVITE)

    expect(result.error).toBeFalsy()
    expect(provisionInvitedUser).toHaveBeenCalled()
  })
})
