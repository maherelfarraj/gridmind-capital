'use client'
import * as React from 'react'
import { X, Search, Plus, Activity, Shield, CheckSquare, BarChart2, CalendarRange, Users, AlertTriangle, FileText, Calendar, Zap, TrendingUp, Megaphone, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WIDGET_CATALOG, type WidgetDefinition } from './widgets/types'

const ICON_MAP: Record<string, React.ComponentType<{className?: string}>> = {
  Activity, Shield, CheckSquare, BarChart2, CalendarRange, Users,
  AlertTriangle, FileText, Calendar, Zap, TrendingUp, Megaphone, Landmark,
}

const CATEGORIES = [
  { id: 'all',        label: 'All' },
  { id: 'project',    label: 'Project' },
  { id: 'finance',    label: 'Finance' },
  { id: 'team',       label: 'Team' },
  { id: 'operations', label: 'Operations' },
  { id: 'custom',     label: 'Custom' },
]

interface WidgetGalleryProps {
  addedWidgetIds: string[]
  onAdd: (def: WidgetDefinition) => void
  onClose: () => void
}

export function WidgetGallery({ addedWidgetIds, onAdd, onClose }: WidgetGalleryProps) {
  const [search, setSearch]   = React.useState('')
  const [cat, setCat]         = React.useState('all')
  const [preview, setPreview] = React.useState<WidgetDefinition | null>(null)

  const filtered = WIDGET_CATALOG.filter(w =>
    (cat === 'all' || w.category === cat) &&
    (search === '' || w.label.toLowerCase().includes(search.toLowerCase()) || w.description.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <Plus className="size-4 text-primary" />
            <div>
              <h2 className="text-sm font-bold text-foreground">Add Widget</h2>
              <p className="text-xs text-muted-foreground">Choose a widget to add to your dashboard</p>
            </div>
            <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-4" />
            </button>
          </div>

          {/* Search + category filters */}
          <div className="px-5 py-3 border-b border-border flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search widgets..."
                className="flex-1 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                autoFocus
              />
              {search && <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground"><X className="size-3" /></button>}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {CATEGORIES.map(c => (
                <button key={c.id}
                  onClick={() => setCat(c.id)}
                  className={cn(
                    'text-xs px-3 py-1 rounded-full border flex-shrink-0 transition-colors',
                    cat === c.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="size-8 mb-2 opacity-30" />
                <p className="text-sm">No widgets match your search</p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map(w => {
                const Icon = ICON_MAP[w.icon] ?? Activity
                const isAdded = addedWidgetIds.includes(w.id)
                return (
                  <div key={w.id}
                    className={cn(
                      'rounded-xl border p-3.5 cursor-pointer transition-all flex flex-col gap-2 group',
                      preview?.id === w.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-muted/20'
                    )}
                    onClick={() => setPreview(preview?.id === w.id ? null : w)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="size-4 text-primary" />
                      </div>
                      {isAdded && (
                        <span className="text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-full font-medium">Added</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{w.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{w.description}</p>
                    </div>
                    {preview?.id === w.id && (
                      <div className="mt-1 pt-2 border-t border-border/50 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground flex-1">
                          {w.defaultColSpan}×{w.defaultRowSpan} · {w.category}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onAdd(w) }}
                          className="flex items-center gap-1 text-[10px] font-semibold bg-primary text-primary-foreground px-2.5 py-1 rounded-lg hover:opacity-90 transition-opacity"
                        >
                          <Plus className="size-3" />
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
