'use client'
import * as React from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, Settings, Plus, LayoutGrid, Save, RotateCcw, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WidgetRenderer } from './widgets/index'
import { WidgetGallery } from './widget-gallery'
import { WidgetSettings } from './widget-settings'
import { DEFAULT_LAYOUT, WIDGET_CATALOG, type WidgetConfig, type WidgetDefinition } from './widgets/types'

const STORAGE_KEY = 'gmc-dashboard-layout-v1'

function loadLayout(): WidgetConfig[] {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as WidgetConfig[]
  } catch {}
  return DEFAULT_LAYOUT
}

function saveLayout(layout: WidgetConfig[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)) } catch {}
}

// ─── Undo toast ────────────────────────────────────────────────────────────────

function UndoToast({ label, onUndo, onDismiss }: { label: string; onUndo: () => void; onDismiss: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-2xl shadow-black/30 animate-in slide-in-from-bottom-4">
      <span className="text-sm text-foreground">{label}</span>
      <button onClick={onUndo} className="text-xs font-semibold text-primary hover:opacity-80 transition-opacity">Undo</button>
      <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors ms-1">
        <X className="size-3.5" />
      </button>
    </div>
  )
}

// ─── Saved toast ────────────────────────────────────────────────────────────────

function SavedToast({ onDismiss }: { onDismiss: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDismiss, 2500)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div className="fixed bottom-6 end-6 z-50 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 shadow-xl animate-in slide-in-from-bottom-4">
      <Check className="size-4 text-green-500" />
      <span className="text-sm text-green-500 font-medium">Layout saved</span>
    </div>
  )
}

// ─── Sortable widget card ───────────────────────────────────────────────────────

interface SortableWidgetProps {
  config: WidgetConfig
  editMode: boolean
  onDelete: (id: string) => void
  onUpdateConfig: (id: string, patch: Partial<WidgetConfig>) => void
  isDragging?: boolean
}

