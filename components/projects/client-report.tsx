'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  FileText, Loader2, Plus, Download, CheckCircle2, ShieldCheck, History, Eye, Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  listClientReports,
  previewClientReport,
  generateClientReport,
  issueClientReport,
  getClientReportUrl,
  type ClientReport,
  type ClientReportSnapshot,
} from '@/app/actions/client-reports'

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

export function ClientReport({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const { data: reports, isLoading, mutate } = useSWR(
    ['client-reports', projectId],
    () => listClientReports(projectId),
  )
  const { data: previewRes } = useSWR(
    ['client-report-preview', projectId],
    () => previewClientReport(projectId),
  )

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<'generate' | 'issue' | null>(null)
  // Report language — defaults to English (PDF always renders in reportLocale)
  const [reportLocale, setReportLocale] = React.useState<'en' | 'ar'>('en')

  // The report currently shown: the selected version, else the newest, else live preview.
  const selected: ClientReport | null = React.useMemo(() => {
    if (!reports?.length) return null
    return reports.find((r) => r.id === selectedId) ?? reports[0]
  }, [reports, selectedId])

  const snapshot: ClientReportSnapshot | null =
    selected?.snapshot ?? (previewRes && 'snapshot' in previewRes ? previewRes.snapshot : null)
  const isIssued = selected?.status === 'issued'

  async function handleGenerate() {
    setBusy('generate')
    const res = await generateClientReport({ projectId })
    setBusy(null)
    if ('error' in res) {
      toast({ variant: 'danger', title: 'Could not generate', description: res.error })
      return
    }
    setSelectedId(res.report.id)
    await mutate()
    toast({ variant: 'success', title: 'Draft generated', description: `Version ${res.report.version} created as a draft.` })
  }

  /** Render the printable node to a PDF (base64) using the gate-pack pattern. */
  async function renderPdf(): Promise<string | null> {
    const el = document.getElementById('client-report-printable')
    if (!el) return null
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth - 20
    const imgHeight = (canvas.height / canvas.width) * imgWidth
    let remaining = imgHeight
    let yPos = 10
    while (remaining > 0) {
      const sliceHeight = Math.min(remaining, pageHeight - yPos - 10)
      const srcY = ((imgHeight - remaining) / imgHeight) * canvas.height
      const srcH = (sliceHeight / imgHeight) * canvas.height
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = srcH
      slice.getContext('2d')!.drawImage(canvas, 0, -srcY)
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', 10, yPos, imgWidth, sliceHeight)
      remaining -= sliceHeight
      if (remaining > 0) { pdf.addPage(); yPos = 10 }
    }
    return pdf.output('datauristring')
  }

  async function handleDownload() {
    const dataUri = await renderPdf()
    if (!dataUri) return
    const a = document.createElement('a')
    a.href = dataUri
    a.download = `${snapshot?.project.code ?? 'report'}-client-report-v${selected?.version ?? 'preview'}.pdf`
    a.click()
  }

  async function handleIssue() {
    if (!selected) return
    setBusy('issue')
    const dataUri = await renderPdf()
    if (!dataUri) {
      setBusy(null)
      toast({ variant: 'danger', title: 'Render failed', description: 'Could not render the report PDF.' })
      return
    }
    const res = await issueClientReport({ reportId: selected.id, projectId, pdfBase64: dataUri })
    setBusy(null)
    if ('error' in res) {
      toast({ variant: 'danger', title: 'Could not issue', description: res.error })
      return
    }
    await mutate()
    toast({ variant: 'success', title: 'Report issued', description: `Version ${res.report.version} is now the client-facing record of issue.` })
  }

  async function handleDownloadIssued(r: ClientReport) {
    if (!r.storagePath) return
    const res = await getClientReportUrl(r.storagePath)
    if ('error' in res) {
      toast({ variant: 'danger', title: 'Download failed', description: res.error })
      return
    }
    window.open(res.url, '_blank')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      {/* Header + actions */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Client Report</h1>
            <p className="text-sm text-muted-foreground">
              Client-safe progress summary. Internal financials are never included.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Language toggle — screen only, not in printable div */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-0.5" aria-label="Report language">
            <Globe className="ms-1.5 size-3.5 text-muted-foreground" aria-hidden="true" />
            {(['en', 'ar'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setReportLocale(loc)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  reportLocale === loc
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {loc.toUpperCase()}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!snapshot}>
            <Download className="mr-1.5 size-4" /> Download PDF
          </Button>
          {selected && !isIssued && (
            <Button size="sm" onClick={handleIssue} disabled={busy !== null}>
              {busy === 'issue' ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <ShieldCheck className="mr-1.5 size-4" />}
              Approve &amp; Issue
            </Button>
          )}
          <Button size="sm" variant={selected && !isIssued ? 'outline' : 'default'} onClick={handleGenerate} disabled={busy !== null}>
            {busy === 'generate' ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
            Generate {reports?.length ? 'new version' : 'report'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
        {/* Printable report */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          {/* DRAFT watermark — shown until issued */}
          {!isIssued && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
              <span className="select-none text-[120px] font-black uppercase tracking-widest text-red-500/10 -rotate-[30deg]">
                Draft
              </span>
            </div>
          )}

          {isLoading || !snapshot ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <div
              id="client-report-printable"
              dir={reportLocale === 'ar' ? 'rtl' : 'ltr'}
              lang={reportLocale}
              className="relative bg-white p-8 text-slate-900"
            >
              <PrintableReport
                snapshot={snapshot}
                periodLabel={selected?.periodLabel ?? new Date().toLocaleDateString(reportLocale === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
                version={selected?.version ?? null}
                status={selected?.status ?? 'draft'}
                issuedAt={selected?.issuedAt ?? null}
                locale={reportLocale}
              />
            </div>
          )}
        </div>

        {/* Version history */}
        <aside className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <History className="size-4" /> Version history
          </div>
          {isLoading ? (
            <div className="py-6 text-center text-muted-foreground"><Loader2 className="mx-auto size-4 animate-spin" /></div>
          ) : !reports?.length ? (
            <p className="text-xs text-muted-foreground">No versions yet. Generate a draft to begin.</p>
          ) : (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                      (selected?.id === r.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">v{r.version}</span>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                        r.status === 'issued' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                      )}>
                        {r.status === 'issued' ? <CheckCircle2 className="size-3" /> : <Eye className="size-3" />}
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.periodLabel}</p>
                    {r.status === 'issued' && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">Issued {fmtDate(r.issuedAt)}</p>
                    )}
                  </button>
                  {r.status === 'issued' && r.storagePath && (
                    <button
                      type="button"
                      onClick={() => handleDownloadIssued(r)}
                      className="mt-1 flex w-full items-center gap-1 px-3 text-[11px] text-primary hover:underline"
                    >
                      <Download className="size-3" /> Download issued PDF
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )

  function PrintableReport({
    snapshot, periodLabel, version, status, issuedAt, locale: rLocale = 'en',
  }: {
    snapshot: ClientReportSnapshot
    periodLabel: string
    version: number | null
    status: string
    issuedAt: string | null
    locale?: 'en' | 'ar'
  }) {
    const s = snapshot
    return (
      <div className="space-y-6">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900">GridMind Capital</p>
            <p className="text-xs text-slate-500">EPC Project Platform</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>{version ? `Version ${version}` : 'Live preview'}</p>
            <p className="uppercase">{status === 'issued' ? `Issued ${fmtDate(issuedAt)}` : 'Draft — not for release'}</p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900">{s.project.code} — Client Progress Report</h2>
          <p className="text-sm text-slate-500">{s.project.name} · {periodLabel}</p>
        </div>

        {/* Project facts */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Project Overview</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm md:grid-cols-3">
            <Fact k="Technology" v={s.project.technology} />
            <Fact k="Capacity" v={`${s.project.capacityMw} MW`} />
            <Fact k="Location" v={`${s.project.location}, ${s.project.country}`} />
            <Fact k="Target completion" v={fmtDate(s.project.targetCompletion)} />
            <Fact k="Current gate" v={s.progress.currentGate} />
            <Fact k="Overall progress" v={`${s.progress.percentComplete}%`} />
          </div>
        </section>

        {/* Narrative */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Executive Summary</h3>
          <p className="text-sm leading-relaxed text-slate-700">{s.narrative}</p>
        </section>

        {/* Gate progress */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Stage-Gate Progress</h3>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
                <tr><th className="px-3 py-2">Gate</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Reviewed</th></tr>
              </thead>
              <tbody>
                {s.gates.map((g) => (
                  <tr key={g.code} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{g.code}</td>
                    <td className="px-3 py-2 text-slate-600">{g.name}</td>
                    <td className="px-3 py-2 capitalize text-slate-600">{g.status.replace('_', ' ')}</td>
                    <td className="px-3 py-2 text-slate-500">{fmtDate(g.reviewedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Contractual milestones (dates + amounts — client entitled) */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Contractual Payment Milestones</h3>
          {s.milestones.length === 0 ? (
            <p className="text-sm text-slate-500">No payment milestones recorded.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
                  <tr><th className="px-3 py-2">Milestone</th><th className="px-3 py-2">Planned date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {s.milestones.map((m, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-900">{m.title}</td>
                      <td className="px-3 py-2 text-slate-600">{fmtDate(m.plannedDate)}</td>
                      <td className="px-3 py-2 capitalize text-slate-600">{m.status}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">{fmtUsd(m.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Variations + quality headline */}
        <section className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Variation Orders</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Total" value={String(s.variations.total)} />
              <Stat label="Approved" value={String(s.variations.approved)} />
              <Stat label="Pending" value={String(s.variations.pending)} />
            </div>
            <p className="mt-3 text-center text-sm text-slate-600">
              Approved value <span className="font-semibold text-slate-900">{fmtUsd(s.variations.approvedValue)}</span>
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Quality</h3>
            <div className="flex h-full flex-col items-center justify-center">
              <p className="text-3xl font-bold text-slate-900">{s.quality.openNcrs}</p>
              <p className="text-sm text-slate-500">Open non-conformances</p>
            </div>
          </div>
        </section>

        <p className="border-t border-slate-200 pt-4 text-[10px] text-slate-400">
          This report contains client-facing progress information only. Internal cost, budget and
          margin data are excluded by policy. © GridMind Capital.
        </p>
      </div>
    )
  }
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{k}</p>
      <p className="font-medium text-slate-900">{v}</p>
    </div>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
