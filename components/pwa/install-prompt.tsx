'use client'

import * as React from 'react'
import { Download, X, Share, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'gmc-install-dismissed'
const DISMISS_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    return Date.now() - ts < DISMISS_DAYS * 86_400_000
  } catch {
    return false
  }
}

/**
 * "Add to Home Screen" install prompt for mobile browsers.
 *  - Android/Chromium: captures `beforeinstallprompt` and shows a native
 *    install button.
 *  - iOS Safari: no beforeinstallprompt event exists, so we show manual
 *    Share → Add to Home Screen instructions instead.
 * Only renders on mobile, when not already installed, and respects a
 * 14-day dismiss window.
 */
export function InstallPrompt() {
  const [visible, setVisible] = React.useState(false)
  const [ios, setIos] = React.useState(false)
  const deferredRef = React.useRef<BeforeInstallPromptEvent | null>(null)

  React.useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    const mobile = window.matchMedia('(max-width: 768px)').matches
    if (!mobile) return

    if (isIos()) {
      setIos(true)
      // Give the app a moment before nudging iOS users.
      const t = setTimeout(() => setVisible(true), 2500)
      return () => clearTimeout(t)
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferredRef.current = e as BeforeInstallPromptEvent
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    const onInstalled = () => {
      setVisible(false)
      deferredRef.current = null
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = React.useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }, [])

  const install = React.useCallback(async () => {
    const evt = deferredRef.current
    if (!evt) return
    await evt.prompt()
    const { outcome } = await evt.userChoice
    if (outcome === 'accepted') setVisible(false)
    else dismiss()
    deferredRef.current = null
  }, [dismiss])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Install GridMind Capital"
      className={cn(
        'fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+80px)] z-[70] md:hidden',
        'rounded-2xl border border-border bg-card p-4 shadow-xl',
        'animate-[fade-in_0.2s_ease-out]',
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#0a192f]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="size-11 rounded-xl" />
        </span>
        <div className="min-w-0 flex-1 pr-5">
          <p className="text-sm font-semibold text-foreground">Install GridMind Capital</p>
          {ios ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Tap{' '}
              <Share className="inline size-3.5 -translate-y-0.5" aria-label="Share" /> then{' '}
              <span className="font-medium text-foreground">
                Add to Home Screen <Plus className="inline size-3" aria-hidden="true" />
              </span>{' '}
              for fast, full-screen access with offline support.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Add to your home screen for full-screen access and offline approvals.
            </p>
          )}
        </div>
      </div>

      {!ios && (
        <button
          type="button"
          onClick={install}
          className={cn(
            'mt-3 flex w-full items-center justify-center gap-2 rounded-xl',
            'bg-[#64ffda] py-3 text-sm font-semibold text-[#0a192f]',
            'active:opacity-85 min-h-11',
          )}
        >
          <Download className="size-4" />
          Install app
        </button>
      )}
    </div>
  )
}
