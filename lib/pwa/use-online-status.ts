'use client'

import * as React from 'react'

/**
 * Tracks browser connectivity. Returns `true` when online.
 *
 * Starts optimistically `true` on the server / first paint to avoid a
 * hydration flash, then syncs to the real `navigator.onLine` value on mount.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(true)

  React.useEffect(() => {
    // Sync initial value once mounted (navigator is client-only).
    setOnline(navigator.onLine)

    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