function SortableWidget({ config, editMode, onDelete, onUpdateConfig, isDragging }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({ id: config.id })
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${config.colSpan}`,
    gridRow:    `span ${config.rowSpan}`,
    minHeight:  config.rowSpan === 2 ? '340px' : '180px',
  }

  const def = WIDGET_CATALOG.find(d => d.id === config.widgetId)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative rounded-2xl border border-border bg-card transition-all overflow-hidden',
        isSortableDragging && 'opacity-40 scale-95',
        isDragging        && 'shadow-2xl shadow-black/30',
        editMode          && 'ring-1 ring-primary/20'
      )}
    >
      {/* Edit mode chrome */}
      {editMode && (
        <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-card/80 backdrop-blur-sm border-b border-border/50 z-10">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
          <span className="text-[10px] font-semibold text-muted-foreground truncate flex-1">{def?.label ?? config.widgetId}</span>
          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={cn('text-muted-foreground hover:text-foreground transition-colors', settingsOpen && 'text-primary')}
          >
            <Settings className="size-3.5" />
          </button>
          {/* Delete */}
          <button
            onClick={() => onDelete(config.id)}
            className="text-muted-foreground hover:text-red-500 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Widget content */}
      <div className={cn('h-full', editMode && 'pt-9')}>
        <WidgetRenderer config={config} />
      </div>

      {/* Resize handle (decorative, col/row span updated via settings) */}
      {editMode && (
        <div className="absolute bottom-1.5 right-1.5 size-3 opacity-30 cursor-se-resize">
          <svg viewBox="0 0 12 12" fill="currentColor" className="text-muted-foreground">
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="6"  cy="10" r="1.5" />
            <circle cx="10" cy="6"  r="1.5" />
          </svg>
        </div>
      )}

      {/* Settings panel */}
      {settingsOpen && (
        <WidgetSettings
          config={config}
          onUpdate={(patch) => onUpdateConfig(config.id, patch)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Main CustomizableDashboard ─────────────────────────────────────────────────

export function CustomizableDashboard() {
  const [layout, setLayout]       = React.useState<WidgetConfig[]>(DEFAULT_LAYOUT)
  const [editMode, setEditMode]   = React.useState(false)
  const [showGallery, setGallery] = React.useState(false)
  const [activeId, setActiveId]   = React.useState<UniqueIdentifier | null>(null)
  const [toast, setToast]         = React.useState<{ type: 'undo'; label: string; snapshot: WidgetConfig[] } | { type: 'saved' } | null>(null)
  const [hydrated, setHydrated]   = React.useState(false)

  // Hydrate from localStorage after mount
  React.useEffect(() => {
    setLayout(loadLayout())
    setHydrated(true)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLayout(prev => {
      const oldIdx = prev.findIndex(w => w.id === active.id)
      const newIdx = prev.findIndex(w => w.id === over.id)
      return arrayMove(prev, oldIdx, newIdx).map((w, i) => ({ ...w, order: i }))
    })
  }

  function handleDelete(id: string) {
    const snapshot = layout
    setLayout(prev => prev.filter(w => w.id !== id))
    const def = WIDGET_CATALOG.find(d => d.id === layout.find(w => w.id === id)?.widgetId)
    setToast({ type: 'undo', label: `Removed "${def?.label ?? 'widget'}"`, snapshot })
  }

  function handleAddWidget(def: WidgetDefinition) {
    const newWidget: WidgetConfig = {
      id:              `w-${Date.now()}`,
      widgetId:        def.id,
      colSpan:         def.defaultColSpan,
      rowSpan:         def.defaultRowSpan,
      order:           layout.length,
      projectFilter:   'all',
      timeRange:       '30d',
      refreshInterval: '5min',
    }
    setLayout(prev => [...prev, newWidget])
    setGallery(false)
  }

  function handleUpdateConfig(id: string, patch: Partial<WidgetConfig>) {
    setLayout(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w))
  }

  function handleSave() {
    saveLayout(layout)
    setEditMode(false)
    setToast({ type: 'saved' })
  }

  function handleReset() {
    const snapshot = layout
    setLayout(DEFAULT_LAYOUT)
    saveLayout(DEFAULT_LAYOUT)
    setToast({ type: 'undo', label: 'Reset to default layout', snapshot })
  }

  const activeConfig = activeId ? layout.find(w => w.id === activeId) : null

  if (!hydrated) return null

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <LayoutGrid className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">My Dashboard</span>
          <span className="text-xs text-muted-foreground ms-1">· {layout.length} widgets</span>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {editMode && (
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </button>
              <button
                onClick={() => setGallery(true)}
                className="flex items-center gap-1.5 text-xs bg-muted/40 hover:bg-muted border border-border rounded-lg px-3 py-1.5 transition-colors text-foreground"
              >
                <Plus className="size-3.5" />
                Add Widget
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 rounded-lg px-3 py-1.5 transition-opacity"
              >
                <Save className="size-3.5" />
                Save Layout
              </button>
            </>
          )}
          {!editMode && (
            <button
              onClick={() => setGallery(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              <Plus className="size-3.5" />
              Add Widget
            </button>
          )}
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              'flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 border transition-colors',
              editMode
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <Settings className="size-3.5" />
            {editMode ? 'Editing' : 'Edit Layout'}
          </button>
        </div>
      </div>

      {/* Edit mode hint */}
      {editMode && (
        <div className="text-xs text-muted-foreground bg-muted/20 border border-border/50 rounded-lg px-3 py-2">
          Drag widgets to rearrange. Use the gear icon to configure each widget. Click <strong>Save Layout</strong> when done.
        </div>
      )}

      {/* Empty state */}
      {layout.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-2xl">
          <LayoutGrid className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-foreground">Welcome! Add your first widget</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Customize your dashboard with the widgets most relevant to you.</p>
          <button
            onClick={() => setGallery(true)}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" />
            Add Widget
          </button>
        </div>
      )}

      {/* DnD Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={layout.map(w => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-4 auto-rows-[180px]"
            style={{ gridAutoRows: '180px' }}>
            {layout.map(config => (
              <SortableWidget
                key={config.id}
                config={config}
                editMode={editMode}
                onDelete={handleDelete}
                onUpdateConfig={handleUpdateConfig}
                isDragging={activeId === config.id}
              />
            ))}
          </div>
        </SortableContext>

        {/* Drag overlay */}
        <DragOverlay>
          {activeConfig && (
            <div
              className="rounded-2xl border border-primary/50 bg-card shadow-2xl shadow-black/40 opacity-90"
              style={{
                gridColumn: `span ${activeConfig.colSpan}`,
                minHeight: activeConfig.rowSpan === 2 ? '340px' : '180px',
                width: `${activeConfig.colSpan * 25}%`,
              }}
            >
              <WidgetRenderer config={activeConfig} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Gallery modal */}
      {showGallery && (
        <WidgetGallery
          addedWidgetIds={layout.map(w => w.widgetId)}
          onAdd={handleAddWidget}
          onClose={() => setGallery(false)}
        />
      )}

      {/* Toasts */}
      {toast?.type === 'undo' && (
        <UndoToast
          label={toast.label}
          onUndo={() => { setLayout(toast.snapshot); setToast(null) }}
          onDismiss={() => setToast(null)}
        />
      )}
      {toast?.type === 'saved' && <SavedToast onDismiss={() => setToast(null)} />}
    </div>
  )
}
