'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { FileText, Loader2, Users, Wrench, Camera, ChevronRight, TrendingUp } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useFieldProject } from '@/components/field/field-context'
import { getDailyReports, type DailyReportSummary } from '@/app/actions/field'

const STATUS_META: Record<string, { labelKey: 'statusDraft' | 'statusSubmitted'; cls: string }> = {
  draft:     { labelKey: 'statusDraft',     cls: 'bg-muted text-muted-foreground' },
  submitted: { labelKey: 'statusSubmitted', cls: 'bg-emerald-500/15 text-emerald-600' },
}

function fmtDate(d: string, locale: string): string {
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function ReportsPage() {
  const { activeProjectId } = useFieldProject()
  const t = useTranslations('field.reports')
  const tDr = useTranslations('field.dailyReport')
  const locale = useLocale()
  const { data, isLoading } = useSWR(
    activeProjectId ? `field-reports-${activeProjectId}` : null,
    () => getDailyReports(activeProjectId as string),
  )

  const reports = data ?? []

  return (
    <div className="py-4">
      <h1 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <FileText className="size-5 text-primary" aria-hidden="true" />
        {t('title')}
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <FileText className="size-8 text-muted-foreground/50 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{t('noReports')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('noReportsDetail')}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              projectId={activeProjectId as string}
              locale={locale}
              tDr={tDr}
              tReports={t}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReportRow({
  report,
  projectId,
  locale,
  tDr,
  tReports,
}: {
  report: DailyReportSummary
  projectId: string
  locale: string
  tDr: ReturnType<typeof useTranslations>
  tReports: ReturnType<typeof useTranslations>
}) {
  const meta = STATUS_META[report.status] ?? STATUS_META.draft
  const submitted = report.status === 'submitted'

  return (
    <li className="rounded-xl border border-border bg-card overflow-hidden">
      <Link href="/field" className="flex items-center gap-3 p-3.5 active:bg-muted/40">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Date is always LTR regardless of locale */}
            <p className="text-sm font-semibold text-foreground" dir="ltr">
              {fmtDate(report.report_date, locale)}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
              {tDr(meta.labelKey)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground" dir="ltr">
            <span className="flex items-center gap-1">
              <Users className="size-3" aria-hidden="true" />
              {report.workforce_count ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <Wrench className="size-3" aria-hidden="true" />
              {report.equipment_count ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <Camera className="size-3" aria-hidden="true" />
              {report.photo_count}
            </span>
            {report.weather && (
              <span className="capitalize">{report.weather}</span>
            )}
          </div>
        </div>
        {/* Mirror chevron for RTL */}
        <ChevronRight className="size-4 text-muted-foreground shrink-0 rtl:rotate-180" aria-hidden="true" />
      </Link>
      {submitted && (
        <Link
          href="/field/schedule"
          className="flex items-center justify-center gap-1.5 border-t border-border bg-primary/5 py-2 text-xs font-semibold text-primary active:bg-primary/10"
        >
          <TrendingUp className="size-3.5" aria-hidden="true" />
          {tReports('updateSchedule')}
        </Link>
      )}
    </li>
  )
}
