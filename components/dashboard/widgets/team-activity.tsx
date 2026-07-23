'use client'
import * as React from 'react'
import useSWR from 'swr'
import { Users } from 'lucide-react'
import type { WidgetConfig } from './types'
import { getTeamActivity } from '@/app/actions/dashboard'

const ACTION_COLOR: Record<string, string> = {
  approve:  '#22c55e',
  upload:   '#3b82f6',
  comment:  '#f59e0b',
  complete: '#22c55e',
  create:   '#6366f1',
}

export function TeamActivityWidget({ config }: { config: WidgetConfig }) {
  const { data, isLoading } = useSWR('widget-team-activity', getTeamActivity)
  const ACTIVITY = data ?? []

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Users className="size-3.5" />
        <span>Team Activity</span>
        <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      </div>
      <div className="flex flex-col gap-0.5 flex-1 overflow-auto">
        {isLoading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted/20 animate-pulse" />)}
        {!isLoading && ACTIVITY.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No recent activity</div>
        )}
        {ACTIVITY.map((a) => (
          <div key={a.id} className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors">
            <div className="size-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
              style={{ background: a.color }}>
              {a.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-snug">
                <span className="font-semibold">{a.actor.split(' ')[0]}</span>
                {' '}
                <span style={{ color: ACTION_COLOR[a.type] }}>{a.action}</span>
                {' '}
                <span className="text-muted-foreground truncate">{a.target}</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
