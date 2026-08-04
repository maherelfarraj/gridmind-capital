import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetUserPassword } from '@/app/actions/admin'

vi.mock('@/lib/auth/guard', () => ({
  requireInternalRole: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/tenant', () => ({
  getCurrentTenantId: vi.fn(),
}))

import { requireInternalRole } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantId } from '@/lib/tenant'

describe('resetUserPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthorized users with clear error message', async () => {
    vi.mocked(requireInternalRole).mockRejectedValue(new Error('Unauthorized: require system_admin or tenant_admin'))

    const result = await resetUserPassword({ email: 'user@example.com' })

    expect(result.error).toContain('Unauthorized')
    expect(result.success).toBeUndefined()
    expect(result).not.toHaveProperty('resetLink')
  })

  it('returns error when user email not found', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      role: 'system_admin',
      tenantId: 'tenant-001',
    })

    const mockAdmin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        },
      },
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ email: 'nonexistent@example.com' })

    expect(result.error).toBe('User not found.')
    expect(result.success).toBeUndefined()
  })

  it('sends password reset email successfully for system_admin', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      role: 'system_admin',
      tenantId: 'tenant-001',
    })

    const mockGenerateLink = vi.fn().mockResolvedValue({
      data: { properties: { action_link: 'https://example.com/link' } },
      error: null,
    })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockAdmin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'user-456', email: 'user@example.com' }] },
            error: null,
          }),
          generateLink: mockGenerateLink,
        },
      },
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ email: 'user@example.com' })

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result).not.toHaveProperty('resetLink')
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'recovery',
        email: 'user@example.com',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/update-password'),
        }),
      })
    )
  })

  it('enforces tenant isolation for tenant_admin', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      role: 'tenant_admin',
      tenantId: 'tenant-001',
    })

    const mockAdmin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'user-456', email: 'user@example.com' }] },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { tenant_id: 'tenant-999' },
              error: null,
            }),
          }),
        }),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ email: 'user@example.com' })

    expect(result.error).toContain('Unauthorized')
    expect(result.success).toBeUndefined()
  })

  it('allows tenant_admin to reset password for same-tenant user', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      role: 'tenant_admin',
      tenantId: 'tenant-001',
    })

    const mockGenerateLink = vi.fn().mockResolvedValue({
      data: { properties: { action_link: 'https://example.com/link' } },
      error: null,
    })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockAdmin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'user-456', email: 'user@example.com' }] },
            error: null,
          }),
          generateLink: mockGenerateLink,
        },
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { tenant_id: 'tenant-001' },
              error: null,
            }),
          }),
        }),
        insert: mockInsert,
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ email: 'user@example.com' })

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('never returns tokens or links in response', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      role: 'system_admin',
      tenantId: 'tenant-001',
    })

    const mockAdmin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'user-456', email: 'user@example.com' }] },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValue({
            data: { properties: { action_link: 'https://example.com/link' } },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ email: 'user@example.com' })

    expect(result.resetLink).toBeUndefined()
    expect(result.token).toBeUndefined()
    expect(Object.keys(result).sort()).toEqual(['success'])
  })

  it('records audit event with email after successful reset', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      role: 'system_admin',
      tenantId: 'tenant-001',
    })

    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockAdmin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'user-456', email: 'user@example.com' }] },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValue({
            data: { properties: { action_link: 'https://example.com/link' } },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    await resetUserPassword({ email: 'user@example.com' })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        table_name: 'auth.users',
        record_id: 'user@example.com',
        action: 'update',
        op: 'password_reset_initiated',
        changed_by: 'actor-123',
      })
    )
  })

  it('succeeds even if audit logging fails', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      role: 'system_admin',
      tenantId: 'tenant-001',
    })

    const mockAdmin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'user-456', email: 'user@example.com' }] },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValue({
            data: { properties: { action_link: 'https://example.com/link' } },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Audit DB write failed')),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ email: 'user@example.com' })

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })
})
