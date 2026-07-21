'use client'

import * as React from 'react'

/**
 * Registers the GridMind service worker.
 *
 * On every mount:
 * 1. Sends UNREGISTER to any existing SW so it self-destructs + deletes caches.
 * 2. Waits a tick, then registers the fresh sw.js.
 * 3. Listens for RELOAD messages from the SW (posted after unregister).
 * 4. Attaches a global ChunkLoadError handler that hard-reloads once so
 *    the browser always picks up the latest chunk manifest.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // ── ChunkLoadError recovery ───────────────────────────────────────────
    // If Turbopack serves a new HTML with new chunk hashes but an old SW
    // is still in the pipe, chunks 404. Catch that and hard-reload once.
    const RELOAD_KEY = '__gmc_chunk_reload__'
    const handleError = (event: ErrorEvent) => {
      const msg = event.message ?? ''
      if (msg.includes('ChunkLoadError') || msg.includes('Failed to load chunk')) {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, '1')
          window.location.reload()
        }
      }
    }
    // Clear the reload guard on successful navigation so next deploy can reload again
    sessionStorage.removeItem(RELOAD_KEY)
    window.addEventListener('error', handleError)

    // ── SW message handler ────────────────────────────────────────────────
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data === 'RELOAD') window.location.reload()
    }
    navigator.serviceWorker.addEventListener('message', handleSWMessage)

    // ── Unregister any existing SW first, then re-register fresh ─────────
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      const unregisterAll = registrations.map((reg) => {
        // Ask the SW to clean up its own caches before unregistering
        if (reg.active) reg.active.postMessage('UNREGISTER')
        return reg.unregister()
      })

      // Also nuke all caches directly from the page side
      const clearCaches = caches.keys().then((keys) =>
        Promise.all(keys.map((k) => caches.delete(k)))
      )

      return Promise.all([...unregisterAll, clearCaches])
    }).then(() => {
      // Small tick to let unregistration settle, then register fresh
      return new Promise<void>((resolve) => setTimeout(resolve, 100))
    }).then(() => {
      return navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
    }).then((reg) => {
      // Force the waiting SW to activate immediately
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (newSW) {
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              newSW.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        }
      })
    }).catch((err) => {
      console.warn('[GMC] SW registration failed:', err)
    })

    return () => {
      window.removeEventListener('error', handleError)
      navigator.serviceWorker.removeEventListener('message', handleSWMessage)
    }
  }, [])

  return null
}
