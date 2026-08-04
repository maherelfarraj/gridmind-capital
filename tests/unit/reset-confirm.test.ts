import { describe, it, expect } from 'vitest'
import {
  validateResetConfirmParams,
  buildResetConfirmCallbackUrl,
  getResetConfirmErrorMessage,
} from '@/lib/auth/reset-confirm'

describe('reset-confirm production helpers', () => {
  describe('validateResetConfirmParams', () => {
    it('should validate correct parameters', () => {
      const result = validateResetConfirmParams({
        tokenHash: 'abc123def456',
        type: 'recovery',
        next: '/auth/update-password',
      })
      expect(result).toBe(true)
    })

    it('should reject missing token_hash', () => {
      const result = validateResetConfirmParams({
        tokenHash: null,
        type: 'recovery',
        next: '/auth/update-password',
      })
      expect(result).toBe(false)
    })

    it('should reject empty token_hash', () => {
      const result = validateResetConfirmParams({
        tokenHash: '',
        type: 'recovery',
        next: '/auth/update-password',
      })
      expect(result).toBe(false)
    })

    it('should reject token_hash with only whitespace', () => {
      const result = validateResetConfirmParams({
        tokenHash: '   ',
        type: 'recovery',
        next: '/auth/update-password',
      })
      expect(result).toBe(false)
    })

    it('should accept token_hash with special characters', () => {
      const result = validateResetConfirmParams({
        tokenHash: 'abc+123/def==456',
        type: 'recovery',
        next: '/auth/update-password',
      })
      expect(result).toBe(true)
    })

    it('should reject missing type', () => {
      const result = validateResetConfirmParams({
        tokenHash: 'abc123',
        type: null,
        next: '/auth/update-password',
      })
      expect(result).toBe(false)
    })

    it('should reject wrong type', () => {
      const result = validateResetConfirmParams({
        tokenHash: 'abc123',
        type: 'signup',
        next: '/auth/update-password',
      })
      expect(result).toBe(false)
    })

    it('should reject type=magiclink', () => {
      const result = validateResetConfirmParams({
        tokenHash: 'abc123',
        type: 'magiclink',
        next: '/auth/update-password',
      })
      expect(result).toBe(false)
    })

    it('should reject missing next', () => {
      const result = validateResetConfirmParams({
        tokenHash: 'abc123',
        type: 'recovery',
        next: null,
      })
      expect(result).toBe(false)
    })

    it('should reject wrong next parameter', () => {
      const result = validateResetConfirmParams({
        tokenHash: 'abc123',
        type: 'recovery',
        next: '/dashboard',
      })
      expect(result).toBe(false)
    })

    it('should reject arbitrary redirect attempts in next', () => {
      const result = validateResetConfirmParams({
        tokenHash: 'abc123',
        type: 'recovery',
        next: 'https://evil.com',
      })
      expect(result).toBe(false)
    })

    it('should reject all parameters missing', () => {
      const result = validateResetConfirmParams({
        tokenHash: null,
        type: null,
        next: null,
      })
      expect(result).toBe(false)
    })
  })

  describe('buildResetConfirmCallbackUrl', () => {
    it('should build correct callback URL', () => {
      const url = buildResetConfirmCallbackUrl('abc123def456')
      expect(url).toBe('/auth/callback?token_hash=abc123def456&type=recovery&next=/auth/update-password')
    })

    it('should encode token with special characters', () => {
      const url = buildResetConfirmCallbackUrl('abc+123/def==456')
      expect(url).toContain('token_hash=abc%2B123%2Fdef%3D%3D456')
      expect(url).toContain('type=recovery')
      expect(url).toContain('next=/auth/update-password')
    })

    it('should always include correct type and next', () => {
      const url = buildResetConfirmCallbackUrl('token123')
      expect(url).toContain('type=recovery')
      expect(url).toContain('next=/auth/update-password')
    })

    it('should be URL-safe for routing', () => {
      const url = buildResetConfirmCallbackUrl('sensitive+token/data==')
      expect(url).toMatch(/^\/auth\/callback\?/)
      expect(() => new URL(url, 'http://localhost')).not.toThrow()
    })
  })

  describe('getResetConfirmErrorMessage', () => {
    it('should return missing token error', () => {
      const msg = getResetConfirmErrorMessage(null, 'recovery', '/auth/update-password')
      expect(msg).toContain('missing token')
    })

    it('should return empty token error', () => {
      const msg = getResetConfirmErrorMessage('', 'recovery', '/auth/update-password')
      expect(msg).toContain('missing token')
    })

    it('should return wrong type error', () => {
      const msg = getResetConfirmErrorMessage('abc123', 'signup', '/auth/update-password')
      expect(msg).toContain('unsupported recovery type')
    })

    it('should return wrong next error', () => {
      const msg = getResetConfirmErrorMessage('abc123', 'recovery', '/dashboard')
      expect(msg).toContain('unsupported redirect destination')
    })

    it('should return generic error for all missing', () => {
      const msg = getResetConfirmErrorMessage(null, null, null)
      expect(msg).toBeTruthy()
    })
  })

  describe('integration: validation + URL building', () => {
    it('should validate then build URL safely', () => {
      const tokenHash = 'recovery+token/data=='
      const type = 'recovery'
      const next = '/auth/update-password'

      const isValid = validateResetConfirmParams({ tokenHash, type, next })
      expect(isValid).toBe(true)

      const url = buildResetConfirmCallbackUrl(tokenHash)
      expect(url).toContain('token_hash=recovery%2Btoken%2Fdata%3D%3D')
      expect(url).toContain('type=recovery')
      expect(url).toContain('next=/auth/update-password')

      // Verify URL can be parsed safely
      const parsed = new URL(url, 'http://localhost')
      expect(parsed.searchParams.get('token_hash')).toBe('recovery+token/data==')
    })

    it('should catch validation errors before URL building', () => {
      const isValid = validateResetConfirmParams({
        tokenHash: null,
        type: 'recovery',
        next: '/auth/update-password',
      })
      expect(isValid).toBe(false)
      // In real code, we wouldn't call buildResetConfirmCallbackUrl after failed validation
    })
  })
})
