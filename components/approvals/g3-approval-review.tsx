'use client'

import React from 'react'
import Link from 'next/link'
import {
  CheckCircle, AlertCircle, PauseCircle, XCircle, Gavel, ChevronRight,
  PenLine, Building2, FileText, Users, ClipboardList, ListChecks, Clock, X,
} from 'lucide-react'
import { SignaturePad } from '@/components/signatures/signature-pad'
import { SignatureDisplay } from '@/components/signatures/signature-display'
import type { SignatureDraft, SignatureRecord } from '@/app/actions/signatures'
import type { GateApprovalDetailView } from '@/lib/approvals/gate-detail'
import type { EligibleDelegate } from '@/app/actions/approvals'
import { useClientNow } from '@/lib/hooks/use-client-now'

type Decision = 'proceed' | 'conditional_proceed' | 'hold' | 'reject'

// ─── Config (mirrors G0, worded for G3: RTB → G4 Detailed Design) ──────────

const MIN_CHARS: Record<Decision, number> = {
  proceed: 100,
  conditional_proceed: 200,
  hold: 300,
  reject: 100,
}

const DECISION_CONFIG: Record<Decision, {
  label: string; desc: string; icon: React.ReactNode; border: string; bg: string; btn: string
}> = {
  proceed: {
    label: 'Proceed',
    desc: 'Approve Ready-to-Build and advance to G4: Detailed Design (IFC)',
    icon: <CheckCircle className="w-5 h-5 text-green-500" />,
    border: 'border-green-500', bg: 'bg-green-50 dark:bg-green-900/10', btn: 'bg-green-600 hover:bg-green-700',
  },
  conditional_proceed: {
    label: 'Conditional Proceed',
    desc: 'Approve with conditions that must be met before G4',
    icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
    border: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10', btn: 'bg-amber-600 hover:bg-amber-700',
  },
  hold: {
    label: 'Hold',
    desc: 'Pause pending further information',
    icon: <PauseCircle className="w-5 h-5 text-slate-500" />,
    border: 'border-slate-500', bg: 'bg-slate-50 dark:bg-slate-800/40', btn: 'bg-slate-600 hover:bg-slate-700',
  },
  reject: {
    label: 'Reject',
    desc: 'Decline the gate submission',
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    border: 'border-red-500', bg: 'bg-red-50 dark:bg-red-900/10', btn: 'bg-red-600 hover:bg-red-700',
  },
}

// ─── Small presentational helpers ──────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</span>
      </div>
      {right}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
      <div className="text-sm text-slate-900 dark:text-slate-100">{children}</div>
    </div>
  )
}

function Avatar({ name, className = '' }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
  return (
    <span className={`inline-flex size-8 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40 text-xs font-semibold text-sky-700 dark:text-sky-300 ${className}`}>
      {initials}
    </span>
  )
}

// ─── Delegate modal — REAL recipients only ──────────────────────────────────

