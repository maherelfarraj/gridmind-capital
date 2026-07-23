'use client'

import * as React from 'react'
import useSWR from 'swr'
import { FileQuestion, Upload, Loader2, Download, CheckCircle2, Calendar } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  getPortalRfqs,
  submitRfqResponse,
  getPortalFileUrl,
  type PortalRfq,
} from '@/app/actions/portal'
import { uploadPortalFile, fmtMoney, fmtDate, StatusPill, RFQ_STATUS_STYLES } from './portal-utils'

export function PortalRfqs() {
  const { toast: addToast } = useToast()
  const { data: rfqs, mutate } = useSWR('portal-rfqs', getPortalRfqs)

  async function handleDownload(storagePath: string) {
    const res = await getPortalFileUrl(storagePath)
    if ('error' in res) addToast({ title: 'Could not open file', description: res.error, variant: 'danger' })
    else window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Requests for Quotation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review open RFQs and submit your commercial response with supporting documents.
        </p>
      </div>

      {!rfqs ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : rfqs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <FileQuestion className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">No RFQs assigned to your organization yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rfqs.map((rfq) => (
            <RfqCard key={rfq.id} rfq={rfq} onSubmitted={mutate} onDownload={handleDownload} />
          ))}
        </div>
      )}
    </div>
  )
}

function RfqCard({
  rfq,
  onSubmitted,
  onDownload,
}: {
  rfq: PortalRfq
  onSubmitted: () => void
  onDownload: (path: string) => void
}) {
  const { toast: addToast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [price, setPrice] = React.useState('')
  const [validityDays, setValidityDays] = React.useState('30')
  const [notes, setNotes] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const p = Number(price)
    if (!p || p <= 0) { addToast({ title: 'Enter a valid price', variant: 'warning' }); return }

    setSubmitting(true)
    let attachmentPath: string | undefined
    if (file) {
      const up = await uploadPortalFile('rfqs', file)
      if ('error' in up) {
        setSubmitting(false)
        addToast({ title: 'Upload failed', description: up.error, variant: 'danger' })
        return
      }
      attachmentPath = up.storagePath
    }

    const { error } = await submitRfqResponse({
      rfqId: rfq.id,
      price: p,
      validityDays: Number(validityDays) || 30,
      notes: notes || undefined,
      attachmentPath,
    })
    setSubmitting(false)
    if (error) {
      addToast({ title: 'Response failed', description: error, variant: 'danger' })
    } else {
      addToast({ title: 'Response submitted', description: 'Your quotation has been sent for review.', variant: 'success' })
      setOpen(false); setPrice(''); setValidityDays('30'); setNotes(''); setFile(null)
      onSubmitted()
    }
  }

  const canRespond = rfq.status === 'open'

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{rfq.rfq_number}</p>
            <StatusPill status={rfq.status} styles={RFQ_STATUS_STYLES} />
            {rfq.responded && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-3.5" aria-hidden /> Responded
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-foreground">{rfq.title}</p>
          {rfq.scope_summary && (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{rfq.scope_summary}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Project {rfq.project_code}</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3.5" aria-hidden /> Closes {fmtDate(rfq.close_date)}
            </span>
          </div>
        </div>

        {canRespond && !rfq.responded && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {open ? 'Cancel' : 'Submit response'}
          </button>
        )}
      </div>

      {/* Submitted response summary */}
      {rfq.response && (
        <div className="border-t border-border bg-muted/40 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Your quote</span>
              <p className="font-semibold tabular-nums text-foreground">
                {fmtMoney(rfq.response.price, rfq.response.currency)}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Validity</span>
              <p className="font-medium text-foreground">{rfq.response.validity_days} days</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Status</span>
              <p className="font-medium capitalize text-foreground">{rfq.response.status}</p>
            </div>
            {rfq.response.attachment_path && (
              <button
                onClick={() => onDownload(rfq.response!.attachment_path!)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Download className="size-3.5" aria-hidden /> Attachment
              </button>
            )}
          </div>
          {rfq.response.notes && (
            <p className="mt-2 text-xs text-muted-foreground">{rfq.response.notes}</p>
          )}
        </div>
      )}

      {/* Response form */}
      {open && canRespond && !rfq.responded && (
        <form onSubmit={handleSubmit} className="space-y-4 border-t border-border px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Quoted price (USD)</label>
              <input
                type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Validity (days)</label>
              <input
                type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Notes / clarifications (optional)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Quotation document (optional)</label>
            <input
              type="file" accept="application/pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
            />
          </div>

          <button
            type="submit" disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            Submit quotation
          </button>
        </form>
      )}
    </div>
  )
}
