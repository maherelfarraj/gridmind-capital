import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetUserPassword } from '@/app/actions/admin'

// Mock dependencies
vi.mock('@/lib/auth/roles', () => ({
  requireInternalRole: vi.fn(),
}))

vi.mock('@/lib/db/supabase', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/db/current-user', () => ({
  getCurrentTenantId: vi.fn(),
}))

describe('resetUserPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthorized users', async () => {
    const { requireInternalRole } = await import('@/lib/auth/roles')
    vi.mocked(requireInternalRole).mockRejectedValueOnce(new Error('Unauthorized'))

    const result = await resetUserPassword({
      userId: 'user-123',
      redirectUrl: 'https://example.com/reset',
    })

    expect(result.error).toBe('Unauthorized')
    expect(result.success).toBeUndefined()
  })

  it('rejects if user not found', async () => {
    const { requireInternalRole } = await import('@/lib/auth/roles')
    const { createAdminClient } = await import('@/lib/db/supabase')

    vi.mocked(requireInternalRole).mockResolvedValueOnce({} as any)
    vi.mocked(createAdminClient).mockReturnValueOnce({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        },
      },
    } as any)

    const result = await resetUserPassword({
      userId: 'nonexistent',
      redirectUrl: 'https://example.com/reset',
    })

    expect(result.error).toBe('User not found.')
    expect(result.success).toBeUndefined()
  })

  it('generates recovery link for valid user', async () => {
    const { requireInternalRole } = await import('@/lib/auth/roles')
    const { createAdminClient } = await import('@/lib/db/supabase')

    vi.mocked(requireInternalRole).mockResolvedValueOnce({} as any)
    vi.mocked(createAdminClient).mockReturnValueOnce({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValueOnce({
            data: { id: 'user-123', email: 'user@example.com' },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValueOnce({
            data: {
              properties: {
                action_link: 'https://example.com/reset?token=abc123',
                hashed_token: 'hash123',
              },
            },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({ error: null }),
      }),
    } as any)

    const { getCurrentTenantId } = await import('@/lib/db/current-user')
    vi.mocked(getCurrentTenantId).mockResolvedValueOnce('tenant-123')

    const result = await resetUserPassword({
      userId: 'user-123',
      redirectUrl: 'https://example.com/reset',
    })

    expect(result.success).toBe(true)
    expect(result.resetLink).toBe('https://example.com/reset?token=abc123')
    expect(result.error).toBeUndefined()
  })

  it('handles recovery link generation error', async () => {
    const { requireInternalRole } = await import('@/lib/auth/roles')
    const { createAdminClient } = await import('@/lib/db/supabase')

    vi.mocked(requireInternalRole).mockResolvedValueOnce({} as any)
    vi.mocked(createAdminClient).mockReturnValueOnce({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValueOnce({
            data: { id: 'user-123', email: 'user@example.com' },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValueOnce({
            data: null,
            error: { message: 'Failed to generate link' },
          }),
        },
      },
    } as any)

    const result = await resetUserPassword({
      userId: 'user-123',
      redirectUrl: 'https://example.com/reset',
    })

    expect(result.error).toBe('Failed to generate link')
    expect(result.success).toBeUndefined()
  })

  it('records audit event on successful reset', async () => {
    const { requireInternalRole } = await import('@/lib/auth/roles')
    const { createAdminClient } = await import('@/lib/db/supabase')
    const { getCurrentTenantId } = await import('@/lib/db/current-user')

    const mockInsert = vi.fn().mockResolvedValueOnce({ error: null })
    const mockFrom = vi.fn().mockReturnValueOnce({ insert: mockInsert })

    vi.mocked(requireInternalRole).mockResolvedValueOnce({ userId: 'admin-123' } as any)
    vi.mocked(createAdminClient).mockReturnValueOnce({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValueOnce({
            data: { id: 'user-123', email: 'user@example.com' },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValueOnce({
            data: {
              properties: {
                action_link: 'https://example.com/reset?token=abc123',
                hashed_token: 'hash123',
              },
            },
            error: null,
          }),
        },
      },
      from: mockFrom,
    } as any)
    vi.mocked(getCurrentTenantId).mockResolvedValueOnce('tenant-123')

    await resetUserPassword({
      userId: 'user-123',
      redirectUrl: 'https://example.com/reset',
    })

    expect(mockFrom).toHaveBeenCalledWith('audit_log')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-123',
        table_name: 'auth.users',
        record_id: 'user-123',
        action: 'update',
        op: 'password_reset_initiated',
        changed_by: 'admin-123',
      })
    )
  })

  it('continues on audit event failure', async () => {
    const { requireInternalRole } = await import('@/lib/auth/roles')
    const { createAdminClient } = await import('@/lib/db/supabase')
    const { getCurrentTenantId } = await import('@/lib/db/current-user')

    const mockInsert = vi.fn().mockRejectedValueOnce(new Error('Audit failed'))
    const mockFrom = vi.fn().mockReturnValueOnce({ insert: mockInsert })

    vi.mocked(requireInternalRole).mockResolvedValueOnce({ userId: 'admin-123' } as any)
    vi.mocked(createAdminClient).mockReturnValueOnce({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValueOnce({
            data: { id: 'user-123', email: 'user@example.com' },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValueOnce({
            data: {
              properties: {
                action_link: 'https://example.com/reset?token=abc123',
                hashed_token: 'hash123',
              },
            },
            error: null,
          }),
        },
      },
      from: mockFrom,
    } as any)
    vi.mocked(getCurrentTenantId).mockResolvedValueOnce('tenant-123')

    const result = await resetUserPassword({
      userId: 'user-123',
      redirectUrl: 'https://example.com/reset',
    })

    // Should still succeed even if audit fails
    expect(result.success).toBe(true)
    expect(result.resetLink).toBe('https://example.com/reset?token=abc123')
    expect(result.error).toBeUndefined()
  })

  it('returns fallback link if action_link is missing', async () => {
    const { requireInternalRole } = await import('@/lib/auth/roles')
    const { createAdminClient } = await import('@/lib/db/supabase')
    const { getCurrentTenantId } = await import('@/lib/db/current-user')

    vi.mocked(requireInternalRole).mockResolvedValueOnce({} as any)
    vi.mocked(createAdminClient).mockReturnValueOnce({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValueOnce({
            data: { id: 'user-123', email: 'user@example.com' },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValueOnce({
            data: {
              properties: {
                hashed_token: 'hash123',
              },
            },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({ error: null }),
      }),
    } as any)
    vi.mocked(getCurrentTenantId).mockResolvedValueOnce('tenant-123')

    const result = await resetUserPassword({
      userId: 'user-123',
      redirectUrl: 'https://example.com/reset',
    })

    expect(result.success).toBe(true)
    expect(result.resetLink).toContain('https://example.com/reset')
    expect(result.resetLink).toContain('token_hash=hash123')
  })
})
