import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetUserPassword } from '@/app/actions/admin'

vi.mock('@/lib/auth/guard', () => ({
  requireInternalRole: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { requireInternalRole } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

describe('resetUserPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Authorization tests
  it('rejects unauthorized users with clear error message', async () => {
    vi.mocked(requireInternalRole).mockRejectedValue(
      new Error('Unauthorized: require system_admin or tenant_admin')
    )

    const result = await resetUserPassword({ userId: 'user-123' })

    expect(result.error).toContain('Unauthorized')
    expect(result.success).toBeUndefined()
  })

  it('returns error when user not found', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      profile: { role: 'system_admin', tenantId: 'tenant-001' },
    } as any)

    const mockAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
        },
      },
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ userId: 'nonexistent-user' })

    expect(result.error).toBe('User not found.')
    expect(result.success).toBeUndefined()
  })

  it('returns error when user has no email', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      profile: { role: 'system_admin', tenantId: 'tenant-001' },
    } as any)

    const mockAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { id: 'user-456', email: '' },
            error: null,
          }),
        },
      },
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ userId: 'user-456' })

    expect(result.error).toBe('User has no email address.')
    expect(result.success).toBeUndefined()
  })

  // Core functionality tests
  it('sends password reset email successfully for system_admin', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      profile: { role: 'system_admin', tenantId: 'tenant-001' },
    } as any)

    const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { id: 'user-456', email: 'user@example.com' },
            error: null,
          }),
          resetPasswordForEmail: mockResetPasswordForEmail,
        },
      },
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ userId: 'user-456' })

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://www.gridmindepc.com/auth/update-password',
    })
  })

  it('never returns tokens or links in response', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      profile: { role: 'system_admin', tenantId: 'tenant-001' },
    } as any)

    const mockAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { id: 'user-456', email: 'user@example.com' },
            error: null,
          }),
          resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ userId: 'user-456' })

    expect(result).toEqual({ success: true })
    expect(Object.keys(result)).toEqual(['success'])
    expect(result).not.toHaveProperty('resetLink')
    expect(result).not.toHaveProperty('token')
    expect(result).not.toHaveProperty('action_link')
  })

  // Tenant isolation tests
  it('enforces tenant isolation for tenant_admin', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      profile: { role: 'tenant_admin', tenantId: 'tenant-001' },
    } as any)

    const mockAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { id: 'user-456', email: 'user@example.com' },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { tenant_id: 'tenant-002' },
              error: null,
            }),
          }),
        }),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ userId: 'user-456' })

    expect(result.error).toContain('cannot reset password for users outside your tenant')
    expect(result.success).toBeUndefined()
  })

  it('allows tenant_admin to reset password for same-tenant user', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      profile: { role: 'tenant_admin', tenantId: 'tenant-001' },
    } as any)

    const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { id: 'user-456', email: 'user@example.com' },
            error: null,
          }),
          resetPasswordForEmail: mockResetPasswordForEmail,
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

    const result = await resetUserPassword({ userId: 'user-456' })

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://www.gridmindepc.com/auth/update-password',
    })
  })

  // Audit tests
  it('records audit event with userId after successful reset', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      profile: { role: 'system_admin', tenantId: 'tenant-001' },
    } as any)

    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { id: 'user-456', email: 'user@example.com' },
            error: null,
          }),
          resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    await resetUserPassword({ userId: 'user-456' })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        table_name: 'auth.users',
        record_id: 'user-456',
        action: 'update',
        op: 'password_reset_initiated',
        changed_by: 'actor-123',
      })
    )
  })

  it('succeeds even if audit logging fails', async () => {
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'actor-123',
      profile: { role: 'system_admin', tenantId: 'tenant-001' },
    } as any)

    const mockAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { id: 'user-456', email: 'user@example.com' },
            error: null,
          }),
          resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Audit DB write failed')),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    const result = await resetUserPassword({ userId: 'user-456' })

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('captures actor once and reuses properties', async () => {
    const mockRequireInternalRole = vi.fn().mockResolvedValue({
      userId: 'actor-123',
      profile: { role: 'system_admin', tenantId: 'tenant-001' },
    })
    vi.mocked(requireInternalRole).mockImplementation(mockRequireInternalRole)

    const mockAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { id: 'user-456', email: 'user@example.com' },
            error: null,
          }),
          resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)

    await resetUserPassword({ userId: 'user-456' })

    // Verify requireInternalRole called exactly once
    expect(mockRequireInternalRole).toHaveBeenCalledTimes(1)
  })
})
