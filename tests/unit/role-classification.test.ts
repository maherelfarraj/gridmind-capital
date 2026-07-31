import { describe, it, expect } from 'vitest'
import {
  DB_USER_ROLES,
  WRITE_ACCESS_BY_ROLE,
  WRITER_ROLES,
  PLATFORM_ADMIN_ROLES,
  isWriterRole,
  isPlatformAdminRole,
  isDbUserRole,
  type DbUserRole,
} from '@/lib/auth/roles'
import { canSeeMenu, canWriteTeam, isPlatformAdmin } from '@/lib/db/permissions'

const READ_ONLY: DbUserRole[] = ['viewer', 'subcontractor', 'client_viewer']

const INTERNAL_WRITERS: DbUserRole[] = [
  'system_admin',
  'tenant_admin',
  'project_director',
  'project_manager',
  'engineer',
  'hse_manager',
  'commissioning_manager',
  'finance_manager',
  'commercial_manager',
]

describe('write-access classification is exhaustive', () => {
  it('classifies every canonical role exactly once', () => {
    const classified = Object.keys(WRITE_ACCESS_BY_ROLE).sort()

    expect(classified).toEqual([...DB_USER_ROLES].sort())
    expect(classified.length).toBe(new Set(classified).size)
  })

  it('gives every role an explicit boolean, never undefined', () => {
    for (const role of DB_USER_ROLES) {
      expect(typeof WRITE_ACCESS_BY_ROLE[role], `${role} is unclassified`).toBe('boolean')
    }
  })

  it('derives WRITER_ROLES from the classification, not from an exclusion list', () => {
    expect([...WRITER_ROLES].sort()).toEqual([...INTERNAL_WRITERS].sort())
  })

  it('does not treat viewer, subcontractor or client_viewer as writers', () => {
    for (const role of READ_ONLY) {
      expect(WRITE_ACCESS_BY_ROLE[role], `${role} must not write`).toBe(false)
      expect(WRITER_ROLES).not.toContain(role)
      expect(isWriterRole(role)).toBe(false)
    }
  })

  it('treats every current internal role as a writer', () => {
    for (const role of INTERNAL_WRITERS) {
      expect(isWriterRole(role), `${role} should write`).toBe(true)
    }
  })

  it('rejects unknown, null and malformed roles', () => {
    for (const value of ['client_pmc', 'root', 'admin', '', null, undefined, 0, {}]) {
      expect(isWriterRole(value), `${String(value)} must not be a writer`).toBe(false)
      expect(isDbUserRole(value)).toBe(false)
    }
  })
})

describe('guard re-exports the single writer classification', () => {
  it('INTERNAL_ROLES is an alias of WRITER_ROLES', async () => {
    const guard = await import('@/lib/auth/guard')

    expect(guard.INTERNAL_ROLES).toBe(WRITER_ROLES)
  })

  it('ADMIN_ROLES is the canonical platform-admin group', async () => {
    const guard = await import('@/lib/auth/guard')

    expect(guard.ADMIN_ROLES).toBe(PLATFORM_ADMIN_ROLES)
  })

  it('every role group contains only canonical roles', async () => {
    const guard = await import('@/lib/auth/guard')

    for (const group of [guard.ADMIN_ROLES, guard.APPROVER_ROLES, guard.INTERNAL_ROLES]) {
      for (const role of group) {
        expect(isDbUserRole(role), `${role} is not canonical`).toBe(true)
      }
    }
  })
})

describe('platform admin classification', () => {
  it('admits only system_admin and tenant_admin', () => {
    for (const role of DB_USER_ROLES) {
      const expected = role === 'system_admin' || role === 'tenant_admin'
      expect(isPlatformAdminRole(role), role).toBe(expected)
    }
  })

  it('rejects unknown and null values', () => {
    for (const value of ['client_pmc', 'superuser', null, undefined, '']) {
      expect(isPlatformAdminRole(value)).toBe(false)
      expect(isPlatformAdmin(value as string | null | undefined)).toBe(false)
    }
  })
})

describe('permission utilities fail closed', () => {
  it('canSeeMenu denies null, undefined and unknown roles', () => {
    expect(canSeeMenu(null, 'dashboard')).toBe(false)
    expect(canSeeMenu(undefined, 'dashboard')).toBe(false)
    expect(canSeeMenu('', 'dashboard')).toBe(false)
    expect(canSeeMenu('NOT_A_ROLE', 'dashboard')).toBe(false)
    expect(canSeeMenu('client_pmc', 'dashboard')).toBe(false)
  })

  it('canSeeMenu still grants correctly scoped roles', () => {
    expect(canSeeMenu('PD', 'finance')).toBe(true)
    expect(canSeeMenu('FIN', 'finance')).toBe(true)
    expect(canSeeMenu('FIN', 'construction')).toBe(false)
  })

  it('canWriteTeam denies null, undefined and unknown roles', () => {
    expect(canWriteTeam(null)).toBe(false)
    expect(canWriteTeam(undefined)).toBe(false)
    expect(canWriteTeam('')).toBe(false)
    expect(canWriteTeam('NOT_A_ROLE')).toBe(false)
    expect(canWriteTeam('viewer')).toBe(false)
  })

  it('canWriteTeam still grants team-write roles', () => {
    for (const role of ['PD', 'PM', 'project_director', 'project_manager', 'system_admin', 'tenant_admin']) {
      expect(canWriteTeam(role), role).toBe(true)
    }
  })
})
