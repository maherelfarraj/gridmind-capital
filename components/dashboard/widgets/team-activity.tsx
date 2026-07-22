'use client'
import * as React from 'react'
import { Users } from 'lucide-react'
import type { WidgetConfig } from './types'

interface ActivityItem {
  id: string; actor: string; initials: string; color: string
  action: string; target: string; time: string
  type: 'approve' | 'upload' | 'comment' | 'complete' | 'create'
}

const ACTIVITY: ActivityItem[] = [
  { id: 'a1', actor: 'Sarah Chen',       initials: 'SC', color: '#6366f1', action: 'approved',  target: 'G3 Piling Report',       time: '2m ago',   type: 'approve'  },
  { id: 'a2', actor: 'Omar Al-Zaid',     initials: 'OZ', color: '#22c55e', action: 'uploaded',  target: 'Earthing Design Rev C',   time: '18m ago',  type: 'upload'   },
  { id: 'a3', actor: 'James Morgan',     initials: 'JM', color: '#f59e0b', action: 'commented', target: 'IPA-03 Application',      time: '45m ago',  type: 'comment'  },
  { id: 'a4', actor: 'Aisha Al-Rashidi', initials: 'AA', color: '#3b82f6', action: 'completed', target: 'Procurement Register',    time: '1h ago',   type: 'complete' },
  { id: 'a5', actor: 'Yuki Tanaka',      initials: 'YT', color: '#ec4899', action: 'created',   target: 'RFI-041 HV Routing',      time: '2h ago',   type: 'create'   },
  { id: 'a6', actor: 'Sarah Chen',       initials: 'SC', color: '#6366f1', action: 'approved',  target: 'Substation SLD Rev B',    time: '3h ago',   type: 'approve'  },
  { id: 'a7', actor: 'Mohammed Hassan',  initials: 'MH', color: '#10b981', action: 'uploaded',  target: 'HSE Inspection Report',   time: '4h ago',   type: 'upload'   },
  { id: 'a8', actor: 'Omar Al-Zaid',     initials: 'OZ', color: '#22c55e', action: 'completed', target: 'Foundation Piles Zone A', time: '5h ago',   type: 'complete' },
]

const ACTION_COLOR: Record<ActivityItem['type'], string> = {
  approve:  '#22c55e',
  upload:   '#3b82f6',
  comment:  '#f59e0b',
  complete: '#22c55e',
  create:   '#6366f1',
}

export function TeamActivityWidget({ config }: { config: WidgetConfig }) {
  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Users className="size-3.5" />
        <span>Team Activity</span>
        <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      </div>
      <div className="flex flex-col gap-0.5 flex-1 overflow-auto">
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
