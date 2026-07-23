'use client'

import { createPortalUploadUrl } from '@/app/actions/portal'

/** Upload a file to the portal bucket via a signed URL. Returns the storage path. */
export async function uploadPortalFile(
  kind: 'invoices' | 'deliveries' | 'rfqs',
  file: File,
): Promise<{ storagePath: string } | { error: string }> {
  const signed = await createPortalUploadUrl(kind, file.name)
  if ('error' in signed) return { error: signed.error }

  const res = await fetch(signed.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  })
  if (!res.ok) return { error: 'File upload failed. Please try again.' }
  return { storagePath: signed.storagePath }
}

export const fmtMoney = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

export const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

export const PO_STATUS_STYLES: Record<string, string> = {
  issued: 'bg-amber-100 text-amber-800 border-amber-200',
  acknowledged: 'bg-blue-100 text-blue-800 border-blue-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  closed: 'bg-slate-100 text-slate-700 border-slate-200',
}

export const INVOICE_STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  under_review: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  paid: 'bg-emerald-600 text-white border-emerald-700',
}

export const RFQ_STATUS_STYLES: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  closed: 'bg-slate-100 text-slate-700 border-slate-200',
  awarded: 'bg-blue-100 text-blue-800 border-blue-200',
}

export function StatusPill({ status, styles }: { status: string; styles: Record<string, string> }) {
  const cls = styles[status] ?? 'bg-slate-100 text-slate-700 border-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
