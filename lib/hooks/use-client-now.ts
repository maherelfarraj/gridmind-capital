'use client'

import { useEffect, useState } from 'react'

/**
 * Returns the current wall-clock time in milliseconds, but only after the
 * component has mounted on the client. Returns `null` during SSR and the
 * initial hydration render.
 *
 * Why this exists: `Date.now()` is impure, so calling it during render makes a
 * component non-idempotent. The server renders at one instant and the client
 * hydrates at another, so any derived value (days open, hours left of SLA,
 * "3s ago") can differ between the two and produce a hydration mismatch.
 *
 * Callers should treat `null` as "not known yet" and render a stable
 * placeholder, then show the real elapsed value once mounted.
 *
 * @param intervalMs When provided, re-reads the clock on that interval so
 *   long-lived elapsed-time displays keep counting instead of freezing at the
 *   value captured on mount.
 */
export function useClientNow(intervalMs?: number): number | null {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    // Intentional set-state-in-effect: reading the clock is a side effect and
    // must not happen during render. Starting at `null` and setting the real
    // time on mount is the supported way to keep SSR output deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())

    if (!intervalMs) return

    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
