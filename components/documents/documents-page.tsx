'use client'

import * as React from 'react'
import {
  FileText,
  Upload,
  Download,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileImage,
  FileSpreadsheet,
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  MoreHorizontal,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────

type DocStatus = 'ifc' | 'ifr' | 'ifa' | 'superseded' | 'draft'
type DocCategory = 'all' | 'civil' | 'electrical' | 'mechanical' | 'procurement' | 'hse' | 'commercial' | 'commissioning'

interface DocumentRecord {
  id: string
  code: string
  title: string
  category: DocCategory
  rev: string
  status: DocStatus
  size: string
  uploadedBy: string
  uploadedDate: string
  projectCode: string
  tags: string[]
  type: 'pdf' | 'dwg' | 'xlsx' | 'docx' | 'other'
}

// ─── Mock data ────────────────────────────────────────────────

const DOCUMENTS: DocumentRecord[] = [
  { id: 'd01', code: 'SRS-CIVIL-IFC-001', title: 'Piling Layout Plan — Zone A',          category: 'civil',        rev: 'C', status: 'ifc',       size: '4.2 MB',  uploadedBy: 'M. Al-Farsi', uploadedDate: '18 Jul 2025', projectCode: 'SRS-400', tags: ['piling','foundations'],     type: 'pdf' },
  { id: 'd02', code: 'SRS-ELEC-IFC-001', title: 'HV Cable Route Drawing',                category: 'electrical',   rev: 'B', status: 'ifc',       size: '2.8 MB',  uploadedBy: 'R. Chen',     uploadedDate: '17 Jul 2025', projectCode: 'SRS-400', tags: ['cable','HV'],               type: 'dwg' },
  { id: 'd03', code: 'SRS-ELEC-IFC-002', title: 'Inverter Station Single Line Diagram',  category: 'electrical',   rev: 'A', status: 'ifc',       size: '1.1 MB',  uploadedBy: 'M. Al-Farsi', uploadedDate: '16 Jul 2025', projectCode: 'SRS-400', tags: ['inverter','SLD'],           type: 'pdf' },
  { id: 'd04', code: 'SRS-MECH-IFR-001', title: 'Tracker System Specification',          category: 'mechanical',   rev: 'D', status: 'ifr',       size: '8.6 MB',  uploadedBy: 'J. Rivera',   uploadedDate: '15 Jul 2025', projectCode: 'SRS-400', tags: ['tracker','mechanical'],     type: 'pdf' },
  { id: 'd05', code: 'SRS-PROC-CON-001', title: 'EPC Sub-Contract — Civil Works',        category: 'procurement',  rev: 'A', status: 'ifa',       size: '1.4 MB',  uploadedBy: 'R. Chen',     uploadedDate: '14 Jul 2025', projectCode: 'SRS-400', tags: ['contract','subcontract'],   type: 'pdf' },
  { id: 'd06', code: 'SRS-HSE-PLAN-001', title: 'Construction Safety Management Plan',   category: 'hse',          rev: 'B', status: 'ifc',       size: '3.2 MB',  uploadedBy: 'L. Schmidt',  uploadedDate: '12 Jul 2025', projectCode: 'SRS-400', tags: ['safety','CMP'],             type: 'pdf' },
  { id: 'd07', code: 'SRS-COMM-GR-001',  title: 'G4 Gate Review Package',                category: 'commercial',   rev: 'A', status: 'ifc',       size: '12.4 MB', uploadedBy: 'A. Carter',   uploadedDate: '10 Jul 2025', projectCode: 'SRS-400', tags: ['gate','G4','review'],       type: 'pdf' },
  { id: 'd08', code: 'SRS-CIVIL-IFC-002','title': 'Grading & Drainage Plan',             category: 'civil',        rev: 'B', status: 'ifc',       size: '5.1 MB',  uploadedBy: 'M. Al-Farsi', uploadedDate: '09 Jul 2025', projectCode: 'SRS-400', tags: ['grading','drainage'],       type: 'dwg' },
  { id: 'd09', code: 'SRS-COM-COMM-001', title: 'Commissioning Procedure — Inverters',   category: 'commissioning',rev: 'A', status: 'ifr',       size: '2.0 MB',  uploadedBy: 'T. Müller',   uploadedDate: '08 Jul 2025', projectCode: 'SRS-400', tags: ['commissioning','inverter'], type: 'pdf' },
  { id: 'd10', code: 'SRS-ELEC-IFR-001', title: 'Protection Relay Settings Report',      category: 'electrical',   rev: 'B', status: 'ifr',       size: '0.9 MB',  uploadedBy: 'R. Chen',     uploadedDate: '05 Jul 2025', projectCode: 'SRS-400', tags: ['protection','relay'],       type: 'xlsx' },
  { id: 'd11', code: 'SRS-CIVIL-DRF-001','title': 'Site Layout — Phase 2 Study',         category: 'civil',        rev: 'A', status: 'draft',     size: '6.8 MB',  uploadedBy: 'M. Al-Farsi', uploadedDate: '03 Jul 2025', projectCode: 'SRS-400', tags: ['layout','phase2'],          type: 'dwg' },
  { id: 'd12', code: 'SRS-ELEC-SUP-001', title: 'MV Switchgear Spec Rev A (superseded)', category: 'electrical',   rev: 'A', status: 'superseded',size: '1.8 MB',  uploadedBy: 'R. Chen',     uploadedDate: '01 Jul 2025', projectCode: 'SRS-400', tags: ['MV','superseded'],          type: 'pdf' },
]

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

function DocumentRow({ doc, onDownload }: { doc: DocumentRecord; onDownload: (id: string) => void }) {
  const IconComp = TYPE_ICON[doc.type]
  const statusMeta = STATUS_META[doc.status]

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors group">
      {/* Type icon + code */}
      <td className="px-4 py-3 w-52">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="shrink-0 size-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${TYPE_COLOR[doc.type]}18` }}
          >
            <IconComp className="size-4" style={{ color: TYPE_COLOR[doc.type] }} aria-hidden />
          </div>
          <span className="font-mono text-xs text-[#64ffda] truncate">{doc.code}</span>
        </div>
      </td>
      {/* Title */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-foreground leading-tight truncate max-w-xs">{doc.title}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {doc.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              <Tag className="size-2.5" aria-hidden />
              {tag}
            </span>
          ))}
        </div>
      </td>
      {/* Rev */}
      <td className="px-4 py-3 text-center">
        <span className="font-mono text-sm font-semibold text-foreground">Rev {doc.rev}</span>
      </td>
      {/* Status */}
      <td className="px-4 py-3 text-center">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
          style={{ color: statusMeta.color, backgroundColor: statusMeta.bg }}
        >
          {statusMeta.label}
        </span>
      </td>
      {/* Uploaded by */}
      <td className="px-4 py-3 hidden md:table-cell">
        <p className="text-xs text-foreground">{doc.uploadedBy}</p>
        <p className="text-[11px] text-muted-foreground">{doc.uploadedDate}</p>
      </td>
      {/* Size */}
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        <span className="text-xs text-muted-foreground">{doc.size}</span>
      </td>
      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            aria-label={`Preview ${doc.title}`}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="size-3.5" aria-hidden />
          </button>
          <button
            aria-label={`Download ${doc.title}`}
            onClick={() => onDownload(doc.id)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="size-3.5" aria-hidden />
          </button>
          <button
            aria-label={`More options for ${doc.title}`}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function DocumentsPage() {
  const { toast: addToast } = useToast()
  const [category, setCategory] = React.useState<DocCategory>('all')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<DocStatus | 'all'>('all')

  const filtered = React.useMemo(() => {
    return DOCUMENTS
      .filter((d) => category === 'all' || d.category === category)
      .filter((d) => statusFilter === 'all' || d.status === statusFilter)
      .filter((d) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          d.code.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
        )
      })
  }, [category, search, statusFilter])

  // Counts per category
  const catCounts = React.useMemo(() => {
    const counts: Partial<Record<DocCategory, number>> = { all: DOCUMENTS.length }
    DOCUMENTS.forEach((d) => {
      counts[d.category] = (counts[d.category] ?? 0) + 1
    })
    return counts
  }, [])

  // Status distribution
  const ifcCount  = DOCUMENTS.filter((d) => d.status === 'ifc').length
  const ifrCount  = DOCUMENTS.filter((d) => d.status === 'ifr').length
  const draftCount = DOCUMENTS.filter((d) => d.status === 'draft').length

  function handleDownload(id: string) {
    const doc = DOCUMENTS.find((d) => d.id === id)
    addToast({ title: 'Downloading', description: `${doc?.code} — ${doc?.size}`, variant: 'info' })
  }

  function handleUpload() {
    addToast({ title: 'Upload', description: 'Document upload is available in the full app.', variant: 'info' })
  }

  const STATUS_CHIPS: { id: DocStatus | 'all'; label: string }[] = [
    { id: 'all',        label: `All (${DOCUMENTS.length})` },
    { id: 'ifc',        label: `IFC (${ifcCount})` },
    { id: 'ifr',        label: `IFR (${ifrCount})` },
    { id: 'ifa',        label: `IFA (${DOCUMENTS.filter(d => d.status === 'ifa').length})` },
    { id: 'draft',      label: `Draft (${draftCount})` },
    { id: 'superseded', label: `Superseded (${DOCUMENTS.filter(d => d.status === 'superseded').length})` },
  ]

  return (
    <div className="flex gap-6 min-h-0">
      {/* Sidebar category tree */}
      <nav aria-label="Document categories" className="hidden lg:flex flex-col w-48 shrink-0 gap-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5 mb-1">Categories</p>
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
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
            {catCounts[id] !== undefined && (
              <span className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                category === id ? 'bg-[#64ffda]/15 text-[#64ffda]' : 'bg-muted text-muted-foreground',
              )}>
                {catCounts[id]}
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
              IFC-controlled document register — <span className="font-mono text-[#64ffda]">SRS-400</span>
            </p>
          </div>
          <Button variant="default" size="sm" onClick={handleUpload}>
            <Upload className="size-4" aria-hidden />
            Upload Document
          </Button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Total',      value: DOCUMENTS.length,  color: '#64ffda' },
            { label: 'IFC',        value: ifcCount,           color: '#22c55e' },
            { label: 'IFR',        value: ifrCount,           color: '#3b82f6' },
            { label: 'Draft',      value: draftCount,         color: '#94a3b8' },
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

        {/* Search + status filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden />
            <input
              type="search"
              placeholder="Search by code, title or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search documents"
              className="w-full pl-8 pr-3 h-8 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition"
            />
          </div>
          <Filter className="size-3.5 text-muted-foreground shrink-0" aria-hidden />
          <div className="flex gap-1 flex-wrap">
            {STATUS_CHIPS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  statusFilter === id
                    ? 'bg-[#64ffda]/10 border-[#64ffda]/40 text-[#64ffda]'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
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
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <FileText className="size-12 text-muted-foreground/40 mb-3" aria-hidden />
                <p className="text-base font-semibold text-foreground">No documents found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or category filter.</p>
              </div>
            ) : (
              <table className="w-full min-w-[700px] text-sm" role="table" aria-label="Document register">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Code</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Title</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Rev</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">Uploaded</th>
                    <th className="px-4 py-2.5 text-right font-semibold hidden lg:table-cell">Size</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc) => (
                    <DocumentRow key={doc.id} doc={doc} onDownload={handleDownload} />
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
