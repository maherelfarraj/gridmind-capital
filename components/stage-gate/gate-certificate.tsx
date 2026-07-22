'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Award, Download, Loader2, PenLine, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { SignaturePad } from '@/components/signatures/signature-pad'
import { getSignaturesForEntity, type SignatureRecord } from '@/app/actions/signatures'
import {
  issueGateCertificate,
  attachCertificatePdf,
  listGateCertificates,
  type CertificateDeliverable,
  type GateCertificate,
} from '@/app/actions/gate-certificates'
import { elementToPdf } from '@/lib/pdf/element-to-pdf'
import { useLocale } from 'next-intl'

interface GateCertificatePanelProps {
  projectId: string
  projectName: string
  gateCode: string
  gateName?: string
  deliverables: CertificateDeliverable[]
}

export function GateCertificatePanel({
  projectId, projectName, gateCode, gateName, deliverables,
}: GateCertificatePanelProps) {
  const { toast } = useToast()
  const locale = useLocale()
  const printRef = React.useRef<HTMLDivElement | null>(null)

  const { data: certificates = [], mutate } = useSWR(
    `gate-certs-${projectId}`,
    () => listGateCertificates(projectId),
  )

  const [step, setStep] = React.useState<'idle' | 'signing' | 'preview'>('idle')
  const [cert, setCert] = React.useState<GateCertificate | null>(null)
  const [signature, setSignature] = React.useState<SignatureRecord | null>(null)
  const [busy, setBusy] = React.useState(false)

  // Begin: create the certificate row, then capture the signature against it.
  async function handleBegin() {
    setBusy(true)
    const res = await issueGateCertificate({ projectId, gateCode, gateName, deliverables })
    setBusy(false)
    if ('error' in res) {
      toast({ title: 'Could not issue certificate', description: res.error, variant: 'danger' })
      return
    }
    setCert(res.certificate)
    setStep('signing')
  }

  // After signing, render the printable, export the PDF and attach it.
  async function finalize(sig: SignatureRecord) {
    setSignature(sig)
    setStep('preview')
    // Wait a tick for the printable (with the signature image) to render.
    await new Promise((r) => setTimeout(r, 300))
    if (!printRef.current || !cert) return
    setBusy(true)
    try {
      const pdf = await elementToPdf(printRef.current, {
        headerTitle: `Gate Completion Certificate — ${gateCode}`,
        headerSubtitle: `${projectName} · Verification ${cert.verificationId}`,
        locale,
      })
      const dataUrl = pdf.output('datauristring')
      const res = await attachCertificatePdf({ certificateId: cert.id, projectId, dataUrl })
      if ('error' in res) {
        toast({ title: 'Certificate issued, PDF upload failed', description: res.error, variant: 'warning' })
      } else {
        pdf.save(`certificate-${cert.verificationId}.pdf`)
        toast({ title: 'Certificate issued & signed', description: cert.verificationId, variant: 'success' })
      }
      await mutate()
    } catch (e) {
      toast({ title: 'Export failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setStep('idle'); setCert(null); setSignature(null)
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Award className="size-5 text-amber-600" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Gate Completion Certificate</h2>
            <p className="text-xs text-muted-foreground">{gateCode}{gateName ? ` · ${gateName}` : ''}</p>
          </div>
        </div>
        {step === 'idle' && (
          <Button size="sm" onClick={handleBegin} disabled={busy}>
            {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <PenLine className="size-4 mr-1.5" />}
            Sign &amp; Issue
          </Button>
        )}
      </div>

      {/* Signing step */}
      {step === 'signing' && cert && (
        <SignaturePad
          entityType="certificate"
          entityId={cert.id}
          projectId={projectId}
          statement={`I certify that gate ${gateCode}${gateName ? ` (${gateName})` : ''} for ${projectName} is complete and all listed deliverables have been satisfied. Certificate ${cert.verificationId}.`}
          submitLabel="Sign & generate certificate"
          onSigned={finalize}
          onCancel={reset}
        />
      )}

      {/* Printable certificate (also used as PDF capture source) */}
      {step === 'preview' && cert && signature && (
        <div className="space-y-3">
          <div ref={printRef} className="mx-auto w-full max-w-[794px] bg-white text-slate-900 p-10 border border-slate-200">
            <CertificateBody
              cert={cert}
              projectName={projectName}
              signatureUrl={signature.signatureImageUrl}
              signerName={signature.signerName}
              signerRole={signature.signerRole}
              signedAt={signature.signedAt}
            />
          </div>
          {busy && (
            <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" /> Generating PDF…
            </p>
          )}
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={reset}>Done</Button>
          </div>
        </div>
      )}

      {/* Register */}
      {certificates.length > 0 && step === 'idle' && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issued certificates</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {certificates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" aria-hidden />
                    {c.gateCode}{c.gateName ? ` · ${c.gateName}` : ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {c.verificationId} · {new Date(c.issuedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                    {c.issuedByName ? ` · ${c.issuedByName}` : ''}
                  </p>
                </div>
                {c.pdfUrl && (
                  <a
                    href={c.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline shrink-0"
                  >
                    <Download className="size-3.5" aria-hidden /> PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function CertificateBody({
  cert, projectName, signatureUrl, signerName, signerRole, signedAt,
}: {
  cert: GateCertificate
  projectName: string
  signatureUrl: string
  signerName: string
  signerRole: string | null
  signedAt: string
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-2 text-amber-600">
        <Award className="size-8" aria-hidden />
        <span className="text-lg font-bold tracking-wide">GRIDMIND CAPITAL</span>
      </div>
      <p className="mt-6 text-xs uppercase tracking-[0.3em] text-slate-500">Certificate of Gate Completion</p>
      <h1 className="mt-3 text-3xl font-bold">{cert.gateCode}{cert.gateName ? ` — ${cert.gateName}` : ''}</h1>
      <p className="mt-4 max-w-lg text-sm text-slate-600">
        This certifies that the stage gate has been formally reviewed and approved as complete
        for the project below, with all listed deliverables satisfied.
      </p>

      <div className="mt-6 w-full max-w-lg text-left">
        <div className="flex justify-between border-b border-slate-200 py-2 text-sm">
          <span className="text-slate-500">Project</span>
          <span className="font-medium">{projectName}</span>
        </div>
        <div className="flex justify-between border-b border-slate-200 py-2 text-sm">
          <span className="text-slate-500">Verification ID</span>
          <span className="font-mono font-medium">{cert.verificationId}</span>
        </div>
        <div className="flex justify-between border-b border-slate-200 py-2 text-sm">
          <span className="text-slate-500">Issued</span>
          <span className="font-medium">{new Date(cert.issuedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}</span>
        </div>
      </div>

      {cert.deliverables.length > 0 && (
        <div className="mt-6 w-full max-w-lg text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Deliverables</p>
          <ul className="space-y-1">
            {cert.deliverables.map((d, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span>{d.label}</span>
                <span className="text-emerald-600 font-medium">{d.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 flex w-full max-w-lg items-end justify-between">
        <div className="text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureUrl || '/placeholder.svg'}
            alt={`Signature of ${signerName}`}
            crossOrigin="anonymous"
            className="h-14 object-contain"
          />
          <div className="mt-1 border-t border-slate-300 pt-1">
            <p className="text-sm font-semibold">{signerName}</p>
            {signerRole && <p className="text-xs text-slate-500">{signerRole}</p>}
            <p className="text-[11px] text-slate-400">
              {new Date(signedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>
        <div className="flex size-20 items-center justify-center rounded-full border-2 border-amber-500 text-center">
          <span className="text-[9px] font-semibold uppercase leading-tight text-amber-600">Official<br />Seal</span>
        </div>
      </div>
    </div>
  )
}
