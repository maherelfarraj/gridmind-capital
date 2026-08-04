/**
 * Password recovery confirmation helpers.
 * Used by both the reset-confirm page and tests to validate and build recovery URLs.
 */

export interface ResetConfirmParams {
  tokenHash?: string | null
  type?: string | null
  next?: string | null
}

/**
 * Validate recovery link parameters.
 * Ensures token_hash is present, type is 'recovery', and next is '/auth/update-password'.
 * @returns true if all parameters are valid, false otherwise
 */
export function validateResetConfirmParams(params: ResetConfirmParams): boolean {
  const { tokenHash, type, next } = params

  // Token hash must be present and non-empty
  if (!tokenHash || tokenHash.trim() === '') {
    return false
  }

  // Type must be exactly 'recovery'
  if (type !== 'recovery') {
    return false
  }

  // Next must be exactly '/auth/update-password'
  if (next !== '/auth/update-password') {
    return false
  }

  return true
}

/**
 * Build the encoded callback URL for password recovery.
 * Encodes the token_hash to handle special characters safely.
 * @param tokenHash - The recovery token hash from email link
 * @returns Callback URL with encoded parameters
 */
export function buildResetConfirmCallbackUrl(tokenHash: string): string {
  const encodedToken = encodeURIComponent(tokenHash)
  return `/auth/callback?token_hash=${encodedToken}&type=recovery&next=/auth/update-password`
}

/**
 * Get a user-friendly error message for invalid recovery links.
 * @param tokenHash - The provided token hash
 * @param type - The provided type parameter
 * @param next - The provided next parameter
 * @returns Descriptive error message
 */
export function getResetConfirmErrorMessage(
  tokenHash: string | null,
  type: string | null,
  next: string | null,
): string {
  if (!tokenHash || tokenHash.trim() === '') {
    return 'Invalid recovery link: missing token.'
  }

  if (type !== 'recovery') {
    return 'Invalid recovery link: unsupported recovery type.'
  }

  if (next !== '/auth/update-password') {
    return 'Invalid recovery link: unsupported redirect destination.'
  }

  return 'The recovery link is invalid or has expired.'
}
