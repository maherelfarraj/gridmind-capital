'use client'
import * as React from 'react'
import { Megaphone, Pin, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './types'

const POSTS = [
  { id: 'p1', title: 'Platform Maintenance: July 26 at 02:00 UTC', body: 'GridMind will be offline for scheduled maintenance. Export any critical data beforehand.', pinned: true,  author: 'Platform Team', date: '1d ago',  category: 'system'   },
  { id: 'p2', title: 'G3 Review Process Updated',                  body: 'The stage-gate G3 checklist has been updated to include the new NEOM authority requirements. Review before your next convene.', pinned: true, author: 'PMO Director', date: '3d ago', category: 'process' },
  { id: 'p3', title: 'New HSE Template Library Available',         body: '14 new HSE templates have been added to the Document Library, including updated incident report forms.', pinned: false, author: 'HSE Manager', date: '5d ago',  category: 'content'  },
]

const CAT_COLOR: Record<string, string> = {
  system:  '#ef4444',
  process: '#6366f1',
  content: '#22c55e',
}

export function AnnouncementsWidget({ config }: { config: WidgetConfig }) {
  const [expanded, setExpanded] = React.useState<string | null>(null)
  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Megaphone className="size-3.5" />
        <span>Announcements</span>
        <span className="ml-auto bg-muted/50 text-muted-foreground rounded-full px-1.5 text-[10px]">{POSTS.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 overflow-auto">
        {POSTS.map((p) => {
          const isOpen = expanded === p.id
          return (
            <div key={p.id}
              className={cn('rounded-lg border border-border overflow-hidden', p.pinned && 'border-primary/20')}
              style={{ borderLeftColor: CAT_COLOR[p.category], borderLeftWidth: 3 }}
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
