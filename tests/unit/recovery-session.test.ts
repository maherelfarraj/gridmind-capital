import { describe, it, expect } from 'vitest'
import {
  evaluateRecoverySession,
  isRecoveryFormEnabled,
  type RecoveryStatus,
} from '@/lib/auth/recovery-session'

describe('evaluateRecoverySession', () => {
  it('returns "valid" for a session with a truthy recovery_sent_at', () => {
    const status = evaluateRecoverySession({
      session: { user: { recovery_sent_at: '2026-08-04T10:00:00Z' } },
      error: null,
    })
    expect(status).toBe('valid')
  })

  it('returns "no-session" when the session is null', () => {
    expect(evaluateRecoverySession({ session: null, error: null })).toBe('no-session')
  })

  it('returns "no-session" when the session is undefined', () => {
    expect(evaluateRecoverySession({ session: undefined })).toBe('no-session')
  })

  it('returns "error" when getSession returned an error (never "no-session")', () => {
    const status = evaluateRecoverySession({
      session: null,
      error: { message: 'network down' },
    })
    expect(status).toBe('error')
  })

  it('prioritises an error even if a session is also present', () => {
    const status = evaluateRecoverySession({
      session: { user: { recovery_sent_at: '2026-08-04T10:00:00Z' } },
      error: { message: 'boom' },
    })
    expect(status).toBe('error')
  })

  // Regression guards: the original page used `recovery_sent_at === null`, which
  // let `undefined` and '' pass as a valid recovery session. Truthiness rejects
  // all three.
  it('returns "no-recovery" when recovery_sent_at is null', () => {
    const status = evaluateRecoverySession({
      session: { user: { recovery_sent_at: null } },
      error: null,
    })
    expect(status).toBe('no-recovery')
  })

  it('returns "no-recovery" when recovery_sent_at is undefined', () => {
    const status = evaluateRecoverySession({
      session: { user: {} },
      error: null,
    })
    expect(status).toBe('no-recovery')
  })

  it('returns "no-recovery" when recovery_sent_at is an empty string', () => {
    const status = evaluateRecoverySession({
      session: { user: { recovery_sent_at: '' } },
      error: null,
    })
    expect(status).toBe('no-recovery')
  })

  it('returns "no-recovery" when the user object is missing entirely', () => {
    const status = evaluateRecoverySession({
      session: { user: null },
      error: null,
    })
    expect(status).toBe('no-recovery')
  })
})

describe('isRecoveryFormEnabled', () => {
  it('enables the form only for the "valid" status', () => {
    expect(isRecoveryFormEnabled('valid')).toBe(true)
  })

  it.each<RecoveryStatus | 'loading'>(['loading', 'no-session', 'no-recovery', 'error'])(
    'keeps the form disabled for %s',
    (status) => {
      expect(isRecoveryFormEnabled(status)).toBe(false)
    },
  )
})
