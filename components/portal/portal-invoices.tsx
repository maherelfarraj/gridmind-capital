'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Receipt, Upload, Loader2, FileText, Download } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import {
  getPortalInvoices,
  getPortalPoOptions,
  submitPortalInvoice,
  getPortalFileUrl,
} from '@/app/actions/portal'
import { uploadPortalFile, fmtMoney, fmtDate, StatusPill, INVOICE_STATUS_STYLES } from './portal-utils'

export function PortalInvoices() {
  const { toast: addToast } = useToast()
  const { data: invoices, mutate } = useSWR('portal-invoices', getPortalInvoices)
  const { data: poOptions } = useSWR('portal-po-options', getPortalPoOptions)

  // Form state
  const [poId, setPoId] = React.useState('')
  const [invoiceRef, setInvoiceRef] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [invoiceDate, setInvoiceDate] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  // Realtime: reflect internal status changes (submitted → under_review → paid).
  React.useEffect(() => {
    const supabase = createClient()
    let cleanup: (() => void) | undefined
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const channel = supabase
        .channel('portal-invoices-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'portal_invoices', filter: `submitted_by=eq.${user.id}` },
          () => mutate(),
        )
        .subscribe()
      cleanup = () => { supabase.removeChannel(channel) }
    })
    return () => cleanup?.()
  }, [mutate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!poId) { addToast({ title: 'Select a purchase order', variant: 'warning' }); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { addToast({ title: 'Enter a valid amount', variant: 'warning' }); return }

    setSubmitting(true)
    let pdfPath: string | undefined
    if (file) {
      const up = await uploadPortalFile('invoices', file)
      if ('error' in up) {
        setSubmitting(false)
        addToast({ title: 'PDF upload failed', description: up.error, variant: 'danger' })
        return
      }
      pdfPath = up.storagePath
    }

    const { error } = await submitPortalInvoice({
      poId,
      invoiceRef,
      amount: amt,
      invoiceDate,
      notes: notes || undefined,
      pdfPath,
    })
    setSubmitting(false)
    if (error) {
      addToast({ title: 'Submission failed', description: error, variant: 'danger' })
    } else {
      addToast({ title: 'Invoice submitted', description: 'Your invoice is now under review.', variant: 'success' })
      setPoId(''); setInvoiceRef(''); setAmount(''); setInvoiceDate(''); setNotes(''); setFile(null)
      mutate()
    }
  }

  async function handleDownload(storagePath: string) {
    const res = await getPortalFileUrl(storagePath)
    if ('error' in res) addToast({ title: 'Could not open PDF', description: res.error, variant: 'danger' })
    else window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit invoices against your purchase orders and track their status in real time.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Submission form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4 rounded-xl border border-border bg-card p-6 h-fit">
          <h2 className="font-semibold text-foreground">Submit an invoice</h2>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Purchase order</label>
            <select
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select a PO…</option>
              {(poOptions ?? []).map((po) => (
                <option key={po.id} value={po.id}>{po.po_number} — {po.project_code}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Invoice number</label>
            <input
              type="text" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)}
              placeholder="INV-2026-001"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Amount (USD)</label>
              <input
                type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Invoice date</label>
              <input
                type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Invoice PDF</label>
            <input
              type="file" accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Notes (optional)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <button
            type="submit" disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            Submit invoice
          </button>
        </form>

        {/* Status list */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-semibold text-foreground">Submitted invoices</h2>
            </div>
            {!invoices ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden /></div>
            ) : invoices.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Receipt className="mx-auto size-8 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-sm text-muted-foreground">No invoices submitted yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 px-6 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{inv.invoice_ref}</p>
                        <StatusPill status={inv.status} styles={INVOICE_STATUS_STYLES} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {inv.po_number ? `PO ${inv.po_number} · ` : ''}{fmtDate(inv.invoice_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold tabular-nums text-foreground">{fmtMoney(inv.amount, inv.currency)}</span>
                      {inv.pdf_path && (
                        <button
                          onClick={() => handleDownload(inv.pdf_path!)}
                          aria-label={`Download ${inv.invoice_ref}`}
                          className="inline-flex text-muted-foreground hover:text-foreground"
                        >
                          <Download className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="size-3.5" aria-hidden />
            Status updates from GridMind Capital appear here automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
