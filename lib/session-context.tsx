'use client'

import * as React from 'react'
import { type AppSession, mockSession } from './session'

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
