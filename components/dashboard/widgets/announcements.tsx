'use client'
import * as React from 'react'
import useSWR from 'swr'
import { Megaphone, Pin, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './types'
import { getSystemAlerts } from '@/app/actions/dashboard'

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f59e0b',
}

export function AnnouncementsWidget({ config }: { config: WidgetConfig }) {
  const { data, isLoading } = useSWR('widget-alerts', getSystemAlerts)
  const [expanded, setExpanded] = React.useState<string | null>(null)

  const POSTS = (data ?? []).map((a) => ({
    id:       a.id,
    title:    a.title,
    body:     a.body,
    pinned:   a.severity === 'critical',
    author:   a.module ? a.module.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'System',
    date:     a.date,
    severity: a.severity,
  }))

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Megaphone className="size-3.5" />
        <span>Announcements</span>
        <span className="ml-auto bg-muted/50 text-muted-foreground rounded-full px-1.5 text-[10px]">{POSTS.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 overflow-auto">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted/20 animate-pulse" />)}
        {!isLoading && POSTS.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No announcements</div>
        )}
        {POSTS.map((p) => {
          const isOpen = expanded === p.id
          return (
            <div key={p.id}
              className={cn('rounded-lg border border-border overflow-hidden', p.pinned && 'border-primary/20')}
              style={{ borderLeftColor: SEV_COLOR[p.severity] ?? '#6b7280', borderLeftWidth: 3 }}
            >
              <button className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-muted/20 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : p.id)}>
                {p.pinned && <Pin className="size-3 text-primary flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-snug">{p.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{p.author}</span>
                    <span className="text-[10px] text-muted-foreground">{p.date}</span>
                  </div>
                </div>
                {isOpen ? <ChevronUp className="size-3 text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronDown className="size-3 text-muted-foreground flex-shrink-0 mt-0.5" />}
              </button>
              {isOpen && (
                <div className="px-3 pb-2.5 pt-0 text-xs text-muted-foreground border-t border-border/50">
                  {p.body}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
