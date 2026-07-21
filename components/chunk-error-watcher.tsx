'use client'

import { useEffect } from 'react'

function isChunkError(msg: string | undefined | null): boolean {
  if (!msg) return false
  return (
    msg.includes('ChunkLoadError') ||
    msg.includes('Failed to load chunk') ||
    msg.includes('Loading chunk')
  )
}

/**
 * Mounts once in the root layout. Listens for unhandled promise rejections
 * caused by Turbopack chunk-load failures (stale bootstrap after a server
 * restart) and triggers a hard reload so the browser fetches fresh chunks.
 * This runs entirely client-side via useEffect — no SSR output, no hydration
 * conflict with the v0 sandbox script injection.
 */
export function ChunkErrorWatcher() {
  useEffect(() => {
    function onRejection(e: PromiseRejectionEvent) {
      if (isChunkError(e?.reason?.message) || isChunkError(String(e?.reason ?? ''))) {
        e.preventDefault()
        window.location.reload()
      }
    }
    function onError(e: ErrorEvent) {
      if (isChunkError(e?.message)) {
        window.location.reload()
      }
    }
    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('error', onError, true)
    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('error', onError, true)
    }
  }, [])

  return null
}
