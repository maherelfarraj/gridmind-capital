'use client'

import * as React from 'react'
import { useToast } from '@/components/ui/toast'
import { useOnlineStatus } from '@/lib/pwa/use-online-status'
import { flushQueue, type QueuedApproval } from '@/lib/pwa/offline-queue'
import { syncQueuedApproval } from '@/app/actions/approvals'
import { OfflineBanner } from './offline-banner'
import { InstallPrompt } from './install-prompt'

/**
 * Client runtime for the PWA:
 *  - registers the service worker (production-safe; skips in dev)
 *  - flushes the offline approval queue when connectivity returns and
 *    shows a clear "Synced" toast
 *  - renders the offline banner + install prompt
 *
 * MUST be mounted inside a ToastProvider (it calls useToast).
 */
export function PwaProvider() {
  const { toast } = useToast()
  const online = useOnlineStatus()
  const wasOffline = React.useRef(false)
  const flushing = React.useRef(false)

  // ── Register the service worker ────────────────────────────
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Register after load so it never competes with first paint.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('[v0] SW registration failed:', err?.message)
      })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  // ── Flush queued approvals when back online ────────────────
  const runFlush = React.useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      const { synced, failed } = await flushQueue((item: QueuedApproval) =>
        syncQueuedApproval({
          id: item.approvalId,
          decision: item.decision,
          comment: item.comment,
        }),
      )
      if (synced.length > 0) {
        toast({
          title: `Synced ${synced.length} decision${synced.length === 1 ? '' : 's'}`,
          description: synced.map((s) => s.objectCode).join(', '),
          variant: 'success',
        })
        // Let inbox / dashboard revalidate their SWR caches.
        window.dispatchEvent(new CustomEvent('gmc:queue-synced'))
      }
      if (failed.length > 0) {
        toast({
          title: `${failed.length} decision${failed.length === 1 ? '' : 's'} failed to sync`,
          description: 'They remain queued and will retry.',
          variant: 'warning',
        })
      }
    } finally {
      flushing.current = false
    }
  }, [toast])

  React.useEffect(() => {
    if (online && wasOffline.current) {
      wasOffline.current = false
      void runFlush()
    }
    if (!online) wasOffline.current = true
  }, [online, runFlush])

  // On mount, if we're online, opportunistically flush anything left
  // over from a previous session.
  React.useEffect(() => {
    if (navigator.onLine) void runFlush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <OfflineBanner />
      <InstallPrompt />
    </>
  )
}
