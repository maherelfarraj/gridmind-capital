'use client'

import * as React from 'react'
import {
  Plus, Search, FolderOpen, Share2, Archive, LayoutTemplate,
  FileText, MoreHorizontal, Pencil, Trash2, Copy, ChevronDown, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { ReportConfig, ReportTemplate } from './types'
import { MOCK_REPORTS, REPORT_TEMPLATES } from './types'

type Folder = 'mine' | 'shared' | 'template' | 'archived'

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
  onNewReport: (templateId: string) => void
  onDeleteReport: (id: string) => void
}

const FOLDERS: { id: Folder; label: string; icon: React.ElementType }[] = [
  { id: 'mine',     label: 'My Reports',      icon: FileText },
  { id: 'shared',   label: 'Shared With Me',  icon: Share2 },
  { id: 'template', label: 'Templates',       icon: LayoutTemplate },
  { id: 'archived', label: 'Archived',        icon: Archive },
]

export function ReportListSidebar({ selectedId, onSelect, onNewReport, onDeleteReport }: Props) {
  const [search, setSearch]               = React.useState('')
  const [openFolders, setOpenFolders]     = React.useState<Set<Folder>>(new Set(['mine','shared']))
  const [showTemplates, setShowTemplates] = React.useState(false)

  const toggleFolder = (id: Folder) =>
    setOpenFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const filtered = MOCK_REPORTS.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Reports</span>
        <Button
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setShowTemplates(true)}
        >
          <Plus size={12} />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search reports…"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Folder list */}
      <ScrollArea className="flex-1 px-1">
        {FOLDERS.map(folder => {
          const reports = filtered.filter(r => r.folder === folder.id)
          if (search && !reports.length && folder.id !== 'mine') return null
          const open = openFolders.has(folder.id)
          const Icon = folder.icon
          return (
            <div key={folder.id} className="mb-0.5">
              <button
                onClick={() => toggleFolder(folder.id)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                <Icon size={12} />
                <span className="flex-1 text-left">{folder.label}</span>
                <span className="text-[10px] tabular-nums opacity-60">{reports.length}</span>
              </button>

              {open && (
                <div className="ml-4 mt-0.5 space-y-px">
                  {reports.length === 0 ? (
                    <p className="px-2 py-1 text-[11px] text-muted-foreground italic">
                      {folder.id === 'template' ? 'No templates' : 'No reports'}
                    </p>
                  ) : reports.map(r => (
                    <ReportRow
                      key={r.id}
                      report={r}
                      selected={selectedId === r.id}
                      onSelect={() => onSelect(r.id)}
                      onDelete={() => onDeleteReport(r.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </ScrollArea>

      {/* Template picker modal */}
      {showTemplates && (
        <TemplatePickerModal
          onSelect={id => { onNewReport(id); setShowTemplates(false) }}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </aside>
  )
}

// ─── Individual report row ───────────────────────────────────────────────────

function ReportRow({
  report, selected, onSelect, onDelete,
}: { report: ReportConfig; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex cursor-pointer items-start gap-1.5 rounded px-2 py-1.5 transition-colors',
        selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-foreground',
      )}
    >
      <FileText size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium leading-tight">{report.name}</p>
        <p className="text-[10px] text-muted-foreground">{report.updatedAt} · {report.createdBy}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {report.shared && <Share2 size={10} className="text-muted-foreground" />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={e => e.stopPropagation()}
              className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreHorizontal size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem className="gap-2 text-xs"><Pencil size={11} /> Rename</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs"><Copy size={11} /> Duplicate</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs"><Share2 size={11} /> Share</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs"><Archive size={11} /> Archive</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs text-destructive" onClick={e => { e.stopPropagation(); onDelete() }}>
              <Trash2 size={11} /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ─── Template picker modal ───────────────────────────────────────────────────

function TemplatePickerModal({
  onSelect, onClose,
}: { onSelect: (id: string) => void; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[520px] rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-1 text-base font-semibold text-foreground">New Report</h2>
        <p className="mb-5 text-sm text-muted-foreground">Choose a template or start from scratch</p>
        <div className="grid grid-cols-2 gap-3">
          {REPORT_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="flex flex-col items-start gap-1 rounded-xl border border-border bg-muted/30 px-4 py-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]"
            >
              <span className="text-sm font-medium text-foreground">{t.label}</span>
              <span className="text-xs text-muted-foreground leading-snug">{t.description}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
