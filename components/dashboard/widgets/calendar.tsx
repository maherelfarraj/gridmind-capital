'use client'
import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Calendar as CalIcon, Video, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './types'
import { getCalendarEvents } from '@/app/actions/dashboard'

const TYPE_COLOR: Record<string, string> = {
  gate:    '#6366f1', milestone: '#22c55e', deadline: '#ef4444',
  permit:  '#f59e0b', transmittal: '#0891b2',
}

interface CalEvent { id: string; title: string; project: string; date: string; type: string; location: string; link: string | null }

function fmtDay(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function CalendarWidget({ config }: { config: WidgetConfig }) {
  const { data, isLoading } = useSWR('widget-calendar-events', getCalendarEvents)

  // Merged feed: milestones + permit expiries + transmittal response-due dates
  const EVENTS: CalEvent[] = (data ?? []).map((m) => ({
    id:       m.id,
    title:    m.label,
    project:  m.project,
    date:     fmtDay(m.date),
    type:     m.type,
    location: m.location,
    link:     m.link,
  }))

  // Build day groupings (preserves the date order from the sorted feed)
  const grouped = EVENTS.reduce<Record<string, CalEvent[]>>((acc, e) => {
    acc[e.date] = acc[e.date] ? [...acc[e.date], e] : [e]
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <CalIcon className="size-3.5" />
        <span>Calendar</span>
        <span className="ml-auto bg-muted/50 text-muted-foreground rounded-full px-1.5 text-[10px]">{EVENTS.length} events</span>
      </div>
      <div className="flex flex-col gap-3 flex-1 overflow-auto">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted/20 animate-pulse" />)}
        {!isLoading && EVENTS.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No scheduled events</div>
        )}
        {Object.entries(grouped).map(([date, events]) => (
          <div key={date}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 sticky top-0 bg-card py-0.5">{date}</p>
            <div className="flex flex-col gap-1.5">
              {events.map(e => {
                const isRemote = e.location.toLowerCase().includes('teams') || e.location.toLowerCase().includes('call')
                const inner = (
                  <>
                    <div className="flex-1 min-w-0 pl-1.5">
                      <p className="text-xs font-semibold text-foreground truncate">{e.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground truncate">{e.project}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isRemote ? <Video className="size-2.5 text-muted-foreground" /> : <MapPin className="size-2.5 text-muted-foreground" />}
                        <span className="text-[10px] text-muted-foreground">{e.location}</span>
                      </div>
                    </div>
                  </>
                )
                const cls = 'flex items-start gap-2.5 rounded-lg hover:bg-muted/30 px-2 py-1.5 transition-colors group cursor-pointer'
                const style = { borderLeft: `2px solid ${TYPE_COLOR[e.type] ?? '#6b7280'}` }
                return e.link ? (
                  <Link key={e.id} href={e.link} className={cls} style={style}>{inner}</Link>
                ) : (
                  <div key={e.id} className={cls} style={style}>{inner}</div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
