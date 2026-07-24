'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Send, Plus, Trash2, ArrowUpRight, ArrowDownLeft, Download, Clock,
  AlertTriangle, Inbox, Loader2, X, FileText,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  getTransmittalsRegister, createTransmittal, issueTransmittal, acknowledgeTransmittal,
  respondTransmittal, closeTransmittal, listLinkableDocuments, getLinkedDocumentUrl,
  type Transmittal, type TransmittalDirection, type TransmittalResponseCode,
} from '@/app/actions/transmittals'

// ─────────────────────────────────────────────────────────────
// Display metadata
// ─────────────────────────────────────────────────────────────

const PURPOSES: { value: string; label: string }[] = [
  { value: 'for_information',  label: 'For Information' },
  { value: 'for_review',       label: 'For Review' },
  { value: 'for_approval',     label: 'For Approval' },
  { value: 'for_construction', label: 'For Construction' },
  { value: 'for_action',       label: 'For Action' },
  { value: 'for_records',      label: 'For Records' },
]
const PURPOSE_LABEL: Record<string, string> = Object.fromEntries(PURPOSES.map((p) => [p.value, p.label]))

const RESPONSE_CODE_META: Record<TransmittalResponseCode, { label: string; cls: string }> = {
  A: { label: 'A · Approved',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  B: { label: 'B · As noted',  cls: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  C: { label: 'C · Revise',    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  D: { label: 'D · Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:        { label: 'Draft',        cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  issued:       { label: 'Issued',       cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  responded:    { label: 'Responded',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  closed:       { label: 'Closed',       cls: 'bg-muted text-muted-foreground' },
}

type FilterTab = 'all' | 'outgoing' | 'incoming' | 'awaiting'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ─────────────────────────────────────────────────────────────
// New / follow-up transmittal form
// ─────────────────────────────────────────────────────────────

const formSchema = z.object({
  direction: z.enum(['outgoing', 'incoming']),
  from_party: z.string().optional(),
  to_party: z.string().optional(),
  subject: z.string().trim().min(1, 'Subject is required'),
  purpose: z.string(),
  response_due: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    title: z.string().trim().min(1, 'Item title required'),
    revision: z.string().optional(),
    document_id: z.string().optional(),
  })),
})
type FormValues = z.infer<typeof formSchema>

interface Prefill {
  direction: TransmittalDirection
  from_party?: string
  to_party?: string
  subject?: string
}

function TransmittalForm({
  projectId, open, onClose, onCreated, prefill,
}: {
  projectId: string
  open: boolean
  onClose: () => void
  onCreated: (no: string) => void
  prefill?: Prefill | null
}) {
  const { toast } = useToast()
  const { data: docs } = useSWR(open ? `linkable-docs-${projectId}` : null, () => listLinkableDocuments(projectId))

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      direction: prefill?.direction ?? 'outgoing',
      from_party: prefill?.from_party ?? '',
      to_party: prefill?.to_party ?? '',
      subject: prefill?.subject ?? '',
      purpose: 'for_information',
      response_due: '',
      notes: '',
      items: [{ title: '', revision: 'A', document_id: '' }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const direction = watch('direction')

  async function onSubmit(values: FormValues) {
    const res = await createTransmittal(
      projectId,
      {
        direction: values.direction,
        from_party: values.from_party || null,
        to_party: values.to_party || null,
        subject: values.subject,
        purpose: values.purpose,
        response_due: values.response_due || null,
        notes: values.notes || null,
      },
      values.items.map((i) => ({
        title: i.title,
        revision: i.revision || 'A',
        document_id: i.document_id || null,
      })),
    )
    if (res.error) { toast({ title: 'Could not create transmittal', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Transmittal created', description: `${res.data?.transmittal_no} saved as draft.`, variant: 'success' })
    reset()
    onCreated(res.data?.transmittal_no ?? '')
  }

  const fieldCls = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prefill?.subject ? 'Follow-up transmittal' : 'New transmittal'}</DialogTitle>
          <DialogDescription>Record a formal document transmittal and its enclosed items.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-1">
          {/* Direction toggle */}
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {(['outgoing', 'incoming'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setValue('direction', d)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    direction === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {d === 'outgoing' ? <ArrowUpRight className="size-3.5" /> : <ArrowDownLeft className="size-3.5" />}
                  {d === 'outgoing' ? 'Outgoing' : 'Incoming'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr-from">From</Label>
              <Input id="tr-from" {...register('from_party')} placeholder={direction === 'outgoing' ? 'GridMind Capital' : 'e.g. EPC Contractor'} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-to">To</Label>
              <Input id="tr-to" {...register('to_party')} placeholder={direction === 'outgoing' ? 'e.g. Engineer of Record' : 'GridMind Capital'} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tr-subject">Subject</Label>
            <Input id="tr-subject" {...register('subject')} placeholder="e.g. Issue of IFC civil drawings — Rev C" />
            {errors.subject && <p className="text-xs text-red-600">{errors.subject.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr-purpose">Purpose</Label>
              <select id="tr-purpose" {...register('purpose')} className={fieldCls}>
                {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-due">Response due</Label>
              <Input id="tr-due" type="date" {...register('response_due')} />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Enclosed items</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ title: '', revision: 'A', document_id: '' })}>
                <Plus className="size-3.5 mr-1" /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-[1fr_5rem_1fr_auto] gap-2 items-start">
                  <div>
                    <Input {...register(`items.${idx}.title`)} placeholder="Item title / drawing name" />
                    {errors.items?.[idx]?.title && <p className="mt-1 text-xs text-red-600">{errors.items[idx]?.title?.message}</p>}
                  </div>
                  <Input {...register(`items.${idx}.revision`)} placeholder="Rev" />
                  <select {...register(`items.${idx}.document_id`)} className={fieldCls} aria-label="Link document">
                    <option value="">Link document…</option>
                    {(docs ?? []).map((d) => (
                      <option key={d.id} value={d.id}>{d.code ? `${d.code} — ` : ''}{d.title}</option>
                    ))}
                  </select>
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => (fields.length > 1 ? remove(idx) : undefined)}
                    disabled={fields.length === 1}
                    aria-label="Remove item"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tr-notes">Notes</Label>
            <Textarea id="tr-notes" rows={2} {...register('notes')} placeholder="Optional cover note…" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              Create transmittal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────
// Respond dialog (A / B / C / D)
// ─────────────────────────────────────────────────────────────

function RespondDialog({
  open, onClose, onSubmit, busy,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (code: TransmittalResponseCode, date: string) => void
  busy: boolean
}) {
  const [code, setCode] = useState<TransmittalResponseCode>('A')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record response</DialogTitle>
          <DialogDescription>Set the review outcome code and response date.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="resp-code">Response code</Label>
            <select
              id="resp-code" value={code}
              onChange={(e) => setCode(e.target.value as TransmittalResponseCode)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="A">A — Approved</option>
              <option value="B">B — Approved as noted</option>
              <option value="C">C — Revise &amp; resubmit</option>
              <option value="D">D — Rejected</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resp-date">Response date</Label>
            <Input id="resp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {code === 'C' && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              Code C requires a re-submission — you can raise a follow-up transmittal after recording this response.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(code, date)} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null}Record response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────
// Detail panel
// ─────────────────────────────────────────────────────────────

function DetailDialog({
  t, onClose, onChanged, onFollowUp,
}: {
  t: Transmittal
  onClose: () => void
  onChanged: () => void
  onFollowUp: (t: Transmittal) => void
}) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [respondOpen, setRespondOpen] = useState(false)

  async function run(fn: () => Promise<{ error?: string }>, okMsg: string) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (res.error) { toast({ title: 'Action failed', description: res.error, variant: 'danger' }); return false }
    toast({ title: okMsg, variant: 'success' })
    onChanged()
    return true
  }

  async function handleDownload(documentId: string) {
    const res = await getLinkedDocumentUrl(documentId)
    if (res.error || !res.url) { toast({ title: 'Download unavailable', description: res.error, variant: 'danger' }); return }
    window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  const status = t.status
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <span className="font-mono text-sm text-primary">{t.transmittal_no}</span>
              {t.direction === 'outgoing'
                ? <ArrowUpRight className="size-4 text-teal-500" />
                : <ArrowDownLeft className="size-4 text-blue-500" />}
              <span className="truncate">{t.subject}</span>
            </span>
          </DialogTitle>
          <DialogDescription>
            {t.direction === 'outgoing' ? 'Outgoing' : 'Incoming'} · {PURPOSE_LABEL[t.purpose ?? ''] ?? t.purpose ?? '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="From" value={t.from_party ?? '—'} />
            <Field label="To" value={t.to_party ?? '—'} />
            <Field label="Issue date" value={fmtDate(t.issue_date)} />
            <Field
              label="Response due"
              value={fmtDate(t.response_due)}
              valueCls={t.overdue ? 'text-red-600 dark:text-red-400 font-medium' : undefined}
            />
            <Field label="Response date" value={fmtDate(t.response_date)} />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <div className="flex items-center gap-2">
                <Badge meta={STATUS_META[status]} />
                {t.response_code && <Badge meta={RESPONSE_CODE_META[t.response_code]} />}
              </div>
            </div>
          </div>

          {t.notes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="rounded-md bg-muted/40 p-3 text-sm">{t.notes}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Enclosed items ({t.items.length})</p>
            {t.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items recorded.</p>
            ) : (
              <div className="rounded-md border border-border divide-y divide-border">
                {t.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{it.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">Rev {it.revision ?? 'A'}</span>
                    </div>
                    {it.document_id && (
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => handleDownload(it.document_id!)}>
                        <Download className="size-3.5 mr-1" /> Download
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex flex-wrap gap-2 justify-end w-full">
            {status === 'draft' && (
              <Button onClick={() => run(() => issueTransmittal(t.id), 'Transmittal issued')} disabled={busy}>
                <Send className="size-4 mr-1" /> Issue
              </Button>
            )}
            {status === 'issued' && (
              <Button variant="outline" onClick={() => run(() => acknowledgeTransmittal(t.id), 'Marked acknowledged')} disabled={busy}>
                Acknowledge
              </Button>
            )}
            {(status === 'issued' || status === 'acknowledged') && (
              <Button onClick={() => setRespondOpen(true)} disabled={busy}>Respond</Button>
            )}
            {t.response_code === 'C' && status !== 'draft' && (
              <Button variant="outline" onClick={() => onFollowUp(t)}>
                <Plus className="size-4 mr-1" /> Create follow-up transmittal
              </Button>
            )}
            {status !== 'closed' && (
              <Button variant="ghost" onClick={() => run(() => closeTransmittal(t.id), 'Transmittal closed')} disabled={busy}>
                Close
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      <RespondDialog
        open={respondOpen}
        busy={busy}
        onClose={() => setRespondOpen(false)}
        onSubmit={async (code, date) => {
          const ok = await run(async () => {
            const r = await respondTransmittal(t.id, code, date)
            return { error: r.error }
          }, 'Response recorded')
          if (ok) {
            setRespondOpen(false)
            if (code === 'C') onFollowUp(t)
          }
        }}
      />
    </Dialog>
  )
}

function Field({ label, value, valueCls }: { label: string; value: string; valueCls?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-sm', valueCls)}>{value}</p>
    </div>
  )
}

function Badge({ meta }: { meta?: { label: string; cls: string } }) {
  if (!meta) return null
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', meta.cls)}>{meta.label}</span>
}

// ─────────────────────────────────────────────────────────────
// Main register
// ─────────────────────────────────────────────────────────────

export function TransmittalsRegister({ projectId }: { projectId: string }) {
  const { data, isLoading, mutate } = useSWR(`transmittals-${projectId}`, () => getTransmittalsRegister(projectId))
  const [tab, setTab] = useState<FilterTab>('all')
  const [selected, setSelected] = useState<Transmittal | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [prefill, setPrefill] = useState<Prefill | null>(null)

  const rows = data?.rows ?? []
  const stats = data?.stats

  const filtered = useMemo(() => {
    switch (tab) {
      case 'outgoing': return rows.filter((r) => r.direction === 'outgoing')
      case 'incoming': return rows.filter((r) => r.direction === 'incoming')
      case 'awaiting': return rows.filter((r) => r.status === 'issued' || r.status === 'acknowledged')
      default: return rows
    }
  }, [rows, tab])

  // Keep the open detail dialog in sync with refreshed data.
  const selectedLive = selected ? rows.find((r) => r.id === selected.id) ?? null : null

  function openNew() { setPrefill(null); setFormOpen(true) }
  function openFollowUp(t: Transmittal) {
    setSelected(null)
    setPrefill({
      direction: t.direction,
      from_party: t.from_party ?? undefined,
      to_party: t.to_party ?? undefined,
      subject: t.subject.startsWith('Re: ') ? t.subject : `Re: ${t.subject}`,
    })
    setFormOpen(true)
  }

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',      label: `All (${rows.length})` },
    { id: 'outgoing', label: `Outgoing (${rows.filter((r) => r.direction === 'outgoing').length})` },
    { id: 'incoming', label: `Incoming (${rows.filter((r) => r.direction === 'incoming').length})` },
    { id: 'awaiting', label: `Awaiting response (${stats?.awaitingResponse ?? 0})` },
  ]

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-balance">Transmittals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Formal document transmittal log — issue, track responses, and close the loop with reviewers.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4 mr-1.5" /> New Transmittal
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={<Send className="size-4 text-blue-500" />} label="Issued this month" value={stats ? String(stats.issuedThisMonth) : '—'} />
        <StatCard icon={<Clock className="size-4 text-amber-500" />} label="Awaiting response" value={stats ? String(stats.awaitingResponse) : '—'} />
        <StatCard
          icon={<AlertTriangle className={cn('size-4', (stats?.overdue ?? 0) > 0 ? 'text-red-500' : 'text-muted-foreground')} />}
          label="Overdue responses"
          value={stats ? String(stats.overdue) : '—'}
          valueCls={(stats?.overdue ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : undefined}
        />
      </div>

      {/* Filter tabs */}
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-border mb-4">
        {TABS.map(({ id, label }) => (
          <button
            key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">No.</th>
                <th className="px-4 py-3 font-medium">Dir</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">To / From</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium">Response due</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Inbox className="size-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium">No transmittals yet — issue your first transmittal to start the formal document log</p>
                      <Button size="sm" className="mt-1" onClick={openNew}><Plus className="size-4 mr-1.5" /> New Transmittal</Button>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-xs text-primary">{t.transmittal_no}</td>
                  <td className="px-4 py-3">
                    {t.direction === 'outgoing'
                      ? <ArrowUpRight className="size-4 text-teal-500" aria-label="Outgoing" />
                      : <ArrowDownLeft className="size-4 text-blue-500" aria-label="Incoming" />}
                  </td>
                  <td className="px-4 py-3 max-w-xs"><span className="line-clamp-1">{t.subject}</span></td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[10rem]">
                    <span className="line-clamp-1">{t.direction === 'outgoing' ? (t.to_party ?? '—') : (t.from_party ?? '—')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {PURPOSE_LABEL[t.purpose ?? ''] ?? t.purpose ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.issue_date)}</td>
                  <td className={cn('px-4 py-3', t.overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground')}>
                    {fmtDate(t.response_due)}
                  </td>
                  <td className="px-4 py-3">{t.response_code ? <Badge meta={RESPONSE_CODE_META[t.response_code]} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3"><Badge meta={STATUS_META[t.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedLive && (
        <DetailDialog
          t={selectedLive}
          onClose={() => setSelected(null)}
          onChanged={() => mutate()}
          onFollowUp={openFollowUp}
        />
      )}

      <TransmittalForm
        projectId={projectId}
        open={formOpen}
        prefill={prefill}
        onClose={() => setFormOpen(false)}
        onCreated={() => { setFormOpen(false); mutate() }}
      />
    </main>
  )
}

function StatCard({ icon, label, value, valueCls }: { icon: React.ReactNode; label: string; value: string; valueCls?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={cn('mt-2 text-2xl font-semibold tabular-nums', valueCls)}>{value}</div>
    </Card>
  )
}
