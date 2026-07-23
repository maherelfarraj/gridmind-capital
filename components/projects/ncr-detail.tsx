'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
  getNcr, getNcrHistory, updateNcr, startRectification, sendToReinspection, recordReinspection,
  type Ncr,
} from '@/app/actions/ncrs'
import {
  NCR_STATUS_LABEL, NCR_STATUS_BADGE, NCR_SOURCE_LABEL, NCR_STEPS, ncrStepIndex, formatDate,
} from '@/lib/ncrs/ui'
import {
  ArrowLeft, Check, AlertTriangle, RotateCcw, Wrench, ClipboardCheck, Save,
} from 'lucide-react'
import { CameraCapture } from '@/components/pwa/camera-capture'

export function NcrDetail({ projectId, ncrId }: { projectId: string; ncrId: string }) {
  const { toast } = useToast()
  const { data: ncr, isLoading, mutate } = useSWR(`ncr-${ncrId}`, () => getNcr(ncrId))
  const { data: history, mutate: mutateHistory } = useSWR(`ncr-history-${ncrId}`, () => getNcrHistory(ncrId))

  if (isLoading) return <main className="mx-auto max-w-5xl px-4 py-8 text-muted-foreground">Loading…</main>
  if (!ncr) return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-muted-foreground">NCR not found.</p>
      <Link href={`/projects/${projectId}/ncrs`} className="text-primary hover:underline text-sm">← Back to register</Link>
    </main>
  )

  function refresh() { mutate(); mutateHistory() }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/projects/${projectId}/ncrs`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-4" /> Back to register
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{ncr.ncr_number}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${NCR_STATUS_BADGE[ncr.status]}`}>
              {NCR_STATUS_LABEL[ncr.status]}
            </span>
            {ncr.cycle > 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                <RotateCcw className="size-3" /> Cycle {ncr.cycle}
              </span>
            )}
          </div>
          <p className="text-lg mt-1 text-pretty">{ncr.title}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {NCR_SOURCE_LABEL[ncr.source]} · Raised {formatDate(ncr.raised_at)}
            {ncr.raised_by_name ? ` by ${ncr.raised_by_name}` : ''} · {ncr.status === 'closed' ? `${ncr.days_open}d to close` : `${ncr.days_open}d open`}
          </p>
        </div>
      </header>

      <Stepper status={ncr.status} />

      <div className="grid gap-6 md:grid-cols-3 mt-6">
        <div className="md:col-span-2 space-y-6">
          <DetailsAndActions ncr={ncr} onChanged={refresh} />
        </div>
        <div className="space-y-6">
          <CycleHistory events={history ?? []} />
        </div>
      </div>
    </main>
  )
}

