'use client'
import * as React from 'react'
import { FileText, Upload, Clock, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './types'

const DOCS = [
  { id: 'd1', name: 'G3 Piling Report Rev B',     project: 'Sirius 400MW', type: 'approval', dueIn: '2 days',  urgent: true  },
  { id: 'd2', name: 'Earthing Design Rev C',       project: 'Vega BESS',   type: 'review',   dueIn: '4 days',  urgent: false },
  { id: 'd3', name: 'IPA-03 Payment Application',  project: 'Lyra Grid',   type: 'approval', dueIn: 'Today',   urgent: true  },
  { id: 'd4', name: 'HSE Method Statement',        project: 'Helios Sub',  type: 'upload',   dueIn: '5 days',  urgent: false },
  { id: 'd5', name: 'Transmittal TRS-088',         project: 'Orion Wind',  type: 'review',   dueIn: '1 day',   urgent: true  },
]

const TYPE_META = {
  approval: { icon: CheckCircle, color: 'text-green-500',  bg: 'bg-green-500/10', label: 'Approval' },
  review:   { icon: FileText,    color: 'text-blue-500',   bg: 'bg-blue-500/10',  label: 'Review'   },
  upload:   { icon: Upload,      color: 'text-amber-500',  bg: 'bg-amber-500/10', label: 'Upload'   },
}

export function DocumentQueueWidget({ config }: { config: WidgetConfig }) {
  const [dismissed, setDismissed] = React.useState<string[]>([])
  const visible = DOCS.filter(d => !dismissed.includes(d.id))
  const urgentCount = visible.filter(d => d.urgent).length

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <FileText className="size-3.5" />
        <span>Document Queue</span>
        {urgentCount > 0 && (
          <span className="ml-auto bg-red-500/10 text-red-500 rounded-full px-1.5 text-[10px] font-medium">{urgentCount} urgent</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 flex-1 overflow-auto">
        {visible.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">All clear</div>
        )}
        {visible.map((d) => {
          const m = TYPE_META[d.type as keyof typeof TYPE_META]
          const Icon = m.icon
          return (
            <div key={d.id} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted/30 transition-colors group', d.urgent && 'border border-red-500/20 bg-red-500/5')}>
              <div className={cn('p-1.5 rounded-md flex-shrink-0', m.bg)}>
                <Icon className={cn('size-3', m.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{d.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{d.project}</span>
                  <span className={cn('text-[10px] font-semibold px-1 rounded', m.color, m.bg)}>{m.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
                <Clock className="size-3" />
                <span className={d.urgent ? 'text-red-500 font-semibold' : ''}>{d.dueIn}</span>
              </div>
              <button
                onClick={() => setDismissed(prev => [...prev, d.id])}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all ml-1"
                aria-label="Dismiss"
              >
                <span className="text-[10px]">✕</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
