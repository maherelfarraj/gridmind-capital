/**
 * Sample sessions for tests and stories ONLY.
 *
 * This file must never be imported from app/, components/, or lib/. It exists
 * so that lib/session.ts can stay free of any fabricated identity: a mock
 * session exported from production runtime code can be reached by a real
 * render path and hand a role, tenant and permissions to a visitor who has not
 * been authenticated.
 */

import type { AppSession } from '@/lib/session'

/** A fully provisioned, active internal user. */
export const testSession: AppSession = {
  userId: 'test-user-1',
  tenantId: 'test-tenant-1',
  roles: ['project_manager'],
  permissions: ['project.read', 'project.create', 'approval.decide'],
  fullName: 'Test User',
  email: 'test.user@example.com',
  isSuperAdmin: false,
  locale: 'en',
  digitStyle: 'western',
}

/** Build a variant of the sample session for a specific case. */
export function makeTestSession(overrides: Partial<AppSession> = {}): AppSession {
  return { ...testSession, ...overrides }
}
