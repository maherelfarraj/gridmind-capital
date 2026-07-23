'use client'
import * as React from 'react'
import useSWR from 'swr'
import { Shield, ChevronRight } from 'lucide-react'
import type { WidgetConfig } from './types'
import { useRouter } from 'next/navigation'
import { getActiveGates } from '@/app/actions/dashboard'

export function ActiveGatesWidget({ config }: { config: WidgetConfig }) {
  const router = useRouter()
  const { data: GATES, isLoading } = useSWR('widget-active-gates', getActiveGates)

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Shield className="size-3.5" />
        <span>Active Gates</span>
        <span className="ml-auto bg-muted/50 text-muted-foreground rounded-full px-1.5 text-[10px] font-medium">{GATES?.length ?? 0}</span>
      </div>
      <div className="flex flex-col gap-2 flex-1 overflow-auto">
        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 rounded-lg bg-muted/20 animate-pulse" />)}
          </div>
        )}
        {!isLoading && (GATES?.length ?? 0) === 0 && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
        )}
        {(GATES ?? []).map((g) => (
          <button
            key={g.id}
            onClick={() => router.push(`/projects/${g.id}`)}
            className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-muted/40 transition-colors text-left group"
          >
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0"
              style={{ color: g.color, borderColor: `${g.color}40`, background: `${g.color}12` }}>
              {g.gate}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{g.project}</p>
              <p className="text-[10px] text-muted-foreground">{g.label}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${g.pct}%`, background: g.color }} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{g.pct}%</span>
            </div>
            <ChevronRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  )
}
