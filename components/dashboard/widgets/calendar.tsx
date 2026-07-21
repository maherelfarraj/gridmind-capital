'use client'
import * as React from 'react'
import { Calendar as CalIcon, Video, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './types'

const EVENTS = [
  { id: 'e1', title: 'G3 Gate Convene',           project: 'Sirius 400MW', date: 'Jul 23', time: '09:00', type: 'gate',     location: 'Board Room A' },
  { id: 'e2', title: 'IPA-03 Review Meeting',     project: 'Lyra Grid',    date: 'Jul 24', time: '14:00', type: 'finance',  location: 'Teams Call'   },
  { id: 'e3', title: 'Site Progress Walk',         project: 'Helios Sub',   date: 'Jul 25', time: '08:00', type: 'site',     location: 'Site Office'  },
  { id: 'e4', title: 'Earthing Design Review',     project: 'Vega BESS',    date: 'Jul 25', time: '13:00', type: 'design',   location: 'Teams Call'   },
  { id: 'e5', title: 'Monthly HSE Committee',      project: 'All Projects', date: 'Jul 28', time: '10:00', type: 'hse',      location: 'Board Room B' },
  { id: 'e6', title: 'G1 Approval Workshop',       project: 'Orion Wind',   date: 'Jul 30', time: '11:00', type: 'gate',     location: 'Teams Call'   },
]

const TYPE_COLOR: Record<string, string> = {
  gate:    '#6366f1', finance: '#22c55e', site: '#f59e0b',
  design:  '#3b82f6', hse:     '#ef4444',
}

export function CalendarWidget({ config }: { config: WidgetConfig }) {
  // Build day groupings
  const grouped = EVENTS.reduce<Record<string, typeof EVENTS>>((acc, e) => {
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
        {Object.entries(grouped).map(([date, events]) => (
          <div key={date}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 sticky top-0 bg-card py-0.5">{date}</p>
            <div className="flex flex-col gap-1.5">
              {events.map(e => {
                const isRemote = e.location.toLowerCase().includes('teams') || e.location.toLowerCase().includes('call')
                return (
                  <div key={e.id} className="flex items-start gap-2.5 rounded-lg hover:bg-muted/30 px-2 py-1.5 transition-colors group cursor-pointer"
                    style={{ borderLeft: `2px solid ${TYPE_COLOR[e.type] ?? '#6b7280'}` }}>
                    <div className="flex-1 min-w-0 pl-1.5">
                      <p className="text-xs font-semibold text-foreground truncate">{e.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{e.time}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{e.project}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isRemote ? <Video className="size-2.5 text-muted-foreground" /> : <MapPin className="size-2.5 text-muted-foreground" />}
                        <span className="text-[10px] text-muted-foreground">{e.location}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
