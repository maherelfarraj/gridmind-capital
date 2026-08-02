/**
 * External identity classification, invite conflict refusal, and post-write
 * verification.
 *
 * Every case below is anchored to production evidence gathered while
 * investigating the maher@tek.jo report:
 *
 *  - a profile exists with role='subcontractor', user_type='internal',
 *    external_org=NULL (seeded 2026-07-28)
 *  - zero `provision_external` audit rows have ever been written
 *  - that account appeared under the Internal users tab
 */

import { describe, it, expect } from 'vitest'

import {
  isExternalIdentity,
  isInternalIdentity,
  externalInviteConflict,
  verifyPersistedExternalState,
} from '@/lib/admin/external-identity'
import { DB_EXTERNAL_ROLES, DB_INTERNAL_ROLES } from '@/lib/auth/roles'

describe('isExternalIdentity', () => {
  it('classifies a fully external profile as external', () => {
    expect(
      isExternalIdentity({ role: 'subcontractor', user_type: 'external' }),
    ).toBe(true)
  })

  it('classifies the production legacy row as external on role alone', () => {
    // The exact shape of maher@tek.jo. user_type says internal; the canonical
    // containment predicate keys off role, so this MUST read as external or the
    // UI disagrees with the security boundary.
    expect(
      isExternalIdentity({ role: 'subcontractor', user_type: 'internal' }),
    ).toBe(true)
  })

  it('classifies on user_type even when the role is not an external role', () => {
    expect(isExternalIdentity({ role: 'viewer', user_type: 'external' })).toBe(true)
  })

  it('treats every external role as external', () => {
    for (const role of DB_EXTERNAL_ROLES) {
      expect(isExternalIdentity({ role, user_type: 'internal' })).toBe(true)
    }
  })

  it('treats every internal role with internal user_type as internal', () => {
    for (const role of DB_INTERNAL_ROLES) {
      expect(isExternalIdentity({ role, user_type: 'internal' })).toBe(false)
      expect(isInternalIdentity({ role, user_type: 'internal' })).toBe(true)
    }
  })

  it('does not classify a null/absent profile as external', () => {
    expect(isExternalIdentity(null)).toBe(false)
    expect(isExternalIdentity(undefined)).toBe(false)
    expect(isExternalIdentity({})).toBe(false)
  })
})

describe('externalInviteConflict', () => {
  it('allows an invite when no profile exists', () => {
    expect(externalInviteConflict(null)).toBeNull()
    expect(externalInviteConflict(undefined)).toBeNull()
  })

  it('allows re-inviting an existing EXTERNAL user', () => {
    expect(
      externalInviteConflict({
        role: 'subcontractor',
        user_type: 'external',
        email: 'vendor@x.jo',
      }),
    ).toBeNull()
  })

  it('allows re-inviting the legacy role-only external row', () => {
    expect(
      externalInviteConflict({
        role: 'subcontractor',
        user_type: 'internal',
        email: 'maher@tek.jo',
      }),
    ).toBeNull()
  })

  it('REFUSES an external invite aimed at an internal user', () => {
    const err = externalInviteConflict({
      role: 'project_manager',
      user_type: 'internal',
      email: 'colleague@gsi.jo',
    })
    expect(err).not.toBeNull()
    expect(err).toContain('colleague@gsi.jo')
    expect(err).toContain('internal user')
  })

  it('refuses for every internal role — none may be silently converted', () => {
    for (const role of DB_INTERNAL_ROLES) {
      const err = externalInviteConflict({
        role,
        user_type: 'internal',
        email: 'someone@gsi.jo',
      })
      expect(err, `role ${role} must conflict`).not.toBeNull()
    }
  })

  it('does not leak an empty name when email is missing', () => {
    const err = externalInviteConflict({ role: 'viewer', user_type: 'internal' })
    expect(err).toContain('That email')
  })
})

describe('verifyPersistedExternalState', () => {
  const expected = {
    role: 'subcontractor',
    externalOrg: 'Test Vendor Company',
    tenantId: '00000000-0000-0000-0000-000000000001',
  }

  it('passes when every field persisted correctly', () => {
    expect(
      verifyPersistedExternalState(
        {
          role: 'subcontractor',
          user_type: 'external',
          external_org: 'Test Vendor Company',
          tenant_id: '00000000-0000-0000-0000-000000000001',
        },
        expected,
      ),
    ).toBeNull()
  })

  it('FAILS on the exact production defect shape', () => {
    // What maher@tek.jo actually looked like after the invite reported success.
    const err = verifyPersistedExternalState(
      {
        role: 'viewer',
        user_type: 'internal',
        external_org: null,
        tenant_id: '00000000-0000-0000-0000-000000000001',
      },
      expected,
    )
    expect(err).not.toBeNull()
    expect(err).toContain('role')
    expect(err).toContain('user_type')
    expect(err).toContain('external_org')
  })

  it('fails when user_type stayed internal even though role is right', () => {
    const err = verifyPersistedExternalState(
      {
        role: 'subcontractor',
        user_type: 'internal',
        external_org: 'Test Vendor Company',
        tenant_id: '00000000-0000-0000-0000-000000000001',
      },
      expected,
    )
    expect(err).not.toBeNull()
    expect(err).toContain('user_type')
  })

  it('fails when external_org was dropped', () => {
    const err = verifyPersistedExternalState(
      {
        role: 'subcontractor',
        user_type: 'external',
        external_org: null,
        tenant_id: '00000000-0000-0000-0000-000000000001',
      },
      expected,
    )
    expect(err).not.toBeNull()
    expect(err).toContain('external_org')
  })

  it('fails when the row landed in a different tenant', () => {
    const err = verifyPersistedExternalState(
      {
        role: 'subcontractor',
        user_type: 'external',
        external_org: 'Test Vendor Company',
        tenant_id: '00000000-0000-0000-0000-000000000099',
      },
      expected,
    )
    expect(err).not.toBeNull()
    expect(err).toContain('tenant_id')
  })

  it('fails when the profile is missing entirely', () => {
    const err = verifyPersistedExternalState(null, expected)
    expect(err).not.toBeNull()
    expect(err).toContain('not found')
  })
})
