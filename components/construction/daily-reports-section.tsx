'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import Image from 'next/image'
import {
  FileText, Loader2, Users, Wrench, Camera, X, CloudSun, CalendarDays,
  TrendingUp, AlertTriangle, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { getProjects } from '@/app/actions/projects'
import { getDailyReports, getDailyReport, type DailyReportSummary, type DailyReportDetail } from '@/app/actions/field'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-muted text-muted-foreground' },
  submitted: { label: 'Submitted', cls: 'bg-[#22c55e]/15 text-[#22c55e]' },
}

function fmtDate(d: string): string {
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function DailyReportsSection() {
  const [projectId, setProjectId] = React.useState<string>('')

  const { data: projects } = useSWR('projects-for-daily-reports', () => getProjects())

  // Default to the first project once the list loads.
  React.useEffect(() => {
    if (!projectId && projects && projects.length > 0) setProjectId(projects[0].id)
  }, [projects, projectId])

  const { data: reports, isLoading } = useSWR(
    projectId ? `daily-reports-${projectId}` : null,
    () => getDailyReports(projectId),
  )

  const [openDate, setOpenDate] = React.useState<string | null>(null)

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header + project picker */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[#64ffda]" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">Daily Reports</h2>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Project
            <select
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); setOpenDate(null) }}
              className="h-8 rounded-lg border border-border bg-muted/30 px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40"
            >
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.code ? `${p.code} — ${p.name}` : p.name}</option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (reports?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14">
            <FileText className="size-10 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-foreground">No daily reports</p>
            <p className="text-xs text-muted-foreground">Site reports filed from field mode will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" role="table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {['Date', 'Weather', 'Workforce', 'Work Summary', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports!.map((r) => (
                  <ReportRow key={r.id} report={r} onOpen={() => setOpenDate(r.report_date)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {openDate && projectId && (
        <ReportDrawer projectId={projectId} date={openDate} onClose={() => setOpenDate(null)} />
      )}
    </Card>
  )
}

function ReportRow({ report, onOpen }: { report: DailyReportSummary; onOpen: () => void }) {
  const st = STATUS_META[report.status] ?? STATUS_META.draft
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-border transition-colors hover:bg-muted/20"
    >
      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{fmtDate(report.report_date)}</td>
      <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{report.weather ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Users className="size-3" /> {report.workforce_count ?? 0}</span>
      </td>
      <td className="max-w-[240px] truncate px-4 py-3 text-xs text-muted-foreground">{report.work_summary?.trim() || '—'}</td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', st.cls)}>{st.label}</span>
      </td>
      <td className="px-4 py-3 text-right">
        {report.photo_count > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Camera className="size-3" /> {report.photo_count}</span>
        )}
      </td>
    </tr>
  )
}

function ReportDrawer({ projectId, date, onClose }: { projectId: string; date: string; onClose: () => void }) {
  const { data, isLoading } = useSWR(`daily-report-${projectId}-${date}`, () => getDailyReport(projectId, date))

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-[#64ffda]" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground">{fmtDate(date)}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>
        ) : !data ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">Report not found.</div>
        ) : (
          <DrawerBody projectId={projectId} data={data} />
        )}
      </div>
    </div>
  )
}

function DrawerBody({ projectId, data }: { projectId: string; data: DailyReportDetail }) {
  const st = STATUS_META[data.status] ?? STATUS_META.draft
  return (
    <div className="space-y-5 px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', st.cls)}>{st.label}</span>
        {data.weather && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CloudSun className="size-3.5" /> {data.weather}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric icon={<Users className="size-4 text-[#64ffda]" />} label="Workforce" value={String(data.workforce_count ?? 0)} />
        <Metric icon={<Wrench className="size-4 text-[#64ffda]" />} label="Equipment" value={String(data.equipment_count ?? 0)} />
      </div>

      {data.work_performed && <Field label="Work performed" value={data.work_performed} />}
      {data.delays && <Field label="Delays" value={data.delays} icon={<AlertTriangle className="size-3.5 text-[#f59e0b]" />} />}
      {data.safety_notes && <Field label="Safety notes" value={data.safety_notes} icon={<ShieldCheck className="size-3.5 text-[#22c55e]" />} />}
      {data.visitors && <Field label="Visitors" value={data.visitors} />}

      {/* Photos */}
      {data.photos.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Photos ({data.photos.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {data.photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                <Image
                  src={p.url || '/placeholder.svg'}
                  alt={p.caption ?? 'Field photo'}
                  fill
                  sizes="120px"
                  className="object-cover transition-transform group-hover:scale-105"
                  crossOrigin="anonymous"
                  unoptimized
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Item 2 — progress shortcut (submitted reports feed the schedule) */}
      {data.status === 'submitted' && (
        <Link
          href={`/projects/${projectId}/schedule`}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#64ffda] px-4 py-2.5 text-sm font-semibold text-[#0a192f] transition-colors hover:bg-[#4fd8b8]"
        >
          <TrendingUp className="size-4" /> Update schedule progress
        </Link>
      )}
    </div>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  )
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{icon}{label}</p>
      <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  )
}
