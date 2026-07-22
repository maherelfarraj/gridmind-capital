'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, CheckCircle2, Upload, Loader2, FileCheck, Download } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  acknowledgePurchaseOrder,
  submitDeliveryDocument,
  getPortalFileUrl,
  type PortalPO,
  type PortalPOLine,
  type PortalDeliveryDoc,
} from '@/app/actions/portal'
import { uploadPortalFile, fmtMoney, fmtDate, StatusPill, PO_STATUS_STYLES } from './portal-utils'

export function PortalPoDetail({
  po,
  lines,
  deliveryDocs,
}: {
  po: PortalPO
  lines: PortalPOLine[]
  deliveryDocs: PortalDeliveryDoc[]
}) {
  const router = useRouter()
  const { toast: addToast } = useToast()
  const [acking, setAcking] = React.useState(false)

  // Delivery upload state
  const [docType, setDocType] = React.useState<'delivery_note' | 'packing_list'>('delivery_note')
  const [file, setFile] = React.useState<File | null>(null)
  const [notes, setNotes] = React.useState('')
  const [uploading, setUploading] = React.useState(false)

  async function handleAcknowledge() {
    setAcking(true)
    const { error } = await acknowledgePurchaseOrder(po.id)
    setAcking(false)
    if (error) {
      addToast({ title: 'Could not acknowledge', description: error, variant: 'danger' })
    } else {
      addToast({ title: `PO ${po.po_number} acknowledged`, variant: 'success' })
      router.refresh()
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      addToast({ title: 'Choose a file first', variant: 'warning' })
      return
    }
    setUploading(true)
    const up = await uploadPortalFile('deliveries', file)
    if ('error' in up) {
      setUploading(false)
      addToast({ title: 'Upload failed', description: up.error, variant: 'danger' })
      return
    }
    const { error } = await submitDeliveryDocument({
      poId: po.id,
      docType,
      fileName: file.name,
      storagePath: up.storagePath,
      notes: notes || undefined,
    })
    setUploading(false)
    if (error) {
      addToast({ title: 'Could not save document', description: error, variant: 'danger' })
    } else {
      addToast({ title: 'Delivery document uploaded', variant: 'success' })
      setFile(null)
      setNotes('')
      router.refresh()
    }
  }

  async function handleDownload(storagePath: string) {
    const res = await getPortalFileUrl(storagePath)
    if ('error' in res) {
      addToast({ title: 'Could not open file', description: res.error, variant: 'danger' })
    } else {
      window.open(res.url, '_blank', 'noopener,noreferrer')
    }
  }

  const linesTotal = lines.reduce((s, l) => s + l.amount, 0)

  return (
    <div className="space-y-6">
      <Link href="/portal/pos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Back to purchase orders
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{po.po_number}</h1>
              <StatusPill status={po.status} styles={PO_STATUS_STYLES} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {po.project_code} — {po.project_name}
            </p>
            {po.description && <p className="mt-3 max-w-2xl text-sm text-foreground">{po.description}</p>}
          </div>
          {po.status === 'issued' && (
            <button
              onClick={handleAcknowledge}
              disabled={acking}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {acking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
              Acknowledge PO
            </button>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Amount</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{fmtMoney(po.amount, po.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Issued</dt>
            <dd className="mt-1 text-sm text-foreground">{fmtDate(po.issue_date)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Delivery due</dt>
            <dd className="mt-1 text-sm text-foreground">{fmtDate(po.delivery_date)}</dd>
          </div>
          {po.acknowledged_at && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Acknowledged</dt>
              <dd className="mt-1 text-sm text-foreground">{fmtDate(po.acknowledged_at)}</dd>
            </div>
          )}
        </dl>

        {po.delivery_address && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivery address</p>
              <p className="mt-0.5 text-sm text-foreground">{po.delivery_address}</p>
            </div>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground">Line Items</h2>
        </div>
        {lines.length === 0 ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">No line items recorded for this purchase order.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3 font-medium">#</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium text-right">Qty</th>
                  <th className="px-6 py-3 font-medium">Unit</th>
                  <th className="px-6 py-3 font-medium text-right">Unit Price</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-3 text-muted-foreground">{l.line_no}</td>
                    <td className="px-6 py-3 text-foreground">{l.description}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-foreground">{l.quantity}</td>
                    <td className="px-6 py-3 text-muted-foreground">{l.unit}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-foreground">{fmtMoney(l.unit_price, po.currency)}</td>
                    <td className="px-6 py-3 text-right font-medium tabular-nums text-foreground">{fmtMoney(l.amount, po.currency)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-6 py-3" colSpan={5}>Total</td>
                  <td className="px-6 py-3 text-right tabular-nums text-foreground">{fmtMoney(linesTotal || po.amount, po.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delivery documents */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground">Delivery Documents</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Upload delivery notes and packing lists against this PO.</p>
        </div>

        {/* Existing docs */}
        {deliveryDocs.length > 0 && (
          <ul className="divide-y divide-border">
            {deliveryDocs.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <FileCheck className="size-4 text-emerald-600" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.file_name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{d.doc_type.replace('_', ' ')} · {fmtDate(d.created_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(d.storage_path)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Download className="size-3.5" aria-hidden />
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Upload form */}
        <form onSubmit={handleUpload} className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Document type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as 'delivery_note' | 'packing_list')}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="delivery_note">Delivery note</option>
                <option value="packing_list">Packing list</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">File (PDF or image)</label>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Partial delivery, 3 of 5 crates"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            Upload document
          </button>
        </form>
      </div>
    </div>
  )
}
