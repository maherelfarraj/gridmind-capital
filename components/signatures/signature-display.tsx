'use client'

import * as React from 'react'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SignatureRecord } from '@/app/actions/signatures'

function formatSignedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Renders a completed electronic signature: the signature image, signer name,
 * role and timestamp. Used on approval records, certificates, the Gate Pack
 * export and the admin audit trail. Plain <img> (not next/image) so it is
 * captured correctly by html2canvas during PDF export.
 */
export function SignatureDisplay({
  signature,
  className,
  compact = false,
}: {
  signature: SignatureRecord
  className?: string
  compact?: boolean
}) {
  return (
    <figure
      className={cn(
        'rounded-lg border border-border bg-card p-3',
        className,
      )}
    >
      <div className="flex items-center justify-center rounded-md bg-white p-2">
        {signature.signatureImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signature.signatureImageUrl || '/placeholder.svg'}
            alt={`Signature of ${signature.signerName}`}
            crossOrigin="anonymous"
            className={cn('object-contain', compact ? 'h-12' : 'h-16')}
          />
        ) : (
          <span className="text-xs text-muted-foreground">Signature image unavailable</span>
        )}
      </div>
      <figcaption className="mt-2 space-y-0.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-3.5 text-green-600" aria-hidden="true" />
          {signature.signerName}
        </p>
        {signature.signerRole && (
          <p className="text-xs text-muted-foreground">{signature.signerRole}</p>
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          Signed {formatSignedAt(signature.signedAt)}
        </p>
        {signature.ipAddress && (
          <p className="text-[11px] text-muted-foreground/70 font-mono">IP {signature.ipAddress}</p>
        )}
      </figcaption>
    </figure>
  )
}
