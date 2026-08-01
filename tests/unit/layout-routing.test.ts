import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionResolution } from '@/lib/auth/resolve-session'
import type { ActorResolution } from '@/lib/auth/actor'
import type { DbUserRole } from '@/lib/auth/roles'
import { makeTestSession } from '../fixtures/session'

/**
 * These tests import and invoke the ACTUAL layout modules.
 *
 * They deliberately do not re-implement the routing matrix. Identity
 * resolution, navigation and the heavy UI/data dependencies are mocked at the
 * module boundary, but the branching under test is the layout's own code plus
 * the shared decision functions in lib/auth/routing.ts. If a layout stops
 * calling the correct decision, these tests fail.
 */

const h = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    const err = new Error(`NEXT_REDIRECT:${to}`)
    ;(err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${to}`
    throw err
  }),
  resolveSessionState: vi.fn(),
  resolveActorState: vi.fn(),
  getPendingApprovalCount: vi.fn(async () => 0),
  getUnreadCountAction: vi.fn(async () => 0),
  signOutAction: vi.fn(async () => {}),
}))

vi.mock('server-only', () => ({}))

vi.mock('next/navigation', () => ({
  redirect: h.redirect,
}))

vi.mock('@/lib/auth/resolve-session', () => ({
  resolveSessionState: h.resolveSessionState,
  resolveSession: async () => {
    const state = await h.resolveSessionState()
    return state.kind === 'active' ? state.session : null
  },
}))

vi.mock('@/lib/auth/actor', () => ({
  resolveActorState: h.resolveActorState,
  actorFailureMessage: () => 'Not authorized',
}))

vi.mock('@/app/actions/approvals', () => ({
  getPendingApprovalCount: h.getPendingApprovalCount,
}))

vi.mock('@/app/actions/notifications', () => ({
  getUnreadCountAction: h.getUnreadCountAction,
}))

vi.mock('@/app/actions/auth', () => ({
  signOutAction: h.signOutAction,
}))

// UI dependencies are stubbed with identifiable components so the assertions
// can tell WHICH shell a layout chose to render.
function AppShellStub() {
  return null
}
function FieldShellStub() {
  return null
}
function SessionProviderStub() {
  return null
}

vi.mock('@/components/layout/AppShell', () => ({ AppShell: AppShellStub }))
vi.mock('@/components/field/field-shell', () => ({ FieldShell: FieldShellStub }))
vi.mock('@/lib/session-context', () => ({ SessionProvider: SessionProviderStub }))

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

type Outcome =
  | { kind: 'redirect'; to: string }
  | { kind: 'render'; element: { type: unknown; props: Record<string, unknown> } }

/** Invoke an async layout, translating a thrown redirect into a value. */
async function run(
  layout: (props: { children: React.ReactNode }) => Promise<unknown>,
): Promise<Outcome> {
  try {
    const element = (await layout({ children: null })) as {
      type: unknown
      props: Record<string, unknown>
    }
    return { kind: 'render', element }
  } catch (err) {
    const message = (err as Error).message
    if (message.startsWith('NEXT_REDIRECT:')) {
      return { kind: 'redirect', to: message.slice('NEXT_REDIRECT:'.length) }
    }
    throw err
  }
}

/** Name of the rendered component, for identifying the chosen shell. */
function renderedName(outcome: Outcome): string {
  if (outcome.kind !== 'render') throw new Error(`expected render, got redirect:${outcome.to}`)
  const type = outcome.element.type as { name?: string } | string
  if (typeof type === 'string') return type
  return type.name ?? 'anonymous'
}

/** Depth-first search for a component by name in a returned element tree. */
function containsComponent(node: unknown, name: string): boolean {
  if (!node || typeof node !== 'object') return false
  const el = node as { type?: unknown; props?: { children?: unknown } }
  const type = el.type as { name?: string } | string | undefined
  if (type && typeof type !== 'string' && type.name === name) return true
  const children = el.props?.children
  if (Array.isArray(children)) return children.some((c) => containsComponent(c, name))
  return containsComponent(children, name)
}

const activeState = (role: DbUserRole): SessionResolution => ({
  kind: 'active',
  session: makeTestSession({ roles: [role], isSuperAdmin: role === 'system_admin' }),
})

const unauthenticated: SessionResolution = { kind: 'unauthenticated' }

const unprovisioned: SessionResolution = {
  kind: 'unprovisioned',
  email: 'pending@example.com',
  reason: 'profile_missing',
}

const activeActor = (role: DbUserRole): ActorResolution =>
  ({
    kind: 'valid',
    actor: { userId: 'user-1', role, tenantId: 'tenant-1', isActive: true },
    profile: { fullName: 'Test User', locale: 'en', digitStyle: 'western' },
    email: 'test.user@example.com',
  }) as unknown as ActorResolution

const invalidActor = (reason: string): ActorResolution =>
  ({ kind: 'invalid', reason, email: 'pending@example.com' }) as unknown as ActorResolution

async function dashboardLayout() {
  return (await import('@/app/(dashboard)/layout')).default
}
async function adminLayout() {
  return (await import('@/app/(dashboard)/admin/layout')).default
}
async function fieldLayout() {
  return (await import('@/app/field/layout')).default
}

beforeEach(() => {
  vi.clearAllMocks()
  h.getPendingApprovalCount.mockResolvedValue(0)
  h.getUnreadCountAction.mockResolvedValue(0)
})

// ─────────────────────────────────────────────────────────────
// Dashboard layout
// ─────────────────────────────────────────────────────────────

describe('app/(dashboard)/layout.tsx routing', () => {
  it('1. sends an unauthenticated visitor to login', async () => {
    h.resolveSessionState.mockResolvedValue(unauthenticated)

    const outcome = await run(await dashboardLayout())

    expect(outcome).toEqual({ kind: 'redirect', to: '/auth/login' })
  })

  it('2. renders AccountSetupIncomplete for an unprovisioned user, not a login redirect', async () => {
    h.resolveSessionState.mockResolvedValue(unprovisioned)

    const outcome = await run(await dashboardLayout())

    expect(outcome.kind).toBe('render')
    expect(renderedName(outcome)).toBe('AccountSetupIncomplete')
    // Regression guard: redirecting an authenticated user to login loops.
    expect(h.redirect).not.toHaveBeenCalled()
  })

  it('3. performs NO approval or notification data fetch while unprovisioned', async () => {
    h.resolveSessionState.mockResolvedValue(unprovisioned)

    await run(await dashboardLayout())

    expect(h.getPendingApprovalCount).not.toHaveBeenCalled()
    expect(h.getUnreadCountAction).not.toHaveBeenCalled()
  })

  it('4. renders the authenticated shell for an active session', async () => {
    h.resolveSessionState.mockResolvedValue(activeState('project_manager'))

    const outcome = await run(await dashboardLayout())

    expect(renderedName(outcome)).toBe('SessionProviderStub')
    expect(containsComponent(outcome.kind === 'render' ? outcome.element : null, 'AppShellStub')).toBe(true)
    expect(h.getPendingApprovalCount).toHaveBeenCalled()
  })

  it('4b. passes the resolved session explicitly to SessionProvider', async () => {
    h.resolveSessionState.mockResolvedValue(activeState('engineer'))

    const outcome = await run(await dashboardLayout())
    if (outcome.kind !== 'render') throw new Error('expected render')

    expect(outcome.element.props.session).toMatchObject({ roles: ['engineer'] })
  })

  it('4c. bounces external roles to their own portals', async () => {
    h.resolveSessionState.mockResolvedValue(activeState('client_viewer'))
    expect(await run(await dashboardLayout())).toEqual({ kind: 'redirect', to: '/client' })

    h.resolveSessionState.mockResolvedValue(activeState('subcontractor'))
    expect(await run(await dashboardLayout())).toEqual({ kind: 'redirect', to: '/portal' })
  })
})

// ─────────────────────────────────────────────────────────────
// Admin layout
// ─────────────────────────────────────────────────────────────

describe('app/(dashboard)/admin/layout.tsx routing', () => {
  it('5. sends an unauthenticated visitor to login', async () => {
    h.resolveActorState.mockResolvedValue(invalidActor('not_authenticated'))

    expect(await run(await adminLayout())).toEqual({ kind: 'redirect', to: '/auth/login' })
  })

  it('6. renders no admin content for an inactive or unprovisioned account', async () => {
    for (const reason of ['profile_inactive', 'profile_missing', 'tenant_missing', 'role_invalid']) {
      h.resolveActorState.mockResolvedValue(invalidActor(reason))

      const outcome = await run(await adminLayout())

      expect(outcome).toEqual({ kind: 'redirect', to: '/dashboard' })
    }
  })

  it('7. redirects a non-admin role to the dashboard', async () => {
    for (const role of ['project_manager', 'engineer', 'viewer'] as DbUserRole[]) {
      h.resolveActorState.mockResolvedValue(activeActor(role))

      expect(await run(await adminLayout())).toEqual({ kind: 'redirect', to: '/dashboard' })
    }
  })

  it('8. admits system_admin and tenant_admin', async () => {
    for (const role of ['system_admin', 'tenant_admin'] as DbUserRole[]) {
      h.resolveActorState.mockResolvedValue(activeActor(role))

      const outcome = await run(await adminLayout())

      expect(outcome.kind).toBe('render')
      expect(h.redirect).not.toHaveBeenCalled()
    }
  })

  it('8b. admits a tenant_admin in a real (non-demo) tenant', async () => {
    const state = activeActor('tenant_admin') as unknown as { actor: { tenantId: string } }
    state.actor.tenantId = 'real-tenant-9'
    h.resolveActorState.mockResolvedValue(state)

    expect((await run(await adminLayout())).kind).toBe('render')
  })
})

// ─────────────────────────────────────────────────────────────
// Field layout
// ─────────────────────────────────────────────────────────────

describe('app/field/layout.tsx routing', () => {
  it('9. sends an unauthenticated visitor to login', async () => {
    h.resolveSessionState.mockResolvedValue(unauthenticated)

    expect(await run(await fieldLayout())).toEqual({ kind: 'redirect', to: '/auth/login' })
  })

  it('10. sends an unprovisioned user to the dashboard, NOT to login', async () => {
    h.resolveSessionState.mockResolvedValue(unprovisioned)

    const outcome = await run(await fieldLayout())

    expect(outcome).toEqual({ kind: 'redirect', to: '/dashboard' })
    expect(outcome).not.toEqual({ kind: 'redirect', to: '/auth/login' })
  })

  it('11. sends a read-only viewer to the dashboard', async () => {
    h.resolveSessionState.mockResolvedValue(activeState('viewer'))

    expect(await run(await fieldLayout())).toEqual({ kind: 'redirect', to: '/dashboard' })
  })

  it('12. sends a client_viewer to the client portal', async () => {
    h.resolveSessionState.mockResolvedValue(activeState('client_viewer'))

    expect(await run(await fieldLayout())).toEqual({ kind: 'redirect', to: '/client' })
  })

  it('13. sends a subcontractor to the subcontractor portal', async () => {
    h.resolveSessionState.mockResolvedValue(activeState('subcontractor'))

    expect(await run(await fieldLayout())).toEqual({ kind: 'redirect', to: '/portal' })
  })

  it('14. renders the field shell for a writer', async () => {
    h.resolveSessionState.mockResolvedValue(activeState('engineer'))

    const outcome = await run(await fieldLayout())

    expect(renderedName(outcome)).toBe('SessionProviderStub')
    expect(containsComponent(outcome.kind === 'render' ? outcome.element : null, 'FieldShellStub')).toBe(true)
  })

  it('14b. admits every writer role and no read-only role', async () => {
    const { WRITE_ACCESS_BY_ROLE } = await import('@/lib/auth/roles')

    for (const [role, isWriter] of Object.entries(WRITE_ACCESS_BY_ROLE)) {
      h.resolveSessionState.mockResolvedValue(activeState(role as DbUserRole))

      const outcome = await run(await fieldLayout())

      if (isWriter) {
        expect(outcome.kind, `${role} should reach field mode`).toBe('render')
      } else {
        expect(outcome.kind, `${role} must not reach field mode`).toBe('redirect')
      }
    }
  })
})
