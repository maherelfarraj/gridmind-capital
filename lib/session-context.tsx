'use client'

import * as React from 'react'
import { type AppSession } from './session'
import type { AppDigitStyle } from './session'

// ─────────────────────────────────────────────────────────────
// Context
//
// The default is `null`, never a sample session. A context default IS a
// production code path: any component rendered outside SessionProvider would
// silently receive a fabricated identity — complete with role, tenant and
// permissions — instead of failing. Missing provider must be a loud bug, not a
// silent grant.
// ─────────────────────────────────────────────────────────────

const SessionContext = React.createContext<AppSession | null>(null)

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

/**
 * Supplies the authenticated session to the client tree.
 *
 * `session` is REQUIRED and has no default. Only a layout that has already
 * resolved an `active` session state may render this.
 */
export function SessionProvider({
  session,
  children,
}: {
  session: AppSession
  children: React.ReactNode
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * Returns the current session, or throws if there is no provider above.
 *
 * It deliberately does NOT fall back to a sample identity: a component that
 * renders without an authenticated provider is a routing/authorization bug,
 * and inventing a session would hide it.
 */
export function useSession(): AppSession {
  const session = React.useContext(SessionContext)

  if (!session) {
    throw new Error(
      'useSession must be used within an authenticated SessionProvider',
    )
  }

  return session
}

/**
 * Convenience hook: returns the user's digit style ('western' | 'arabic_indic').
 * Use in KPI cards and tables to call lib/digits.ts formatNumber().
 *
 * @example
 *   const digitStyle = useDigitStyle()
 *   <span dir="ltr">{formatNumber(1_234_567, digitStyle)}</span>
 */
export function useDigitStyle(): AppDigitStyle {
  return useSession().digitStyle
}

/**
 * Convenience hook: returns { locale, digitStyle } together.
 * Useful when a component needs both for the lib/i18n/format.ts helpers.
 *
 * @example
 *   const { locale, digitStyle } = useLocalePrefs()
 *   <LtrSpan>{formatCurrency(row.amount, locale, digitStyle)}</LtrSpan>
 */
export function useLocalePrefs(): { locale: string; digitStyle: AppDigitStyle } {
  const session = useSession()
  return { locale: session.locale, digitStyle: session.digitStyle }
}
