import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Actor resolution tests.
 *
 * Supabase is mocked at the module boundary (`@/lib/supabase/server` and
 * `@/lib/supabase/admin`). No network call is made and no real project — local,
 * staging, or production — is contacted.
 */

const getUser = vi.fn()
const maybeSingle = vi.fn()

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  }),
}))

// React's cache() memoises per request; in a plain Node test there is no
// request scope, so identity would be pinned to the first result. Replacing it
// with a pass-through keeps each case independent.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const AUTH_USER = { id: 'user-1', email: 'user@example.com' }

const VALID_PROFILE = {
  id: 'user-1',
  full_name: 'Test User',
  email: 'user@example.com',
  role: 'project_manager',
  tenant_id: 'tenant-1',
  is_active: true,
  locale: 'en',
  digit_style: 'western',
}

async function importResolver() {
  const mod = await import('@/lib/auth/actor')
  return mod
}

beforeEach(() => {
  vi.resetModules()
  getUser.mockReset()
  maybeSingle.mockReset()
})

describe('resolveActorState', () => {
  it('rejects when there is no authenticated user', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { resolveActorState } = await importResolver()

    const state = await resolveActorState()

    expect(state.kind).toBe('invalid')
    if (state.kind !== 'invalid') throw new Error('expected invalid')
    expect(state.reason).toBe('not_authenticated')
  })

  it('rejects when the profile lookup errors', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { resolveActorState } = await importResolver()

    const state = await resolveActorState()

    expect(state.kind).toBe('invalid')
    if (state.kind !== 'invalid') throw new Error('expected invalid')
    expect(state.reason).toBe('profile_lookup_failed')
  })

  it('does not leak database error text', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'relation "profiles" does not exist' },
    })
    const { resolveActorState, actorFailureMessage } = await importResolver()

    const state = await resolveActorState()
    if (state.kind !== 'invalid') throw new Error('expected invalid')

    expect(actorFailureMessage(state.reason)).not.toContain('relation')
    expect(actorFailureMessage(state.reason)).not.toContain('profiles')
  })

  it('distinguishes a missing profile from a lookup failure', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const { resolveActorState } = await importResolver()

    const state = await resolveActorState()

    expect(state.kind).toBe('invalid')
    if (state.kind !== 'invalid') throw new Error('expected invalid')
    expect(state.reason).toBe('profile_missing')
  })

  it('rejects an inactive profile', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, is_active: false },
      error: null,
    })
    const { resolveActorState } = await importResolver()

    const state = await resolveActorState()

    expect(state.kind).toBe('invalid')
    if (state.kind !== 'invalid') throw new Error('expected invalid')
    expect(state.reason).toBe('profile_inactive')
  })

  it('rejects a null tenant_id', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, tenant_id: null },
      error: null,
    })
    const { resolveActorState } = await importResolver()

    const state = await resolveActorState()

    expect(state.kind).toBe('invalid')
    if (state.kind !== 'invalid') throw new Error('expected invalid')
    expect(state.reason).toBe('tenant_missing')
  })

  it('rejects a non-canonical role instead of downgrading it to viewer', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, role: 'superuser' },
      error: null,
    })
    const { resolveActorState } = await importResolver()

    const state = await resolveActorState()

    expect(state.kind).toBe('invalid')
    if (state.kind !== 'invalid') throw new Error('expected invalid')
    expect(state.reason).toBe('role_invalid')
  })

  it('rejects a null role', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, role: null },
      error: null,
    })
    const { resolveActorState } = await importResolver()

    const state = await resolveActorState()
    if (state.kind !== 'invalid') throw new Error('expected invalid')
    expect(state.reason).toBe('role_invalid')
  })

  it('accepts a valid active profile', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: VALID_PROFILE, error: null })
    const { resolveActorState } = await importResolver()

    const state = await resolveActorState()

    expect(state.kind).toBe('valid')
    if (state.kind !== 'valid') throw new Error('expected valid')
    expect(state.actor).toEqual({
      userId: 'user-1',
      role: 'project_manager',
      tenantId: 'tenant-1',
      isActive: true,
    })
  })
})

describe('getAuthActor', () => {
  it('returns a safe error message rather than the raw failure reason', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { getAuthActor } = await import('@/lib/auth/guard')

    const res = await getAuthActor()

    expect('error' in res).toBe(true)
    if (!('error' in res)) throw new Error('expected error')
    expect(res.error).toBe('Not authenticated')
  })

  it('does not echo the invalid role value back to the caller', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, role: 'sneaky_admin' },
      error: null,
    })
    const { getAuthActor } = await import('@/lib/auth/guard')

    const res = await getAuthActor()
    if (!('error' in res)) throw new Error('expected error')

    expect(res.error).not.toContain('sneaky_admin')
  })

  it('returns a fully populated actor for a valid profile', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: VALID_PROFILE, error: null })
    const { getAuthActor } = await import('@/lib/auth/guard')

    const res = await getAuthActor()

    if ('error' in res) throw new Error(`expected actor, got ${res.error}`)
    expect(res.actor.tenantId).toBe('tenant-1')
    expect(res.actor.isActive).toBe(true)
  })

  it('requireWriter rejects read-only external roles', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, role: 'client_viewer' },
      error: null,
    })
    const { requireWriter } = await import('@/lib/auth/guard')

    const res = await requireWriter()

    expect('error' in res).toBe(true)
  })

  it('requireWriter accepts an internal staff role', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: VALID_PROFILE, error: null })
    const { requireWriter } = await import('@/lib/auth/guard')

    const res = await requireWriter()

    expect('error' in res).toBe(false)
  })

  it('requireUser throws for an inactive profile', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, is_active: false },
      error: null,
    })
    const { requireUser } = await import('@/lib/auth/guard')

    await expect(requireUser()).rejects.toThrow(/inactive/i)
  })
})

describe('lib/db/queries getActor', () => {
  it('throws for an inactive profile that the old implementation accepted', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, is_active: false },
      error: null,
    })
    const { getActor } = await import('@/lib/db/queries')

    await expect(getActor()).rejects.toThrow()
  })

  it('throws for a null tenant that the old implementation accepted', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, tenant_id: null },
      error: null,
    })
    const { getActor } = await import('@/lib/db/queries')

    await expect(getActor()).rejects.toThrow()
  })

  it('throws for an invalid role instead of returning role: null', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, role: 'not_a_role' },
      error: null,
    })
    const { getActor } = await import('@/lib/db/queries')

    await expect(getActor()).rejects.toThrow()
  })

  it('returns a non-null role and tenant for a valid profile', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: VALID_PROFILE, error: null })
    const { getActor } = await import('@/lib/db/queries')

    const actor = await getActor()

    expect(actor).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'project_manager',
    })
  })
})

describe('lib/tenant getCurrentTenantId', () => {
  it('throws when the caller is unauthenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { getCurrentTenantId } = await import('@/lib/tenant')

    await expect(getCurrentTenantId()).rejects.toThrow()
  })

  it('throws when the role is invalid, matching the canonical resolver', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, role: 'nope' },
      error: null,
    })
    const { getCurrentTenantId } = await import('@/lib/tenant')

    await expect(getCurrentTenantId()).rejects.toThrow()
  })

  it('returns the session tenant for a valid profile', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: VALID_PROFILE, error: null })
    const { getCurrentTenantId } = await import('@/lib/tenant')

    await expect(getCurrentTenantId()).resolves.toBe('tenant-1')
  })
})
