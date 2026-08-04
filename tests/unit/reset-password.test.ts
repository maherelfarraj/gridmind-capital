import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetUserPassword } from '@/app/actions/admin'

// Mock the auth/guard module
vi.mock('@/lib/auth/guard', () => ({
  requireInternalRole: vi.fn(),
}))

// Mock the supabase/admin module
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { requireInternalRole } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

describe('resetUserPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send recovery email using auth.resetPasswordForEmail (not admin.resetPasswordForEmail)', async () => {
    const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    const mockGetUserById = vi.fn().mockResolvedValue({
      data: { id: 'user-123', email: 'user@example.com' },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: { id: 'profile-123', tenant_id: 'tenant-1' },
        error: null,
      }),
    })

    const mockInsert = vi.fn().mockResolvedValue({ error: null })

    const mockAdmin = {
      auth: {
        admin: {
          getUserById: mockGetUserById,
        },
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'admin-123',
      profile: {
        userId: 'admin-123',
        role: 'system_admin' as any,
        tenantId: 'tenant-1',
        isActive: true,
      },
    })

    const result = await resetUserPassword({ userId: 'user-123' })

    expect(result).toEqual({ success: true })
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({
        redirectTo: expect.stringContaining('update-password'),
      })
    )
  })

  it('should pass user email to resetPasswordForEmail, not userId', async () => {
    const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    const mockGetUserById = vi.fn().mockResolvedValue({
      data: { id: 'user-123', email: 'test@example.com' },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: { id: 'profile-123', tenant_id: 'tenant-1' },
        error: null,
      }),
    })

    const mockInsert = vi.fn().mockResolvedValue({ error: null })

    const mockAdmin = {
      auth: {
        admin: { getUserById: mockGetUserById },
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'admin-123',
      profile: {
        userId: 'admin-123',
        role: 'system_admin' as any,
        tenantId: 'tenant-1',
        isActive: true,
      },
    })

    await resetUserPassword({ userId: 'user-123' })

    // Verify email is passed, NOT userId
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(Object)
    )
  })

  it('should enforce tenant isolation for tenant_admin', async () => {
    const mockGetUserById = vi.fn().mockResolvedValue({
      data: { id: 'user-123', email: 'user@example.com' },
      error: null,
    })

    const mockEq = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'profile-123', tenant_id: 'different-tenant' },
        error: null,
      }),
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    })

    const mockAdmin = {
      auth: {
        admin: { getUserById: mockGetUserById },
        resetPasswordForEmail: vi.fn(),
      },
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'admin-123',
      profile: {
        userId: 'admin-123',
        role: 'tenant_admin' as any,
        tenantId: 'tenant-1',
        isActive: true,
      },
    })

    const result = await resetUserPassword({ userId: 'user-123' })

    expect(result).toEqual({
      error: 'Unauthorized: cannot reset password for users outside your tenant.',
    })
  })

  it('should allow system_admin to reset any user password', async () => {
    const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    const mockGetUserById = vi.fn().mockResolvedValue({
      data: { id: 'user-123', email: 'user@example.com' },
      error: null,
    })

    const mockInsert = vi.fn().mockResolvedValue({ error: null })

    const mockAdmin = {
      auth: {
        admin: { getUserById: mockGetUserById },
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'admin-123',
      profile: {
        userId: 'admin-123',
        role: 'system_admin' as any,
        tenantId: 'tenant-1',
        isActive: true,
      },
    })

    const result = await resetUserPassword({ userId: 'user-123' })

    expect(result).toEqual({ success: true })
  })

  it('should record audit event with userId (not email)', async () => {
    const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    const mockGetUserById = vi.fn().mockResolvedValue({
      data: { id: 'user-123', email: 'user@example.com' },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: { id: 'profile-123', tenant_id: 'tenant-1' },
        error: null,
      }),
    })

    const mockInsert = vi.fn().mockResolvedValue({ error: null })

    const mockAdmin = {
      auth: {
        admin: { getUserById: mockGetUserById },
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'admin-123',
      profile: {
        userId: 'admin-123',
        role: 'system_admin' as any,
        tenantId: 'tenant-1',
        isActive: true,
      },
    })

    await resetUserPassword({ userId: 'user-123' })

    // Verify audit_log.insert called with userId, not email
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        record_id: 'user-123',
        op: 'password_reset_initiated',
      })
    )
  })

  it('should return error if user not found', async () => {
    const mockGetUserById = vi.fn().mockResolvedValue({
      data: null,
      error: 'User not found',
    })

    const mockAdmin = {
      auth: {
        admin: { getUserById: mockGetUserById },
      },
    }

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'admin-123',
      profile: {
        userId: 'admin-123',
        role: 'system_admin' as any,
        tenantId: 'tenant-1',
        isActive: true,
      },
    })

    const result = await resetUserPassword({ userId: 'user-123' })

    expect(result).toEqual({ error: 'User not found.' })
  })

  it('should return error if user lacks email', async () => {
    const mockGetUserById = vi.fn().mockResolvedValue({
      data: { id: 'user-123', email: null },
      error: null,
    })

    const mockAdmin = {
      auth: {
        admin: { getUserById: mockGetUserById },
      },
    }

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'admin-123',
      profile: {
        userId: 'admin-123',
        role: 'system_admin' as any,
        tenantId: 'tenant-1',
        isActive: true,
      },
    })

    const result = await resetUserPassword({ userId: 'user-123' })

    expect(result).toEqual({ error: 'User has no email address.' })
  })

  it('should return error if not authorized', async () => {
    vi.mocked(requireInternalRole).mockRejectedValue(
      new Error('Unauthorized')
    )

    const result = await resetUserPassword({ userId: 'user-123' })

    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('should not expose tokens or resetLink in response', async () => {
    const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    const mockGetUserById = vi.fn().mockResolvedValue({
      data: { id: 'user-123', email: 'user@example.com' },
      error: null,
    })

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: { id: 'profile-123', tenant_id: 'tenant-1' },
        error: null,
      }),
    })

    const mockInsert = vi.fn().mockResolvedValue({ error: null })

    const mockAdmin = {
      auth: {
        admin: { getUserById: mockGetUserById },
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as any)
    vi.mocked(requireInternalRole).mockResolvedValue({
      userId: 'admin-123',
      profile: {
        userId: 'admin-123',
        role: 'system_admin' as any,
        tenantId: 'tenant-1',
        isActive: true,
      },
    })

    const result = await resetUserPassword({ userId: 'user-123' })

    // Response should only have success flag
    expect(result).toEqual({ success: true })
    expect('resetLink' in result).toBe(false)
    expect('hashed_token' in result).toBe(false)
    expect('action_link' in result).toBe(false)
  })
})
