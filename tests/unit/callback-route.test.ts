import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/auth/callback/route'
import * as supabaseServer from '@/lib/supabase/server'

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('GET /auth/callback - recovery token priority', () => {
  let mockVerifyOtp: ReturnType<typeof vi.fn>
  let mockExchangeCodeForSession: ReturnType<typeof vi.fn>
  let mockGetSession: ReturnType<typeof vi.fn>
  let mockCreateClient: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockVerifyOtp = vi.fn()
    mockExchangeCodeForSession = vi.fn()
    mockGetSession = vi.fn()

    mockCreateClient = vi.fn().mockResolvedValue({
      auth: {
        verifyOtp: mockVerifyOtp,
        exchangeCodeForSession: mockExchangeCodeForSession,
        getSession: mockGetSession,
      },
    })

    vi.mocked(supabaseServer.createClient).mockImplementation(mockCreateClient)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Recovery token priority over session shortcut', () => {
    it('should verify recovery token and not use session shortcut when token_hash present', async () => {
      mockVerifyOtp.mockResolvedValue({ error: null })
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user123' } } } })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?token_hash=test_token_hash&type=recovery&next=/auth/update-password',
      )

      const response = await GET(request)

      expect(mockVerifyOtp).toHaveBeenCalledOnce()
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        type: 'recovery',
        token_hash: 'test_token_hash',
      })
      expect(mockGetSession).not.toHaveBeenCalled()
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/auth/update-password')
    })

    it('should verify OTP with correct token format', async () => {
      mockVerifyOtp.mockResolvedValue({ error: null })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?token_hash=abc123def456&type=recovery&next=/auth/update-password',
      )

      await GET(request)

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        type: 'recovery',
        token_hash: 'abc123def456',
      })
    })

    it('should redirect to error page when recovery token is invalid', async () => {
      const errorMsg = 'Invalid token'
      mockVerifyOtp.mockResolvedValue({ error: { message: errorMsg } })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?token_hash=invalid_token&type=recovery&next=/auth/update-password',
      )

      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/auth/error?reason=Invalid%20token')
    })

    it('should exchange code and not use session shortcut when code present', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user123' } } } })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=auth_code_123&next=/dashboard',
      )

      const response = await GET(request)

      expect(mockExchangeCodeForSession).toHaveBeenCalledOnce()
      expect(mockGetSession).not.toHaveBeenCalled()
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })

    it('should redirect to error page when code exchange fails', async () => {
      const errorMsg = 'Invalid code'
      mockExchangeCodeForSession.mockResolvedValue({ error: { message: errorMsg } })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=invalid_code&next=/dashboard',
      )

      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/auth/error?reason=Invalid%20code')
    })
  })

  describe('Session shortcut when no explicit credentials', () => {
    it('should use session shortcut when no token_hash, token, or code present', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user123' } } },
      })

      const request = new NextRequest('http://localhost:3000/auth/callback?next=/dashboard')

      const response = await GET(request)

      expect(mockVerifyOtp).not.toHaveBeenCalled()
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
      expect(mockGetSession).toHaveBeenCalledOnce()
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })

    it('should redirect to error when no session and no credentials', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })

      const request = new NextRequest('http://localhost:3000/auth/callback?next=/dashboard')

      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/auth/error?reason=Missing%20authentication%20code')
    })
  })

  describe('Next path safety validation', () => {
    it('should use safe next path when provided', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user123' } } },
      })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?next=/auth/update-password',
      )

      const response = await GET(request)

      expect(response.headers.get('location')).toBe('http://localhost:3000/auth/update-password')
    })

    it('should reject unsafe external URLs and fallback to /dashboard', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user123' } } },
      })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?next=https://evil.com/steal-data',
      )

      const response = await GET(request)

      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })

    it('should reject protocol-relative URLs and fallback to /dashboard', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user123' } } },
      })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?next=//evil.com/steal-data',
      )

      const response = await GET(request)

      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })

    it('should default to /dashboard when next is missing', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user123' } } },
      })

      const request = new NextRequest('http://localhost:3000/auth/callback')

      const response = await GET(request)

      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })
  })

  describe('Redirect to extraction from redirect_to param', () => {
    it('should extract next from redirect_to URL parameter', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user123' } } },
      })

      const redirectTo = encodeURIComponent('http://localhost:3000/auth/callback?next=/settings')
      const request = new NextRequest(
        `http://localhost:3000/auth/callback?redirect_to=${redirectTo}`,
      )

      const response = await GET(request)

      expect(response.headers.get('location')).toBe('http://localhost:3000/settings')
    })

    it('should extract from redirect_to when next is default /dashboard', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user123' } } },
      })

      const redirectTo = encodeURIComponent('http://localhost:3000/auth/callback?next=/settings')
      const request = new NextRequest(
        `http://localhost:3000/auth/callback?next=/dashboard&redirect_to=${redirectTo}`,
      )

      const response = await GET(request)

      // When next is default /dashboard and redirect_to has a next param, redirect_to wins
      expect(response.headers.get('location')).toBe('http://localhost:3000/settings')
    })

    it('should not override explicit non-default next with redirect_to', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user123' } } },
      })

      const redirectTo = encodeURIComponent('http://localhost:3000/auth/callback?next=/settings')
      const request = new NextRequest(
        `http://localhost:3000/auth/callback?next=/profile&redirect_to=${redirectTo}`,
      )

      const response = await GET(request)

      // When next is explicitly set to non-default, don't override it
      expect(response.headers.get('location')).toBe('http://localhost:3000/profile')
    })

    it('should handle invalid redirect_to URL gracefully', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user123' } } },
      })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?redirect_to=not-a-valid-url',
      )

      const response = await GET(request)

      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
    })
  })

  describe('Support for all Supabase email link types', () => {
    const emailLinkTypes = [
      { type: 'invite', token: 'invite_token_123' },
      { type: 'magiclink', token: 'magiclink_token_123' },
      { type: 'signup', token: 'signup_token_123' },
      { type: 'email_change', token: 'email_change_token_123' },
    ]

    emailLinkTypes.forEach(({ type, token }) => {
      it(`should verify ${type} email link type`, async () => {
        mockVerifyOtp.mockResolvedValue({ error: null })

        const request = new NextRequest(
          `http://localhost:3000/auth/callback?token_hash=${token}&type=${type}&next=/dashboard`,
        )

        const response = await GET(request)

        expect(mockVerifyOtp).toHaveBeenCalledWith({
          type,
          token_hash: token,
        })
        expect(response.status).toBe(307)
      })
    })
  })

  describe('Alternative token parameter format', () => {
    it('should accept token parameter as alternative to token_hash', async () => {
      mockVerifyOtp.mockResolvedValue({ error: null })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?token=alt_format_token&type=recovery&next=/auth/update-password',
      )

      const response = await GET(request)

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        type: 'recovery',
        token_hash: 'alt_format_token',
      })
      expect(response.status).toBe(307)
    })

    it('should prefer token_hash over token when both present', async () => {
      mockVerifyOtp.mockResolvedValue({ error: null })

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?token_hash=primary_token&token=secondary_token&type=recovery&next=/auth/update-password',
      )

      const response = await GET(request)

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        type: 'recovery',
        token_hash: 'primary_token',
      })
    })
  })
})
