'use client'

import { ReactNode } from 'react'
import { SWRConfig } from 'swr'

/**
 * Global SWR configuration provider.
 *
 * Defaults:
 * - revalidateOnFocus: false — prevents constant refetches when user refocuses window
 * - dedupingInterval: 30000 — cache identical requests for 30s
 * - focusThrottleInterval: 60000 — throttle focus revalidation to 60s intervals
 *
 * Individual hooks can opt back into focus revalidation by setting
 * revalidateOnFocus: true in their SWR options.
 */
export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 30000,
        focusThrottleInterval: 60000,
      }}
    >
      {children}
    </SWRConfig>
  )
}