// ── Stepper ──────────────────────────────────────────────────
function Stepper({ status }: { status: Ncr['status'] }) {
  const active = ncrStepIndex(status)
  return (
    <div className="flex items-center">
      {NCR_STEPS.map((step, i) => {
        const done = i < active
        const current = i === active
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={[
                'flex size-8 items-center justify-center rounded-full border text-xs font-semibold',
                done ? 'bg-primary border-primary text-primary-foreground'
                  : current ? 'border-primary text-primary'
                  : 'border-muted-foreground/30 text-muted-foreground',
              ].join(' ')}>
                {done ? <Check className="size-4" /> : i + 1}
              </div>
              <span className={`text-xs ${current ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
            </div>
            {i < NCR_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 ${i < active ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Details + workflow actions ───────────────────────────────
function DetailsAndActions({ ncr, onChanged }: { ncr: Ncr; onChanged: () => void }) {
  const { toast } = useToast()
  const [rootCause, setRootCause] = useState(ncr.root_cause ?? '')
  const [correctiveAction, setCorrectiveAction] = useState(ncr.corrective_action ?? '')
  const [busy, setBusy] = useState(false)
  const [reinspectOpen, setReinspectOpen] = useState<null | 'pass' | 'fail'>(null)
  const [note, setNote] = useState('')

  const editable = ncr.status !== 'closed'
  const dirty = rootCause !== (ncr.root_cause ?? '') || correctiveAction !== (ncr.corrective_action ?? '')
  const rcaComplete = rootCause.trim().length > 0 && correctiveAction.trim().length > 0

  async function save() {
    setBusy(true)
    const res = await updateNcr(ncr.id, { root_cause: rootCause, corrective_action: correctiveAction })
    setBusy(false)
    if (res.error) { toast({ title: 'Save failed', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Saved', variant: 'success' })
    onChanged()
  }

  async function run(fn: () => Promise<{ error?: string }>, successMsg: string) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (res.error) { toast({ title: 'Action blocked', description: res.error, variant: 'danger' }); return }
    toast({ title: successMsg, variant: 'success' })
    onChanged()
  }

  async function submitReinspection() {
    const result = reinspectOpen!
    if (result === 'pass' && !note.trim()) {
      toast({ title: 'Closure note required', description: 'Enter a closure note to close on a pass.', variant: 'danger' })
      return
    }
    setBusy(true)
    const res = await recordReinspection(ncr.id, result, note)
    setBusy(false)
    if (res.error) { toast({ title: 'Action blocked', description: res.error, variant: 'danger' }); return }
    toast({ title: result === 'pass' ? 'NCR closed' : `Reopened for cycle ${ncr.cycle + 1}`, variant: 'success' })
    setReinspectOpen(null); setNote('')
    onChanged()
  }

  return (
    <>
      {ncr.description && (
        <Card className="p-5">
          <h2 className="text-sm font-medium mb-2">Description</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ncr.description}</p>
        </Card>
      )}

      {/* Field photos — mobile camera capture */}
      <Card className="p-5">
        <CameraCapture projectId={ncr.project_id} linkType="ncr" linkId={ncr.id} />
      </Card>

      {/* Root cause + corrective action */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Root cause &amp; corrective action</h2>
          {ncr.status === 'open' && !rcaComplete && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5" /> Required before rectification
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rc">Root cause</Label>
          <Textarea id="rc" rows={3} value={rootCause} disabled={!editable}
            onChange={(e) => setRootCause(e.target.value)} placeholder="Why did the non-conformance occur?" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca">Corrective action</Label>
          <Textarea id="ca" rows={3} value={correctiveAction} disabled={!editable}
            onChange={(e) => setCorrectiveAction(e.target.value)} placeholder="What will be done to correct and prevent recurrence?" />
        </div>
        {editable && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={save} disabled={busy || !dirty}>
              <Save className="size-3.5 mr-1.5" /> Save
            </Button>
          </div>
        )}
        {ncr.closure_note && (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 p-3">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Closure note</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-0.5">{ncr.closure_note}</p>
          </div>
        )}
      </Card>

      {/* Workflow actions */}
      {ncr.status !== 'closed' && (
        <Card className="p-5">
          <h2 className="text-sm font-medium mb-3">Next step</h2>
          <div className="flex flex-wrap gap-2">
            {ncr.status === 'open' && (
              <Button
                onClick={() => run(() => startRectification(ncr.id), 'Moved to In Rectification')}
                disabled={busy || !rcaComplete}
                title={!rcaComplete ? 'Root cause and corrective action are required first' : undefined}
              >
                <Wrench className="size-4 mr-1.5" /> Start rectification
              </Button>
            )}
            {ncr.status === 'in_rectification' && (
              <Button onClick={() => run(() => sendToReinspection(ncr.id), 'Sent to Re-inspection')} disabled={busy}>
                <ClipboardCheck className="size-4 mr-1.5" /> Send to re-inspection
              </Button>
            )}
            {ncr.status === 're_inspection' && (
              <>
                <Button onClick={() => { setNote(''); setReinspectOpen('pass') }} disabled={busy}>
                  <Check className="size-4 mr-1.5" /> Re-inspection passed
                </Button>
                <Button variant="outline" onClick={() => { setNote(''); setReinspectOpen('fail') }} disabled={busy}>
                  <RotateCcw className="size-4 mr-1.5" /> Re-inspection failed
                </Button>
              </>
            )}
          </div>
          {ncr.status === 'open' && !rcaComplete && (
            <p className="text-xs text-muted-foreground mt-2">
              Enter and save the root cause and corrective action to enable rectification.
            </p>
          )}
        </Card>
      )}

      {/* Re-inspection dialog */}
      <Dialog open={reinspectOpen !== null} onOpenChange={(o) => { if (!o) setReinspectOpen(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reinspectOpen === 'pass' ? 'Close NCR — re-inspection passed' : 'Fail re-inspection — reopen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {reinspectOpen === 'pass' ? (
              <p className="text-sm text-muted-foreground">
                Confirm the re-inspection passed. A closure note is required — the NCR will move to <strong>Closed</strong>.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                The re-inspection failed. The NCR will return to <strong>Open</strong> and start cycle {ncr.cycle + 1}. Add a note describing what still needs correction.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="reinspect-note">{reinspectOpen === 'pass' ? 'Closure note' : 'Failure note'}</Label>
              <Textarea id="reinspect-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={reinspectOpen === 'pass' ? 'Summarise how the non-conformance was resolved and verified…' : 'Describe the remaining defect…'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReinspectOpen(null)}>Cancel</Button>
            <Button onClick={submitReinspection} disabled={busy}>
              {busy ? 'Saving…' : reinspectOpen === 'pass' ? 'Close NCR' : `Reopen (cycle ${ncr.cycle + 1})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Cycle history timeline ───────────────────────────────────
function CycleHistory({ events }: { events: Awaited<ReturnType<typeof getNcrHistory>> }) {
  const LABEL: Record<string, string> = {
    NCR_RAISE: 'Raised',
    NCR_START_RECTIFICATION: 'Started rectification',
    NCR_SEND_REINSPECTION: 'Sent to re-inspection',
    NCR_REINSPECTION_PASS: 'Re-inspection passed — closed',
    NCR_REINSPECTION_FAIL: 'Re-inspection failed — reopened',
  }
  return (
    <Card className="p-5">
      <h2 className="text-sm font-medium mb-4">Cycle history</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      ) : (
        <ol className="space-y-4">
          {events.map((e) => {
            const isFail = e.transition_code === 'NCR_REINSPECTION_FAIL'
            const isPass = e.transition_code === 'NCR_REINSPECTION_PASS'
            return (
              <li key={e.id} className="relative pl-5">
                <span className={[
                  'absolute left-0 top-1 size-2.5 rounded-full',
                  isFail ? 'bg-red-500' : isPass ? 'bg-emerald-500' : 'bg-primary',
                ].join(' ')} />
                <div className="text-sm font-medium">
                  {LABEL[e.transition_code ?? ''] ?? e.transition_code}
                  {e.cycle != null && <span className="ml-2 text-xs text-muted-foreground">cycle {e.cycle}</span>}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString('en-US')}</div>
                {e.comment && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.comment}</p>}
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
