'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { FileText, Loader2, Users, Wrench, Camera, ChevronRight, TrendingUp } from 'lucide-react'
import { useFieldProject } from '@/components/field/field-context'
import { getDailyReports, type DailyReportSummary } from '@/app/actions/field'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-muted text-muted-foreground' },
  submitted: { label: 'Submitted', cls: 'bg-emerald-500/15 text-emerald-600' },
}

function fmtDate(d: string): string {
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function ReportsPage() {
  const { activeProjectId } = useFieldProject()
  const { data, isLoading } = useSWR(
    activeProjectId ? `field-reports-${activeProjectId}` : null,
    () => getDailyReports(activeProjectId as string),
  )

  const reports = data ?? []

  return (
    <div className="px-4 py-4">
      <h1 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <FileText className="size-5 text-primary" /> Daily Reports
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <FileText className="size-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No reports yet</p>
          <p className="text-xs text-muted-foreground mt-1">Complete today&apos;s report from the Today tab.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {reports.map((r) => <ReportRow key={r.id} report={r} />)}
        </ul>
      )}
    </div>
  )
}

function ReportRow({ report }: { report: DailyReportSummary }) {
  const st = STATUS_META[report.status] ?? STATUS_META.draft
  return (
    <li>
      <Link href="/field" className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 active:bg-muted/40">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{fmtDate(report.report_date)}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="size-3" /> {report.workforce_count ?? 0}</span>
            <span className="flex items-center gap-1"><Wrench className="size-3" /> {report.equipment_count ?? 0}</span>
            <span className="flex items-center gap-1"><Camera className="size-3" /> {report.photo_count}</span>
            {report.weather && <span className="capitalize">{report.weather}</span>}
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
      </Link>
    </li>
  )
}
