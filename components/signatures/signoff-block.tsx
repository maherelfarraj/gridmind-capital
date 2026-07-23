'use client'

import * as React from 'react'
import useSWR from 'swr'
import { getProjectSignatureAudit, type SignatureRecord } from '@/app/actions/signatures'

const ENTITY_LABEL: Record<SignatureRecord['entityType'], string> = {
  gate_approval: 'Gate Approval',
  vo_approval: 'Variation Order',
  client_report: 'Client Report',
  certificate: 'Gate Certificate',
}

/**
 * Authorized-signatories block for inclusion in a printable Gate Pack. Fetches
 * the project's captured signatures and renders each signature image with
 * crossOrigin="anonymous" so html2canvas (useCORS) can rasterise it into the
 * exported PDF. Renders nothing when there are no signatures.
 */
export function GatePackSignoffBlock({
  projectId,
  gateCode,
}: {
  projectId: string | null | undefined
  gateCode?: string
}) {
  const { data: signatures = [] } = useSWR(
    projectId ? `project-signatures-${projectId}` : null,
    () => getProjectSignatureAudit(projectId as string),
  )

  if (!projectId || signatures.length === 0) return null

  return (
    <section className="mt-6 rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground">Authorized Signatories</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Electronic sign-offs recorded for this project{gateCode ? ` (${gateCode} pack)` : ''}.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {signatures.map((sig) => (
          <div key={sig.id} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <span className="flex h-14 w-28 items-center justify-center rounded-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sig.signatureImageUrl || '/placeholder.svg'}
                alt={`Signature of ${sig.signerName}`}
                crossOrigin="anonymous"
                className="h-12 object-contain"
              />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{sig.signerName}</p>
              {sig.signerRole && <p className="text-xs text-muted-foreground">{sig.signerRole}</p>}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {ENTITY_LABEL[sig.entityType]} ·{' '}
                {new Date(sig.signedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
