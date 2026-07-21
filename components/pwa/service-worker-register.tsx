'use client'

import * as React from 'react'

/**
 * Registers the GridMind service worker for PWA / offline support.
 * Renders nothing — side-effect only.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        // Force the new SW to activate immediately, evicting the old cache
        reg.update()
      })
      .catch((err) => console.warn('[GMC] SW registration failed:', err))
  }, [])
  return null
}
