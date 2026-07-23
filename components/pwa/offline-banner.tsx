'use client'

import * as React from 'react'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/lib/pwa/use-online-status'
import { getQueueCount } from '@/lib/pwa/offline-queue'
import { cn } from '@/lib/utils'

/**
 * Fixed banner shown whenever the device is offline. Also surfaces how
 * many approval decisions are queued for sync. Sits above the bottom
 * tab bar on mobile.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const [queued, setQueued] = React.useState(0)

  React.useEffect(() => {
    if (online) return
    let active = true
    getQueueCount().then((n) => active && setQueued(n))
    const interval = setInterval(() => {
      getQueueCount().then((n) => active && setQueued(n))
    }, 3000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [online])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2',
        'bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950',
        'shadow-md',
      )}
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>
        You&rsquo;re offline. Viewing saved pages.
        {queued > 0 && (
          <span className="font-semibold">
            {' '}
            {queued} decision{queued === 1 ? '' : 's'} will sync when you reconnect.
          </span>
        )}
      </span>
    </div>
  )
}