function DelegateModal({ recipients, loading, onClose, onConfirm, isSubmitting }: {
  recipients: EligibleDelegate[]
  loading: boolean
  onClose: () => void
  onConfirm: (delegateId: string, reason: string) => Promise<void>
  isSubmitting: boolean
}) {
  const [delegateId, setDelegateId] = React.useState('')
  const [reason, setReason] = React.useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <span className="font-semibold text-slate-900 dark:text-slate-100">Delegate Approval</span>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Delegate to</label>
            {loading ? (
              <p className="text-sm text-slate-400">Loading eligible approvers…</p>
            ) : recipients.length === 0 ? (
              <p className="text-sm text-amber-600 dark:text-amber-500">
                No other eligible approver is available to receive this delegation.
              </p>
            ) : (
              <select
                value={delegateId}
                onChange={(e) => setDelegateId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Select an eligible approver…</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}{r.role ? ` — ${r.role.replace(/_/g, ' ')}` : ''}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Reason for delegation</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you are delegating this approval..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!delegateId || !reason.trim() || isSubmitting}
            onClick={() => onConfirm(delegateId, reason)}
            className="flex-1 px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-600 text-white text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Delegating...' : 'Confirm Delegate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Props ───────────────────────────────────────────────────────────────

export interface G3ApprovalReviewProps {
  detail: GateApprovalDetailView
  existingSignatures?: SignatureRecord[]
  onDecide: (
    decision: Decision,
    rationale: string,
    conditions: Array<{ title: string; due_date: string }> | undefined,
    signatureDraft: SignatureDraft | undefined,
  ) => Promise<void>
  onDelegate: (delegateId: string, reason: string) => Promise<void>
  loadDelegates: () => Promise<EligibleDelegate[]>
}

// ─── Component ─────────────────────────────────────────────────────────────

export function G3ApprovalReview({
  detail, existingSignatures = [], onDecide, onDelegate, loadDelegates,
}: G3ApprovalReviewProps) {
  const { approval, project, phaseGate, submission, g3, steps, requester, currentAssignee, events, viewerGating } = detail

  const [decision, setDecision] = React.useState<Decision>('proceed')
  const [showSig, setShowSig] = React.useState(false)
  const [signature, setSignature] = React.useState<SignatureDraft | null>(null)
  const [rationale, setRationale] = React.useState('')
  const [conditionsText, setConditionsText] = React.useState('')
  const [showDelegate, setShowDelegate] = React.useState(false)
  const [recipients, setRecipients] = React.useState<EligibleDelegate[]>([])
  const [recipientsLoading, setRecipientsLoading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [delegating, setDelegating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  // Control gating is SERVER-COMPUTED (detail.viewerGating): the current-step
  // assignee or an admin may act; everyone else sees a read-only panel with the
  // reason. This is presentation only — the RPCs remain the enforcement boundary.
  const { canDecide, canDelegate, readOnlyReason } = viewerGating
  // Display-only: drives the status badge + SLA countdown, independent of who is
  // viewing. Actionability is governed by canDecide/canDelegate above.
  const isDecided = approval.status === 'approved' || approval.status === 'rejected'
  const minChars = MIN_CHARS[decision]
  const charCount = rationale.length
  const needsSignature = decision === 'proceed' || decision === 'conditional_proceed'
  const signatureReady = !needsSignature || signature !== null
  const canSubmit = canDecide && charCount >= minChars && signatureReady && !submitting
  const cfg = DECISION_CONFIG[decision]

  const now = useClientNow(60_000)
  const createdMs = new Date(approval.createdAt).getTime()
  const hoursLeft = now === null ? null : Math.max(0, 48 - Math.floor((now - createdMs) / 3600000))
  const slaColor = hoursLeft === null ? 'text-slate-500' : hoursLeft < 24 ? 'text-red-500' : 'text-slate-500'

  async function openDelegate() {
    setShowDelegate(true)
    setRecipientsLoading(true)
    try {
      setRecipients(await loadDelegates())
    } catch {
      setRecipients([])
    } finally {
      setRecipientsLoading(false)
    }
  }

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      let parsedConditions: Array<{ title: string; due_date: string }> | undefined
      if (decision === 'conditional_proceed') {
        const lines = conditionsText.trim().split('\n').filter((l) => l.trim())
        parsedConditions = lines.map((line) => ({
          title: line.trim(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }))
      }
      await onDecide(decision, rationale, parsedConditions, signature ?? undefined)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit decision')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelegate(delegateId: string, reason: string) {
    setDelegating(true)
    setError(null)
    try {
      await onDelegate(delegateId, reason)
      setShowDelegate(false)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delegate')
    } finally {
      setDelegating(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="size-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Decision Recorded</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Your governed decision has been committed and the workflow has advanced.
          </p>
        </div>
        <Link href="/approvals" className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors">
          Back to Approvals
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen p-6">
      {/* Header */}
      <div className="mb-6">
        <nav className="flex items-center gap-1 mb-3" aria-label="Breadcrumb">
          <Link href="/approvals" className="text-sm text-sky-600 hover:underline">Approvals</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" aria-hidden />
          <span className="text-sm text-slate-500 dark:text-slate-400">G3 Review</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 text-balance">{approval.title}</h1>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            Gate {approval.gateNumber} · Ready-to-Build
          </span>
          {isDecided && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${approval.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
              {approval.status}
            </span>
          )}
          {!isDecided && hoursLeft !== null && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${slaColor}`}>
              <Clock className="w-3.5 h-3.5" aria-hidden /> {hoursLeft}h to SLA
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left / main column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project */}
          <Card>
            <CardHeader icon={<Building2 className="w-5 h-5" />} title="Project" />
            <div className="p-5">
              {project.available ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Name">{project.name}</Field>
                  <Field label="Code"><span className="font-mono">{project.code}</span></Field>
                  <Field label="Technology">{project.technology ?? '—'}</Field>
                  <Field label="Capacity (MW)">{project.capacityMw ?? '—'}</Field>
                  <Field label="Location">{project.location ?? '—'}{project.country ? `, ${project.country}` : ''}</Field>
                  <Field label="Current Phase">{project.currentPhase ?? '—'}</Field>
                </div>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Linked project unavailable{project.attemptedId ? ` (${project.attemptedId})` : ''}. It may belong to another tenant or have been removed.
                </p>
              )}
              {phaseGate.available && (
                <p className="mt-4 text-xs text-slate-400">
                  Phase gate: {phaseGate.phaseName ?? `Phase ${phaseGate.phaseNumber}`} · status {phaseGate.status ?? '—'}
                  {submission.hasSubmission ? ` · submission ${submission.status ?? ''}` : ' · no submission on file'}
                </p>
              )}
            </div>
          </Card>

          {/* Executive summary */}
          {g3.executiveSummary && (
            <Card>
              <CardHeader icon={<FileText className="w-5 h-5" />} title="Executive Summary" />
              <div className="p-5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {g3.executiveSummary}
              </div>
            </Card>
          )}

          {/* Commercial milestones + financial checkpoints */}
          <Card>
            <CardHeader icon={<ListChecks className="w-5 h-5" />} title="Commercial & Financial Readiness" />
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChecklistGroup title="Commercial Milestones" items={g3.commercialMilestones} />
              <ChecklistGroup title="Financial Checkpoints" items={g3.financialCheckpoints} />
            </div>
          </Card>

          {/* Deliverables */}
          <Card>
            <CardHeader icon={<ClipboardList className="w-5 h-5" />} title="Deliverables" />
            <div className="p-5 space-y-3">
              {g3.deliverables.map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{d.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{d.description}</p>
                    {d.uploaded && d.documentTitle && (
                      <p className="mt-1 text-xs text-sky-600 dark:text-sky-400 truncate">
                        {d.documentTitle}{d.documentCategory ? ` · ${d.documentCategory}` : ''}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${d.uploaded ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {d.uploaded ? 'Provided' : 'Missing'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Staffing */}
          <Card>
            <CardHeader icon={<Users className="w-5 h-5" />} title="Project Staffing" />
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {g3.staffingRoles.map((s) => (
                <div key={s.roleId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.roleName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.description}</p>
                  </div>
                  {s.assigned && s.personName ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Avatar name={s.personName} />
                      <span className="text-xs text-slate-700 dark:text-slate-300">{s.personName}</span>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-amber-600 dark:text-amber-500">Unfilled</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Governed event trail */}
          {events.length > 0 && (
            <Card>
              <CardHeader icon={<Clock className="w-5 h-5" />} title="Governance Trail" />
              <ol className="p-5 space-y-3">
                {events.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1 size-2 rounded-full bg-sky-400 shrink-0" aria-hidden />
                    <div>
                      <span className="font-medium text-slate-900 dark:text-slate-100 capitalize">{ev.event.replace(/_/g, ' ')}</span>
                      {ev.fromStatus && ev.toStatus && (
                        <span className="text-slate-500 dark:text-slate-400"> · {ev.fromStatus} → {ev.toStatus}</span>
                      )}
                      {ev.createdAt && (
                        <span className="block text-xs text-slate-400">{new Date(ev.createdAt).toLocaleString()}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        {/* ── Right / decision column ── */}
        <div className="space-y-6">
          {/* Progress + people */}
          <Card>
            <CardHeader icon={<Users className="w-5 h-5" />} title="Approval Progress" />
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Level</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {steps.currentLevel ?? steps.totalLevels} of {steps.totalLevels}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${steps.totalLevels ? (steps.approvedLevels / steps.totalLevels) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">{steps.remainingQuorum} approval(s) remaining</p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <PersonRow label="Requester" name={requester.available ? requester.name : 'Unavailable'} role={requester.role} />
                <PersonRow label="Current Approver" name={currentAssignee.available ? currentAssignee.name : 'Unavailable'} role={currentAssignee.role} />
              </div>
            </div>
          </Card>

          {/* Decision */}
          <Card>
            <CardHeader icon={<Gavel className="w-5 h-5" />} title="Your Decision" />
            <div className="p-5 space-y-4">
              {!canDecide ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {readOnlyReason ?? 'You do not have permission to act on this gate.'}
                </p>
              ) : (
                <>
                  {(['proceed', 'conditional_proceed', 'hold', 'reject'] as Decision[]).map((d) => {
                    const c = DECISION_CONFIG[d]
                    const selected = decision === d
                    return (
                      <label
                        key={d}
                        className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${selected ? `${c.border} ${c.bg}` : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'}`}
                      >
                        <input
                          type="radio" name="decision" value={d} checked={selected}
                          onChange={() => { setDecision(d); setSignature(null); setShowSig(false) }}
                          className="mt-0.5 accent-current"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {c.icon}
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.desc}</p>
                        </div>
                      </label>
                    )
                  })}

                  {decision === 'conditional_proceed' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Conditions</label>
                      <textarea
                        rows={3} value={conditionsText} onChange={(e) => setConditionsText(e.target.value)}
                        placeholder="One condition per line — each becomes a tracked G4 prerequisite..."
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                      />
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Recorded inside the governed decision. At least one is required.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Decision Rationale <span className="text-red-500">*</span>
                      </label>
                      <span className={`text-xs ${charCount < minChars ? 'text-amber-500' : 'text-green-600'}`}>{charCount} / 500</span>
                    </div>
                    <textarea
                      rows={4} value={rationale} onChange={(e) => setRationale(e.target.value)}
                      placeholder="Explain your decision..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Minimum {minChars} characters for {cfg.label}.</p>
                  </div>

                  {existingSignatures.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Recorded signatures</p>
                      {existingSignatures.map((sig) => (<SignatureDisplay key={sig.id} signature={sig} />))}
                    </div>
                  )}

                  {needsSignature && (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Electronic Signature <span className="text-red-500">*</span>
                        </label>
                        {signature && (
                          <button type="button" onClick={() => { setSignature(null); setShowSig(true) }} className="text-xs font-medium text-sky-600 hover:underline">
                            Re-sign
                          </button>
                        )}
                      </div>
                      {signature ? (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={signature.dataUrl} alt="Your captured signature, pending submission" className="h-20 w-full object-contain" />
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                            <PenLine className="w-3 h-3" aria-hidden /> Captured — committed atomically with your decision
                          </p>
                        </div>
                      ) : showSig ? (
                        <SignaturePad
                          entityType="gate_approval"
                          entityId={approval.id}
                          projectId={project.id}
                          statement={`I, as the authorized approver, endorse the "${cfg.label}" decision for gate ${approval.gateNumber} of ${project.name ?? approval.title}. This electronic signature is legally binding.`}
                          defer
                          onDraft={(d) => { setSignature(d); setShowSig(false) }}
                          onCancel={() => setShowSig(false)}
                        />
                      ) : (
                        <button
                          type="button" onClick={() => setShowSig(true)}
                          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 py-4 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-sky-400 hover:text-sky-600 transition-colors"
                        >
                          <PenLine className="w-4 h-4" /> Add signature
                        </button>
                      )}
                    </div>
                  )}

                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button" disabled={!canSubmit} onClick={handleSubmit}
                      className={`w-full px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50 ${cfg.btn}`}
                    >
                      {submitting ? 'Submitting…' : `Submit ${cfg.label}`}
                    </button>
                    {canDelegate && (
                      <button
                        type="button" onClick={openDelegate}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Delegate…
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {showDelegate && (
        <DelegateModal
          recipients={recipients}
          loading={recipientsLoading}
          isSubmitting={delegating}
          onClose={() => setShowDelegate(false)}
          onConfirm={handleDelegate}
        />
      )}
    </div>
  )
}

function ChecklistGroup({ title, items }: { title: string; items: { id: string; name: string; description: string; completed: boolean }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.id} className="flex items-start gap-2">
            {m.completed
              ? <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" aria-hidden />
              : <span className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 mt-0.5 shrink-0" aria-hidden />}
            <div className="min-w-0">
              <p className="text-sm text-slate-900 dark:text-slate-100">{m.name}</p>
              {m.description && <p className="text-xs text-slate-500 dark:text-slate-400">{m.description}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PersonRow({ label, name, role }: { label: string; name: string; role: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} />
      <div className="min-w-0">
        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{name}</p>
        {role && <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{role.replace(/_/g, ' ')}</p>}
      </div>
    </div>
  )
}
