'use client'

import * as React from 'react'
import { FileBarChart, Download, Loader2 } from 'lucide-react'
import type { ClientReportRef } from '@/app/actions/client'
import { getClientReportDownloadUrl } from '@/app/actions/client'
import { useToast } from '@/components/ui/toast'
import { formatDate } from './client-utils'

export function ClientReports({ reports }: { reports: ClientReportRef[] }) {
  const { toast } = useToast()
  const [downloading, setDownloading] = React.useState<string | null>(null)

  const handleDownload = async (report: ClientReportRef) => {
    setDownloading(report.id)
    const res = await getClientReportDownloadUrl(report.id)
    setDownloading(null)
    if ('error' in res) {
      toast({ title: 'Download unavailable', description: res.error, variant: 'danger' })
      return
    }
    window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Monthly Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Issued monthly client reports for your project. Draft reports are not shown.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No reports have been issued yet.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#0a2540]/5 text-[#0a2540]">
                  <FileBarChart className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground text-pretty">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.periodLabel} • Version {r.version}
                    {r.issuedAt ? ` • Issued ${formatDate(r.issuedAt)}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(r)}
                disabled={downloading === r.id || !r.storagePath}
                title={r.storagePath ? 'Download report' : 'Report file not available'}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#0a2540] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {downloading === r.id
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
