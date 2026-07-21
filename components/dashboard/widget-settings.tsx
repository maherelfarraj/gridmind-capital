'use client'
import * as React from 'react'
import { Settings, X, RefreshCw, Database, Clock, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from './widgets/types'

interface WidgetSettingsProps {
  config: WidgetConfig
  onUpdate: (patch: Partial<WidgetConfig>) => void
  onClose: () => void
}

const TIME_RANGES  = [['7d','7 Days'],['30d','30 Days'],['90d','90 Days'],['ytd','YTD'],['custom','Custom']] as const
const REFRESH_OPTS = [['live','Live'],['5min','5 min'],['hourly','Hourly'],['manual','Manual']] as const
const PROJECTS     = [['all','All My Projects'],['sirius','Sirius 400MW'],['vega','Vega BESS'],['lyra','Lyra Grid'],['orion','Orion Wind'],['helios','Helios Sub']] as const

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{className?: string}>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Pills<T extends string>({ options, value, onSelect }: { options: readonly (readonly [T, string])[]; value: T; onSelect: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, label]) => (
        <button key={v}
          onClick={() => onSelect(v)}
          className={cn(
            'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
            value === v
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
          )}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function WidgetSettings({ config, onUpdate, onClose }: WidgetSettingsProps) {
  return (
    <div className="absolute top-8 right-0 z-50 w-72 rounded-xl border border-border bg-card shadow-xl shadow-black/20 p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Widget Settings</span>
        <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <Row icon={Database} label="Project">
          <select
            value={config.projectFilter}
            onChange={e => onUpdate({ projectFilter: e.target.value })}
            className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PROJECTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </Row>

        <Row icon={Clock} label="Time Range">
          <Pills
            options={TIME_RANGES}
            value={config.timeRange}
            onSelect={(v) => onUpdate({ timeRange: v })}
          />
        </Row>

        <Row icon={RefreshCw} label="Refresh">
          <Pills
            options={REFRESH_OPTS}
            value={config.refreshInterval}
            onSelect={(v) => onUpdate({ refreshInterval: v })}
          />
        </Row>

        <Row icon={Palette} label="Width">
          <div className="flex gap-1">
            {([1,2,3,4] as const).map(n => (
              <button key={n}
                onClick={() => onUpdate({ colSpan: n })}
                className={cn(
                  'flex-1 text-[10px] py-0.5 rounded border transition-colors',
                  config.colSpan === n
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                )}>
                {n}
              </button>
            ))}
          </div>
        </Row>

        <Row icon={Palette} label="Height">
          <div className="flex gap-1">
            {([1,2] as const).map(n => (
              <button key={n}
                onClick={() => onUpdate({ rowSpan: n })}
                className={cn(
                  'flex-1 text-[10px] py-0.5 rounded border transition-colors',
                  config.rowSpan === n
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                )}>
                {n === 1 ? 'Normal' : 'Tall'}
              </button>
            ))}
          </div>
        </Row>
      </div>
    </div>
  )
}
