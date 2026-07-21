'use client'

/**
 * Generic Supabase Realtime hook.
 * Subscribes to postgres_changes on a table and calls `onchange` on any event.
 *
 * Usage:
 *   useRealtime({ table: 'projects', onchange: () => mutate() })
 */
import { useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type Event = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface UseRealtimeOptions {
  table: string
  schema?: string
  event?: Event
  filter?: string
  onchange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  enabled?: boolean
}

export function useRealtime({
  table,
  schema = 'public',
  event = '*',
  filter,
  onchange,
  enabled = true,
}: UseRealtimeOptions) {
  const onchangeRef = useRef(onchange)
  onchangeRef.current = onchange

  useEffect(() => {
    if (!enabled) return

    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) return

    const supabase = createBrowserClient(url, anon)

    const channelName = `realtime-${schema}-${table}-${event}-${filter ?? 'all'}-${Math.random().toString(36).slice(2)}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event, schema, table, ...(filter ? { filter } : {}) },
        (payload) => onchangeRef.current(payload),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, schema, event, filter, enabled])
}
