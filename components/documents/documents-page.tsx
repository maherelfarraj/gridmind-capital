'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  FileText,
  Upload,
  Download,
  Search,
  Filter,
  Eye,
  AlertCircle,
  FileImage,
  FileSpreadsheet,
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  MoreHorizontal,
  Tag,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { DocumentUploadModal } from './document-upload-modal'
import { listDocuments, getDownloadUrl, deleteDocument } from '@/app/actions/storage'
import type { StoredDocument } from '@/app/actions/storage'

// ─── Types ────────────────────────────────────────────────────

type DocCategory = 'all' | 'civil' | 'electrical' | 'mechanical' | 'procurement' | 'hse' | 'commercial' | 'commissioning' | 'general'

function extToFileType(name: string): 'pdf' | 'dwg' | 'xlsx' | 'docx' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'dwg') return 'dwg'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  if (ext === 'docx' || ext === 'doc') return 'docx'
  return 'other'
}

// ─── Config maps ──────────────────────────────────────────────

const STATUS_META: Record<DocStatus, { label: string; color: string; bg: string }> = {
  ifc:         { label: 'IFC',        color: '#22c55e', bg: '#22c55e18' },
  ifr:         { label: 'IFR',        color: '#3b82f6', bg: '#3b82f618' },
  ifa:         { label: 'IFA',        color: '#f59e0b', bg: '#f59e0b18' },
  draft:       { label: 'Draft',      color: '#94a3b8', bg: '#94a3b818' },
  superseded:  { label: 'Superseded', color: '#64748b', bg: '#64748b18' },
}

const TYPE_ICON: Record<DocumentRecord['type'], React.ElementType> = {
  pdf:   FileText,
  dwg:   FileImage,
  xlsx:  FileSpreadsheet,
  docx:  FileText,
  other: File,
}

const TYPE_COLOR: Record<DocumentRecord['type'], string> = {
  pdf:   '#ef4444',
  dwg:   '#3b82f6',
  xlsx:  '#22c55e',
  docx:  '#6366f1',
  other: '#94a3b8',
}

const CATEGORIES: { id: DocCategory; label: string; icon: React.ElementType }[] = [
  { id: 'all',          label: 'All Documents', icon: Folder },
  { id: 'civil',        label: 'Civil',         icon: FolderOpen },
  { id: 'electrical',   label: 'Electrical',    icon: FolderOpen },
  { id: 'mechanical',   label: 'Mechanical',    icon: FolderOpen },
  { id: 'procurement',  label: 'Procurement',   icon: FolderOpen },
  { id: 'hse',          label: 'HSE',           icon: FolderOpen },
  { id: 'commercial',   label: 'Commercial',    icon: FolderOpen },
  { id: 'commissioning',label: 'Commissioning', icon: FolderOpen },
]

// ─── Document row ─────────────────────────────────────────────

