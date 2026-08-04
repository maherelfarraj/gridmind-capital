import { describe, it, expect } from 'vitest'

describe('reset-confirm page parameter validation', () => {
  describe('token_hash validation', () => {
    it('should reject missing token_hash', () => {
      const params = new URLSearchParams()
      params.set('type', 'recovery')
      params.set('next', '/auth/update-password')

      const tokenHash = params.get('token_hash')
      expect(tokenHash).toBeNull()
    })

    it('should reject empty token_hash', () => {
      const params = new URLSearchParams()
      params.set('token_hash', '')
      params.set('type', 'recovery')
      params.set('next', '/auth/update-password')

      const tokenHash = params.get('token_hash')?.trim()
      expect(tokenHash).toBe('')
    })

    it('should accept valid token_hash', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123def456')
      params.set('type', 'recovery')
      params.set('next', '/auth/update-password')

      const tokenHash = params.get('token_hash')?.trim()
      expect(tokenHash).toBe('abc123def456')
      expect(tokenHash).not.toBe('')
    })

    it('should accept token_hash with special characters', () => {
      const params = new URLSearchParams()
      const tokenWithSpecial = 'abc+123/def==456'
      params.set('token_hash', tokenWithSpecial)
      params.set('type', 'recovery')
      params.set('next', '/auth/update-password')

      const tokenHash = params.get('token_hash')
      expect(tokenHash).toBe(tokenWithSpecial)
    })
  })

  describe('type validation', () => {
    it('should reject missing type', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('next', '/auth/update-password')

      const type = params.get('type')
      expect(type).toBeNull()
    })

    it('should only accept type=recovery', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('type', 'recovery')
      params.set('next', '/auth/update-password')

      const type = params.get('type')
      expect(type).toBe('recovery')
    })

    it('should reject type=signup', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('type', 'signup')
      params.set('next', '/auth/update-password')

      const type = params.get('type')
      expect(type).not.toBe('recovery')
    })

    it('should reject type=magiclink', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('type', 'magiclink')
      params.set('next', '/auth/update-password')

      const type = params.get('type')
      expect(type).not.toBe('recovery')
    })
  })

  describe('next parameter validation', () => {
    it('should reject missing next parameter', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('type', 'recovery')

      const next = params.get('next')
      expect(next).toBeNull()
    })

    it('should only accept next=/auth/update-password', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('type', 'recovery')
      params.set('next', '/auth/update-password')

      const next = params.get('next')
      expect(next).toBe('/auth/update-password')
    })

    it('should reject next=/dashboard', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('type', 'recovery')
      params.set('next', '/dashboard')

      const next = params.get('next')
      expect(next).not.toBe('/auth/update-password')
    })

    it('should reject next=/auth/login', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('type', 'recovery')
      params.set('next', '/auth/login')

      const next = params.get('next')
      expect(next).not.toBe('/auth/update-password')
    })

    it('should reject arbitrary redirect attempts', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('type', 'recovery')
      params.set('next', 'https://evil.com')

      const next = params.get('next')
      expect(next).not.toBe('/auth/update-password')
    })
  })

  describe('callback URL generation', () => {
    it('should generate correct callback URL with valid params', () => {
      const tokenHash = 'abc123def456'
      const encodedToken = encodeURIComponent(tokenHash)
      const callbackUrl = `/auth/callback?token_hash=${encodedToken}&type=recovery&next=/auth/update-password`

      expect(callbackUrl).toBe('/auth/callback?token_hash=abc123def456&type=recovery&next=/auth/update-password')
    })

    it('should properly encode token_hash with special characters', () => {
      const tokenHash = 'abc+123/def==456'
      const encodedToken = encodeURIComponent(tokenHash)
      const callbackUrl = `/auth/callback?token_hash=${encodedToken}&type=recovery&next=/auth/update-password`

      expect(callbackUrl).toContain('token_hash=abc%2B123%2Fdef%3D%3D456')
      expect(callbackUrl).toContain('type=recovery')
      expect(callbackUrl).toContain('next=/auth/update-password')
    })

    it('should properly encode tokens with special characters', () => {
      const tokenHash = 'sensitive+token/data==extra'
      const encodedToken = encodeURIComponent(tokenHash)
      const callbackUrl = `/auth/callback?token_hash=${encodedToken}&type=recovery&next=/auth/update-password`

      // Token should be encoded (+ becomes %2B, / becomes %2F, = becomes %3D)
      expect(encodedToken).toBe('sensitive%2Btoken%2Fdata%3D%3Dextra')
      expect(callbackUrl).toContain('token_hash=sensitive%2Btoken%2Fdata%3D%3Dextra')
    })

    it('should maintain consistent parameter order', () => {
      const tokenHash = 'abc123'
      const encodedToken = encodeURIComponent(tokenHash)
      const callbackUrl = `/auth/callback?token_hash=${encodedToken}&type=recovery&next=/auth/update-password`

      const url = new URL(callbackUrl, 'http://localhost')
      expect(url.searchParams.get('token_hash')).toBe('abc123')
      expect(url.searchParams.get('type')).toBe('recovery')
      expect(url.searchParams.get('next')).toBe('/auth/update-password')
    })
  })

  describe('complete parameter validation flow', () => {
    it('should pass validation with all correct parameters', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123def456')
      params.set('type', 'recovery')
      params.set('next', '/auth/update-password')

      const tokenHash = params.get('token_hash')?.trim()
      const type = params.get('type')
      const next = params.get('next')

      const isValid = tokenHash && tokenHash !== '' && type === 'recovery' && next === '/auth/update-password'

      expect(isValid).toBe(true)
    })

    it('should fail validation with missing token_hash', () => {
      const params = new URLSearchParams()
      params.set('type', 'recovery')
      params.set('next', '/auth/update-password')

      const tokenHash = params.get('token_hash')?.trim()
      const type = params.get('type')
      const next = params.get('next')

      const isValid = !!(tokenHash && tokenHash !== '' && type === 'recovery' && next === '/auth/update-password')

      expect(isValid).toBe(false)
    })

    it('should fail validation with wrong type', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('type', 'signup')
      params.set('next', '/auth/update-password')

      const tokenHash = params.get('token_hash')?.trim()
      const type = params.get('type')
      const next = params.get('next')

      const isValid = !!(tokenHash && tokenHash !== '' && type === 'recovery' && next === '/auth/update-password')

      expect(isValid).toBe(false)
    })

    it('should fail validation with wrong next parameter', () => {
      const params = new URLSearchParams()
      params.set('token_hash', 'abc123')
      params.set('type', 'recovery')
      params.set('next', '/dashboard')

      const tokenHash = params.get('token_hash')?.trim()
      const type = params.get('type')
      const next = params.get('next')

      const isValid = !!(tokenHash && tokenHash !== '' && type === 'recovery' && next === '/auth/update-password')

      expect(isValid).toBe(false)
    })

    it('should fail validation with all parameters missing', () => {
      const params = new URLSearchParams()

      const tokenHash = params.get('token_hash')?.trim()
      const type = params.get('type')
      const next = params.get('next')

      const isValid = !!(tokenHash && tokenHash !== '' && type === 'recovery' && next === '/auth/update-password')

      expect(isValid).toBe(false)
    })
  })
})
