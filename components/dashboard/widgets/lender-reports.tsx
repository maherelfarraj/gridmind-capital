'use client'
import useSWR from 'swr'
import Link from 'next/link'
import { Landmark, ArrowUpRight } from 'lucide-react'
import type { WidgetConfig } from './types'
import { listRecentLenderReports } from '@/app/actions/lender'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function LenderReportsWidget({ config: _config }: { config: WidgetConfig }) {
  const { data, isLoading } = useSWR('widget-lender-reports', () => listRecentLenderReports(3))
  const reports = data ?? []

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Landmark className="size-3.5" />
        <span>Lender Reports</span>
      </div>

      <div className="flex flex-col gap-1.5 flex-1 overflow-auto">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted/20 animate-pulse" />
        ))}

        {!isLoading && reports.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground">
            No lender reports generated yet
          </div>
        )}

        {reports.map((r) => (
          <Link
            key={r.id}
            href={`/projects/${r.project_id}/lender-report?archive=${r.id}`}
            className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted/30 transition-colors"
          >
            <div className="p-1.5 rounded-md flex-shrink-0 bg-primary/10">
              <Landmark className="size-3 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{r.project_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground truncate">{r.title}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
              <span>{formatDate(r.period_end ?? r.created_at)}</span>
              <ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
