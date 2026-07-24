'use client'

import * as React from 'react'
import { type AppSession, mockSession } from './session'
import type { AppDigitStyle } from './session'

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const SessionContext = React.createContext<AppSession>(mockSession)

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function SessionProvider({
  session = mockSession,
  children,
}: {
  session?: AppSession
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
 * Returns the current session. Falls back to mockSession if no
 * SessionProvider is present in the tree (e.g. in Storybook).
 */
export function useSession(): AppSession {
  return React.useContext(SessionContext)
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
  return React.useContext(SessionContext).digitStyle
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
  const session = React.useContext(SessionContext)
  return { locale: session.locale, digitStyle: session.digitStyle }
}
