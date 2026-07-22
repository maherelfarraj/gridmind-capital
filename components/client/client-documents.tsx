'use client'

import * as React from 'react'
import { FileText, Download, Loader2 } from 'lucide-react'
import type { ClientDocument } from '@/app/actions/client'
import { getClientDocumentUrl } from '@/app/actions/client'
import { useToast } from '@/components/ui/toast'
import { formatDate } from './client-utils'

export function ClientDocuments({ documents }: { documents: ClientDocument[] }) {
  const { toast } = useToast()
  const [downloading, setDownloading] = React.useState<string | null>(null)

  const handleDownload = async (doc: ClientDocument) => {
    setDownloading(doc.id)
    const res = await getClientDocumentUrl(doc.id)
    setDownloading(null)
    if ('error' in res) {
      toast({ title: 'Download failed', description: res.error, variant: 'danger' })
      return
    }
    window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Project documents shared with you. Downloads are recorded for the project record.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No documents have been shared yet.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[doc.code, doc.category, doc.revision ? `Rev ${doc.revision}` : null, formatDate(doc.createdAt)]
                      .filter(Boolean).join(' • ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(doc)}
                disabled={downloading === doc.id}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {downloading === doc.id
                  ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  : <Download className="size-3.5" aria-hidden />}
                Download
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
