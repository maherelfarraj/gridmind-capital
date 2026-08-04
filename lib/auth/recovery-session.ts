/**
 * Pure decision logic for the /auth/update-password recovery flow.
 *
 * This is deliberately framework-free so it can be unit tested directly in the
 * node vitest environment (no DOM / effect harness required). The page uses it
 * as the single source of truth for whether the password form is shown, so the
 * behaviour that is tested here is the exact behaviour that runs in the page.
 */

/** Minimal shape of what we read from a Supabase session for recovery. */
export interface RecoverySessionInput {
  /** The session returned by supabase.auth.getSession(), or null when absent. */
  session: { user?: { recovery_sent_at?: string | null } | null } | null | undefined
  /** The error returned by supabase.auth.getSession(), if any. */
  error?: { message?: string } | null
}

export type RecoveryStatus = 'valid' | 'no-session' | 'no-recovery' | 'error'

/**
 * Decide whether a recovery session is valid enough to allow a password reset.
 *
 * Order matters:
 *  1. A getSession() error is surfaced as 'error' (never treated as "no session").
 *  2. A missing session is 'no-session' (invalid/expired link).
 *  3. recovery_sent_at MUST be truthy. A plain `!== null` check would let
 *     `undefined` (and '') through — this uses truthiness so null, undefined
 *     and empty string are all rejected as 'no-recovery'.
 */
export function evaluateRecoverySession({ session, error }: RecoverySessionInput): RecoveryStatus {
  if (error) return 'error'
  if (!session) return 'no-session'

  const recoverySentAt = session.user?.recovery_sent_at
  if (!recoverySentAt) return 'no-recovery'

  return 'valid'
}

/** Whether a given status should render the password form as enabled. */
export function isRecoveryFormEnabled(status: RecoveryStatus | 'loading'): boolean {
  return status === 'valid'
}
