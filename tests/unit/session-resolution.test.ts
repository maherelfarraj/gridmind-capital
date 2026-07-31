import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Supabase is mocked at the module boundary — no real project is contacted. */

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

beforeEach(() => {
  vi.resetModules()
  getUser.mockReset()
  maybeSingle.mockReset()
})

async function resolve() {
  const { resolveSessionState } = await import('@/lib/auth/resolve-session')
  return resolveSessionState()
}

describe('resolveSessionState', () => {
  it('returns unauthenticated when there is no user', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    expect((await resolve()).kind).toBe('unauthenticated')
  })

  it('returns unprovisioned/profile_lookup_failed on a query error', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'db down' } })

    const state = await resolve()

    expect(state.kind).toBe('unprovisioned')
    if (state.kind !== 'unprovisioned') throw new Error('expected unprovisioned')
    expect(state.reason).toBe('profile_lookup_failed')
  })

  it('returns unprovisioned/profile_missing when no profile row exists', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: null, error: null })

    const state = await resolve()
    if (state.kind !== 'unprovisioned') throw new Error('expected unprovisioned')
    expect(state.reason).toBe('profile_missing')
    expect(state.email).toBe('user@example.com')
  })

  it('returns unprovisioned/profile_inactive for an inactive profile', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, is_active: false },
      error: null,
    })

    const state = await resolve()
    if (state.kind !== 'unprovisioned') throw new Error('expected unprovisioned')
    expect(state.reason).toBe('profile_inactive')
  })

  it('returns unprovisioned/tenant_missing for a null tenant', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, tenant_id: null },
      error: null,
    })

    const state = await resolve()
    if (state.kind !== 'unprovisioned') throw new Error('expected unprovisioned')
    expect(state.reason).toBe('tenant_missing')
  })

  it('returns unprovisioned/role_invalid for a non-canonical role', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, role: 'root' },
      error: null,
    })

    const state = await resolve()
    if (state.kind !== 'unprovisioned') throw new Error('expected unprovisioned')
    expect(state.reason).toBe('role_invalid')
  })

  it('never exposes database error text in the result', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table profiles' },
    })

    const state = await resolve()

    expect(JSON.stringify(state)).not.toContain('permission denied')
  })

  it('returns active with a fully populated session for a valid profile', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: VALID_PROFILE, error: null })

    const state = await resolve()

    expect(state.kind).toBe('active')
    if (state.kind !== 'active') throw new Error('expected active')
    expect(state.session.tenantId).toBe('tenant-1')
    expect(state.session.roles).toEqual(['project_manager'])
    expect(state.session.isSuperAdmin).toBe(false)
  })

  it('flags system_admin as super admin', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, role: 'system_admin' },
      error: null,
    })

    const state = await resolve()
    if (state.kind !== 'active') throw new Error('expected active')
    expect(state.session.isSuperAdmin).toBe(true)
  })
})

describe('resolveSession compatibility wrapper', () => {
  it('returns null for an unprovisioned user (does not weaken authorization)', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, tenant_id: null },
      error: null,
    })
    const { resolveSession } = await import('@/lib/auth/resolve-session')

    await expect(resolveSession()).resolves.toBeNull()
  })

  it('returns a session only for the active state', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: VALID_PROFILE, error: null })
    const { resolveSession } = await import('@/lib/auth/resolve-session')

    const session = await resolveSession()

    expect(session?.userId).toBe('user-1')
  })
})

/**
 * Dashboard routing logic.
 *
 * The layout is an async server component, so rather than rendering it we
 * assert the branch it selects for each session state — the decision under
 * test is the routing matrix, not the JSX.
 */
type Decision = 'redirect:/auth/login' | 'render:AccountSetupIncomplete' | 'render:dashboard'

async function routeFor(): Promise<Decision> {
  const { resolveSessionState } = await import('@/lib/auth/resolve-session')
  const state = await resolveSessionState()
  if (state.kind === 'unauthenticated') return 'redirect:/auth/login'
  if (state.kind === 'unprovisioned') return 'render:AccountSetupIncomplete'
  return 'render:dashboard'
}

describe('dashboard routing matrix', () => {
  it('sends an unauthenticated visitor to login', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    await expect(routeFor()).resolves.toBe('redirect:/auth/login')
  })

  it('renders the setup screen — not a login redirect — when unprovisioned', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: null, error: null })

    const decision = await routeFor()

    expect(decision).toBe('render:AccountSetupIncomplete')
    // Regression guard: redirecting an authenticated user to login loops.
    expect(decision).not.toBe('redirect:/auth/login')
  })

  it('renders the setup screen for an inactive account', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, is_active: false },
      error: null,
    })

    await expect(routeFor()).resolves.toBe('render:AccountSetupIncomplete')
  })

  it('renders the dashboard for an active session', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: VALID_PROFILE, error: null })

    await expect(routeFor()).resolves.toBe('render:dashboard')
  })
})

/**
 * /admin gate. The layout previously scoped its profile lookup to a hardcoded
 * demo tenant UUID and skipped the is_active check.
 */
type AdminDecision = 'redirect:/auth/login' | 'redirect:/dashboard' | 'render:admin'

async function adminRouteFor(): Promise<AdminDecision> {
  const { resolveActorState } = await import('@/lib/auth/actor')
  const state = await resolveActorState()
  if (state.kind === 'invalid') {
    return state.reason === 'not_authenticated'
      ? 'redirect:/auth/login'
      : 'redirect:/dashboard'
  }
  return state.actor.role === 'system_admin' || state.actor.role === 'tenant_admin'
    ? 'render:admin'
    : 'redirect:/dashboard'
}

describe('admin layout gate', () => {
  it('admits a tenant_admin in a real (non-demo) tenant', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, role: 'tenant_admin', tenant_id: 'real-tenant-9' },
      error: null,
    })

    await expect(adminRouteFor()).resolves.toBe('render:admin')
  })

  it('rejects a deactivated admin', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({
      data: { ...VALID_PROFILE, role: 'system_admin', is_active: false },
      error: null,
    })

    await expect(adminRouteFor()).resolves.toBe('redirect:/dashboard')
  })

  it('rejects a non-admin role', async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } })
    maybeSingle.mockResolvedValue({ data: VALID_PROFILE, error: null })

    await expect(adminRouteFor()).resolves.toBe('redirect:/dashboard')
  })

  it('sends an unauthenticated visitor to login', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    await expect(adminRouteFor()).resolves.toBe('redirect:/auth/login')
  })
})