function DocumentRow({ doc, onDownload, onDelete }: {
  doc: StoredDocument
  onDownload: (storagePath: string, name: string) => void
  onDelete: (id: string, storagePath: string) => void
}) {
  const fileType = extToFileType(doc.name)
  const IconComp = TYPE_ICON[fileType]

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors group">
      {/* Type icon + code */}
      <td className="px-4 py-3 w-52">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="shrink-0 size-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${TYPE_COLOR[fileType]}18` }}
          >
            <IconComp className="size-4" style={{ color: TYPE_COLOR[fileType] }} aria-hidden />
          </div>
          <span className="font-mono text-xs text-[#64ffda] truncate">{doc.code}</span>
        </div>
      </td>
      {/* Title */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-foreground leading-tight truncate max-w-xs">{doc.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{doc.name}</p>
      </td>
      {/* Category */}
      <td className="px-4 py-3 text-center">
        <span className="text-xs capitalize text-muted-foreground">{doc.category}</span>
      </td>
      {/* Uploaded by */}
      <td className="px-4 py-3 hidden md:table-cell">
        <p className="text-xs text-foreground">{doc.uploadedBy}</p>
        <p className="text-[11px] text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      </td>
      {/* Size */}
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        <span className="text-xs text-muted-foreground">{doc.sizeLabel}</span>
      </td>
      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            aria-label={`Download ${doc.title}`}
            onClick={() => onDownload(doc.storagePath, doc.name)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="size-3.5" aria-hidden />
          </button>
          <button
            aria-label={`Delete ${doc.title}`}
            onClick={() => onDelete(doc.id, doc.storagePath)}
            className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function DocumentsPage({ projectCode }: { projectCode?: string }) {
  const { toast: addToast } = useToast()
  const [category, setCategory]     = React.useState<DocCategory>('all')
  const [search, setSearch]         = React.useState('')
  const [uploadOpen, setUploadOpen] = React.useState(false)

  const { data: docs = [], isLoading, mutate } = useSWR(
    ['documents', projectCode],
    () => listDocuments(projectCode),
    { revalidateOnFocus: true },
  )

  const filtered = React.useMemo(() => {
    return docs
      .filter((d) => category === 'all' || d.category === category)
      .filter((d) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          d.code.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.name.toLowerCase().includes(q)
        )
      })
  }, [docs, category, search])

  const catCounts = React.useMemo(() => {
    const counts: Partial<Record<DocCategory, number>> = { all: docs.length }
    docs.forEach((d) => {
      const cat = d.category as DocCategory
      counts[cat] = (counts[cat] ?? 0) + 1
    })
    return counts
  }, [docs])

  async function handleDownload(storagePath: string, name: string) {
    const result = await getDownloadUrl(storagePath)
    if ('error' in result) {
      addToast({ title: 'Download failed', description: result.error, variant: 'error' })
      return
    }
    const a = document.createElement('a')
    a.href = result.url
    a.download = name
    a.click()
  }

  async function handleDelete(id: string, storagePath: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    const { error } = await deleteDocument(id, storagePath)
    if (error) {
      addToast({ title: 'Delete failed', description: error, variant: 'error' })
    } else {
      addToast({ title: 'Document deleted', variant: 'success' })
      mutate()
    }
  }

  return (
    <>
      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => mutate()}
        projectCode={projectCode ?? null}
        uploadedBy="admin@gridmind.capital"
      />

      <div className="flex gap-6 min-h-0">
        {/* Sidebar category tree */}
        <nav aria-label="Document categories" className="hidden lg:flex flex-col w-48 shrink-0 gap-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5 mb-1">Categories</p>
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setCategory(id as DocCategory)}
              aria-current={category === id ? 'true' : undefined}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left w-full',
                category === id
                  ? 'bg-[#64ffda]/10 text-[#64ffda] font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{label}</span>
              {catCounts[id as DocCategory] !== undefined && (
                <span className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                  category === id ? 'bg-[#64ffda]/15 text-[#64ffda]' : 'bg-muted text-muted-foreground',
                )}>
                  {catCounts[id as DocCategory]}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Main area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Documents</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {projectCode
                  ? <>Project <span className="font-mono text-[#64ffda]">{projectCode}</span> document register</>
                  : 'IFC-controlled document register'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh">
                <RefreshCw className="size-3.5" aria-hidden />
              </Button>
              <Button variant="default" size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="size-4" aria-hidden />
                Upload Document
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Total',    value: docs.length,                                     color: '#64ffda' },
              { label: 'PDFs',     value: docs.filter(d => d.name.endsWith('.pdf')).length, color: '#ef4444' },
              { label: 'Drawings', value: docs.filter(d => d.name.endsWith('.dwg')).length, color: '#3b82f6' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2"
                style={{ borderLeftColor: color, borderLeftWidth: 2 }}
              >
                <span className="text-lg font-bold text-foreground">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden />
              <input
                type="search"
                placeholder="Search by code, title or filename..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search documents"
                className="w-full pl-8 pr-3 h-8 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition"
              />
            </div>
            <Filter className="size-3.5 text-muted-foreground shrink-0" aria-hidden />
          </div>

          {/* Table */}
          <Card className="overflow-hidden">
            <CardHeader className="px-4 py-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>{filtered.length} document{filtered.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ''}</span>
                {category !== 'all' && (
                  <span className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                    <ChevronRight className="size-3.5" aria-hidden />
                    {CATEGORIES.find((c) => c.id === category)?.label}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  <span className="text-sm">Loading documents…</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <FileText className="size-12 text-muted-foreground/40 mb-3" aria-hidden />
                  <p className="text-base font-semibold text-foreground">
                    {docs.length === 0 ? 'No documents yet' : 'No documents found'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {docs.length === 0
                      ? 'Upload your first document using the button above.'
                      : 'Try adjusting your search or category filter.'}
                  </p>
                  {docs.length === 0 && (
                    <button
                      onClick={() => setUploadOpen(true)}
                      className="mt-4 px-4 py-2 rounded-lg bg-[#64ffda]/10 text-[#64ffda] text-sm font-medium hover:bg-[#64ffda]/20 transition-colors flex items-center gap-2"
                    >
                      <Upload className="size-4" aria-hidden />
                      Upload first document
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full min-w-[700px] text-sm" role="table" aria-label="Document register">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-semibold">Code</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Title</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Category</th>
                      <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">Uploaded</th>
                      <th className="px-4 py-2.5 text-right font-semibold hidden lg:table-cell">Size</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((doc) => (
                      <DocumentRow key={doc.id} doc={doc} onDownload={handleDownload} onDelete={handleDelete} />
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
