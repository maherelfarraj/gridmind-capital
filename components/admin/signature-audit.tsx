'use client'

import * as React from 'react'
import useSWR from 'swr'
import { getSignatureAudit, type SignatureAuditRow } from '@/app/actions/signatures'
import { PenLine, Search, ShieldCheck } from 'lucide-react'

const ENTITY_FILTERS = [
  { value: 'all', label: 'All types' },
  { value: 'gate_approval', label: 'Gate approvals' },
  { value: 'certificate', label: 'Certificates' },
  { value: 'vo_approval', label: 'Variation orders' },
  { value: 'client_report', label: 'Client reports' },
]

export function SignatureAudit() {
  const { data: rows = [], isLoading } = useSWR('signature-audit', () => getSignatureAudit())
  const [query, setQuery] = React.useState('')
  const [entity, setEntity] = React.useState('all')

  const filtered = rows.filter((r) => {
    if (entity !== 'all' && r.entityType !== entity) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      r.signerName.toLowerCase().includes(q) ||
      r.projectName.toLowerCase().includes(q) ||
      r.projectCode.toLowerCase().includes(q) ||
      r.entityLabel.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Signature Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every electronic signature captured across the tenant — who signed what, when, and from which IP address.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search signer, project, or type…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
            aria-label="Search signatures"
          />
        </div>
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          aria-label="Filter by signature type"
        >
          {ENTITY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading signatures…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <PenLine className="size-8 text-muted-foreground/50" aria-hidden />
          <p className="text-sm text-muted-foreground">No signatures recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Signer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Signed at</th>
                <th className="px-4 py-3 font-medium">IP address</th>
                <th className="px-4 py-3 font-medium">Signature</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: SignatureAuditRow) => (
                <tr key={r.id} className="border-b border-border last:border-0 align-middle">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{r.signerName}</p>
                    {r.signerRole && <p className="text-xs text-muted-foreground">{r.signerRole}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {r.entityLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{r.projectName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{r.projectCode}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {new Date(r.signedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.ipAddress ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="flex h-9 w-28 items-center justify-center rounded bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.signatureImageUrl || '/placeholder.svg'}
                        alt={`Signature of ${r.signerName}`}
                        className="h-8 object-contain"
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
