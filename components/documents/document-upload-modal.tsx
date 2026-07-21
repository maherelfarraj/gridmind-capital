'use client'

import * as React from 'react'
import { Upload, X, File, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { createUploadUrl, registerDocument } from '@/app/actions/storage'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  projectId?: string | null
  projectCode?: string | null
  uploadedBy?: string
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface FileEntry {
  file: File
  title: string
  category: string
  status: UploadStatus
  error?: string
  progress: number
}

const CATEGORIES = [
  { id: 'civil',         label: 'Civil' },
  { id: 'electrical',    label: 'Electrical' },
  { id: 'mechanical',    label: 'Mechanical' },
  { id: 'procurement',   label: 'Procurement' },
  { id: 'hse',           label: 'HSE' },
  { id: 'commercial',    label: 'Commercial' },
  { id: 'commissioning', label: 'Commissioning' },
  { id: 'general',       label: 'General' },
]

const ACCEPT = '.pdf,.dwg,.xlsx,.docx,.png,.jpg,.zip'

export function DocumentUploadModal({
  open, onClose, onSuccess,
  projectId = null, projectCode = null,
  uploadedBy = 'Unknown',
}: Props) {
  const { toast } = useToast()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [entries, setEntries] = React.useState<FileEntry[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)

  const addFiles = React.useCallback((files: FileList | null) => {
    if (!files) return
    const next: FileEntry[] = Array.from(files).map((f) => ({
      file: f,
      title: f.name.replace(/\.[^.]+$/, ''),
      category: 'general',
      status: 'idle',
      progress: 0,
    }))
    setEntries((prev) => [...prev, ...next])
  }, [])

  const removeEntry = (idx: number) =>
    setEntries((prev) => prev.filter((_, i) => i !== idx))

  const updateEntry = (idx: number, patch: Partial<FileEntry>) =>
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, ...patch } : e))

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const uploadAll = async () => {
    if (entries.length === 0) return
    setIsUploading(true)
    let allOk = true

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.status === 'success') continue

      updateEntry(i, { status: 'uploading', progress: 10 })

      // 1. Get signed upload URL
      const urlResult = await createUploadUrl({
        fileName: entry.file.name,
        projectId,
        projectCode,
        uploadedBy,
      })

      if ('error' in urlResult) {
        updateEntry(i, { status: 'error', error: urlResult.error })
        allOk = false
        continue
      }

      updateEntry(i, { progress: 30 })

      // 2. PUT directly to Supabase Storage
      try {
        const res = await fetch(urlResult.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': entry.file.type || 'application/octet-stream' },
          body: entry.file,
        })
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      } catch (err) {
        updateEntry(i, { status: 'error', error: (err as Error).message })
        allOk = false
        continue
      }

      updateEntry(i, { progress: 70 })

      // 3. Register in DB
      const regResult = await registerDocument({
        storagePath: urlResult.storagePath,
        fileName: entry.file.name,
        title: entry.title,
        category: entry.category,
        size: entry.file.size,
        mimeType: entry.file.type,
        projectId,
        projectCode,
        uploadedBy,
      })

      if ('error' in regResult) {
        updateEntry(i, { status: 'error', error: regResult.error })
        allOk = false
      } else {
        updateEntry(i, { status: 'success', progress: 100 })
      }
    }

    setIsUploading(false)

    if (allOk) {
      toast({ title: 'Upload complete', description: `${entries.length} document${entries.length !== 1 ? 's' : ''} uploaded successfully.`, variant: 'success' })
      onSuccess()
      onClose()
    } else {
      toast({ title: 'Some uploads failed', description: 'Check the error messages and retry.', variant: 'danger' })
    }
  }

  const handleClose = () => {
    if (isUploading) return
    setEntries([])
    onClose()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload documents"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#64ffda]/10 flex items-center justify-center">
              <Upload className="size-4 text-[#64ffda]" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Upload Documents</h2>
              <p className="text-xs text-muted-foreground">
                {projectCode ? `Project ${projectCode}` : 'General document store'} · Max 50 MB per file
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            aria-label="Close upload modal"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* Drop zone */}
        <div className="px-6 pt-4 shrink-0">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-[#64ffda] bg-[#64ffda]/5'
                : 'border-border hover:border-[#64ffda]/50 hover:bg-muted/40',
            )}
          >
            <Upload className="size-8 text-muted-foreground mx-auto mb-2" aria-hidden />
            <p className="text-sm font-medium text-foreground">Drop files here or <span className="text-[#64ffda]">browse</span></p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DWG, XLSX, DOCX, PNG, JPG, ZIP</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            aria-label="File input"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {entries.length > 0 && (
          <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3 min-h-0">
            {entries.map((entry, idx) => (
              <div key={idx} className="bg-muted/40 border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <File className="size-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-foreground truncate">{entry.file.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatBytes(entry.file.size)}</p>
                  </div>
                  {entry.status === 'success' && <CheckCircle2 className="size-4 text-green-500 shrink-0" aria-hidden />}
                  {entry.status === 'error'   && <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden />}
                  {entry.status === 'uploading' && <Loader2 className="size-4 text-[#64ffda] animate-spin shrink-0" aria-hidden />}
                  {entry.status === 'idle' && (
                    <button onClick={() => removeEntry(idx)} aria-label="Remove file" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <X className="size-3" aria-hidden />
                    </button>
                  )}
                </div>

                {/* Title + Category */}
                {entry.status === 'idle' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={entry.title}
                      onChange={(e) => updateEntry(idx, { title: e.target.value })}
                      placeholder="Document title"
                      aria-label="Document title"
                      className="flex-1 h-7 px-2 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#64ffda]/40"
                    />
                    <select
                      value={entry.category}
                      onChange={(e) => updateEntry(idx, { category: e.target.value })}
                      aria-label="Document category"
                      className="h-7 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#64ffda]/40"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Progress bar */}
                {(entry.status === 'uploading' || entry.status === 'success') && (
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-300', entry.status === 'success' ? 'bg-green-500' : 'bg-[#64ffda]')}
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>
                )}

                {/* Error message */}
                {entry.status === 'error' && entry.error && (
                  <p className="text-[11px] text-red-400">{entry.error}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground">
            {entries.length === 0 ? 'No files selected' : `${entries.filter(e => e.status !== 'success').length} pending`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={uploadAll}
              disabled={entries.length === 0 || isUploading || entries.every(e => e.status === 'success')}
              className="px-4 py-2 text-sm rounded-lg bg-[#64ffda] text-[#0a192f] font-semibold hover:bg-[#64ffda]/90 transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {isUploading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {isUploading ? 'Uploading…' : `Upload ${entries.length > 0 ? entries.length : ''} File${entries.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
