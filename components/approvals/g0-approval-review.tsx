'use client'

import React from 'react'
import Link from 'next/link'
import {
  ChevronRight, FileText, Info, User, Clock, CheckCircle,
  AlertCircle, PauseCircle, XCircle, MessageSquare, Users,
  Flame, Mail, Download, Gavel, X, PenLine,
} from 'lucide-react'
import type { G0FormData, G0RiskRow, G0StakeholderRow } from '@/app/actions/gate-submissions'
import { SignaturePad } from '@/components/signatures/signature-pad'
import { SignatureDisplay } from '@/components/signatures/signature-display'
import type { SignatureDraft, SignatureRecord } from '@/app/actions/signatures'
import { useClientNow } from '@/lib/hooks/use-client-now'

// ─── Types ────────────────────────────────────────────────────

export interface ApprovalRecord {
  id:          string
  title:       string
  status:      'pending' | 'approved' | 'rejected' | 'delegated'
  priority:    string
  object_type: string
  created_at:  string
  description?: string | null
}

export interface UserProfile {
  id:         string
  name:       string
  email:      string
  role:       string
  department: string
  initials:   string
  avatarColor?: string
}

interface G0ApprovalReviewProps {
  approval:       ApprovalRecord
  opportunity:    Partial<G0FormData>
  requester:      UserProfile
  /**
   * `signatureDraft` is an UNPERSISTED signature. The handler must persist it
   * together with the decision, so a signature never exists on an undecided
   * approval. See SignatureDraft.
   */
  onDecide:       (decision: 'proceed' | 'conditional_proceed' | 'hold' | 'reject', rationale: string, conditions?: Array<{ title: string; due_date: string }>, signatureDraft?: SignatureDraft) => Promise<void>
  onDelegate:     (delegateId: string, reason: string) => Promise<void>
  onRequestInfo:  (message: string) => Promise<void>
  isSubmitting?:  boolean
  /** Project context for the signature consent statement + linkage. */
  projectId?:     string | null
  projectName?:   string
  /** Signatures already recorded against this approval. */
  existingSignatures?: SignatureRecord[]
}

type Decision = 'proceed' | 'conditional_proceed' | 'hold' | 'reject'

// ─── Helpers ──────────────────────────────────────────────────

function levelBadge(level: 'Low' | 'Medium' | 'High') {
  const map = {
    Low:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    High:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return map[level] ?? map.Medium
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
      {children}
    </p>
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d > 1 ? 's' : ''} ago`
}

const IRR_COLOR = (v: string) => {
  const n = parseFloat(v)
  if (isNaN(n)) return 'text-slate-600 dark:text-slate-300'
  if (n >= 8) return 'text-green-600 dark:text-green-400'
  if (n >= 5) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

const MIN_CHARS: Record<Decision, number> = {
  proceed:             100,
  conditional_proceed: 200,
  hold:                300,
  reject:              100,
}

const DECISION_CONFIG: Record<Decision, {
  label: string
  desc:  string
  icon:  React.ReactNode
  border: string
  bg:    string
  btn:   string
}> = {
  proceed: {
    label: 'Proceed',
    desc:  'Approve the opportunity and advance to G1: Project Baseline',
    icon:  <CheckCircle className="w-5 h-5 text-green-500" />,
    border: 'border-green-500',
    bg:    'bg-green-50 dark:bg-green-900/10',
    btn:   'bg-green-600 hover:bg-green-700',
  },
  conditional_proceed: {
    label: 'Conditional Proceed',
    desc:  'Approve with conditions that must be met before G1',
    icon:  <AlertCircle className="w-5 h-5 text-amber-500" />,
    border: 'border-amber-500',
    bg:    'bg-amber-50 dark:bg-amber-900/10',
    btn:   'bg-amber-600 hover:bg-amber-700',
  },
  hold: {
    label: 'Hold',
    desc:  'Pause the opportunity pending further information',
    icon:  <PauseCircle className="w-5 h-5 text-slate-500" />,
    border: 'border-slate-500',
    bg:    'bg-slate-50 dark:bg-slate-800/40',
    btn:   'bg-slate-600 hover:bg-slate-700',
  },
  reject: {
    label: 'Reject',
    desc:  'Decline the opportunity',
    icon:  <XCircle className="w-5 h-5 text-red-500" />,
    border: 'border-red-500',
    bg:    'bg-red-50 dark:bg-red-900/10',
    btn:   'bg-red-600 hover:bg-red-700',
  },
}

// ─── Delegate Modal ───────────────────────────────────────────

function DelegateModal({ onClose, onConfirm, isLoading }: {
  onClose: () => void
  onConfirm: (delegateId: string, reason: string) => Promise<void>
  isLoading: boolean
}) {
  const [delegateId, setDelegateId] = React.useState('')
  const [reason, setReason] = React.useState('')

  const TEAM_MEMBERS = [
    { id: 'ceo@gridmind.capital',     label: 'CEO' },
    { id: 'cfo@gridmind.capital',     label: 'CFO' },
    { id: 'cto@gridmind.capital',     label: 'CTO' },
    { id: 'legal@gridmind.capital',   label: 'Legal Counsel' },
    { id: 'finance@gridmind.capital', label: 'Finance Director' },
  ]

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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Delegate to
            </label>
            <select
              value={delegateId}
              onChange={(e) => setDelegateId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select team member...</option>
              {TEAM_MEMBERS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Reason for delegation
            </label>
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
            disabled={!delegateId || !reason.trim() || isLoading}
            onClick={() => onConfirm(delegateId, reason)}
            className="flex-1 px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-600 text-white text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Delegating...' : 'Confirm Delegate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Request Info Panel ───────────────────────────────────────

function RequestInfoPanel({ onSend, onClose, isLoading }: {
  onSend: (msg: string) => Promise<void>
  onClose: () => void
  isLoading: boolean
}) {
  const [msg, setMsg] = React.useState('')
  return (
    <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Request Additional Information</p>
      <textarea
        rows={3}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Describe what information you need from the requester..."
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!msg.trim() || isLoading}
          onClick={() => onSend(msg)}
          className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send Request'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

export function G0ApprovalReview({
  approval, opportunity, requester,
  onDecide, onDelegate, onRequestInfo,
  isSubmitting = false,
  projectId, projectName,
  existingSignatures = [],
}: G0ApprovalReviewProps) {
  const [decision, setDecision]         = React.useState<Decision>('proceed')
  const [showSig, setShowSig]           = React.useState(false)
  // The captured-but-UNPERSISTED signature. It is written to the database only
  // inside handleSubmit, together with the decision it authorizes.
  const [signature, setSignature]       = React.useState<SignatureDraft | null>(null)
  const [rationale, setRationale]       = React.useState('')
  const [conditions, setConditions]     = React.useState('')
  const [showDelegate, setShowDelegate] = React.useState(false)
  const [showInfo, setShowInfo]         = React.useState(false)
  const [submitting, setSubmitting]     = React.useState(false)
  const [delegating, setDelegating]     = React.useState(false)
  const [requesting, setRequesting]     = React.useState(false)
  const [error, setError]               = React.useState<string | null>(null)
  const [done, setDone]                 = React.useState(false)

  const minChars    = MIN_CHARS[decision]
  const charCount   = rationale.length
  // Approving decisions require a captured electronic signature.
  const needsSignature = decision === 'proceed' || decision === 'conditional_proceed'
  const signatureReady = !needsSignature || signature !== null
  const canSubmit   = charCount >= minChars && signatureReady && !submitting && !isSubmitting
  const cfg         = DECISION_CONFIG[decision]
  const submitted   = timeAgo(approval.created_at)

  // SLA — assume 48h from creation. Read the clock via useClientNow (mount-time,
  // refreshed each minute) rather than Date.now() during render, which is impure
  // and would desync between the server and client renders.
  const now = useClientNow(60_000)
  const hoursLeft = now === null
    ? null
    : Math.max(0, 48 - Math.floor((now - new Date(approval.created_at).getTime()) / 3600000))
  const slaColor  = hoursLeft === null ? 'text-slate-500'
    : hoursLeft < 24 ? 'text-red-500' : hoursLeft < 48 ? 'text-amber-500' : 'text-slate-500'

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      await onDecide(
        decision,
        rationale,
        decision === 'conditional_proceed' ? conditions : undefined,
        // Persisted server-side as part of the decision, never before it.
        signature ?? undefined,
      )
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit decision')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelegate(delegateId: string, reason: string) {
    setDelegating(true)
    try {
      await onDelegate(delegateId, reason)
      setShowDelegate(false)
    } finally {
      setDelegating(false)
    }
  }

  async function handleRequestInfo(msg: string) {
    setRequesting(true)
    try {
      await onRequestInfo(msg)
      setShowInfo(false)
    } finally {
      setRequesting(false)
    }
  }

  // ── Success state ─────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="size-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Decision Submitted</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Your decision has been recorded and the requester has been notified.
          </p>
        </div>
        <Link
          href="/approvals"
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
        >
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
          <Link href="/approvals" className="text-sm text-sky-600 hover:underline">
            Approvals
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" aria-hidden />
          <span className="text-sm text-slate-500 dark:text-slate-400">G0 Review</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            G0 Opportunity Review
          </h1>
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Pending
          </Badge>
        </div>
        <div className="flex items-center gap-4 mt-1.5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review and decide on opportunity acceptance
          </p>
          <span className={`flex items-center gap-1 text-sm ${slaColor}`}>
            <Clock className="w-3.5 h-3.5" aria-hidden />
            {hoursLeft === null ? 'Calculating SLA…' : `Due in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column (2/3) ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Opportunity Summary */}
          <Card>
            <CardHeader
              icon={<FileText className="w-5 h-5" />}
              title="Opportunity Summary"
              right={<span className="text-xs text-slate-500 dark:text-slate-400">Submitted {submitted}</span>}
            />
            <div className="p-5 space-y-6">

              {/* Section 1 — Basic Information */}
              <div>
                <SectionLabel>Basic Information</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Opportunity Name">
                    <span className="font-medium">{opportunity.opportunityName || '—'}</span>
                  </Field>
                  <Field label="Code">
                    <span className="font-mono text-slate-600 dark:text-slate-300 text-xs">{opportunity.opportunityCode || '—'}</span>
                  </Field>
                  <Field label="Source">
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {opportunity.source || 'Direct'}
                    </Badge>
                  </Field>
                  <Field label="Priority">
                    <Badge className={
                      opportunity.priority === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      opportunity.priority === 'High'     ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }>
                      {(opportunity.priority === 'High' || opportunity.priority === 'Critical') && (
                        <Flame className="w-3 h-3" aria-hidden />
                      )}
                      {opportunity.priority || 'Normal'}
                    </Badge>
                  </Field>
                  <Field label="Submitted By">
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-full bg-cyan-200 dark:bg-cyan-800 text-cyan-800 dark:text-cyan-200 text-xs font-semibold flex items-center justify-center">
                        {requester.initials}
                      </span>
                      <span>{requester.name}</span>
                    </div>
                  </Field>
                  <Field label="Date">
                    <span className="text-slate-500 dark:text-slate-400">
                      {new Date(approval.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </Field>
                </div>
              </div>

              {/* Section 2 — Technical */}
              <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                <SectionLabel>Technical Screening</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Technology">
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      {opportunity.technologyType || opportunity.technology || '—'}
                    </Badge>
                  </Field>
                  <Field label="Capacity">
                    <span className="font-medium">
                      {opportunity.estimatedCapacityMw ? `${opportunity.estimatedCapacityMw} MW` : (opportunity.capacityMwp ? `${opportunity.capacityMwp} MWp` : '—')}
                    </span>
                  </Field>
                  <Field label="Location">
                    {opportunity.siteLocation || '—'}
                  </Field>
                  <Field label="Grid Connection">
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="w-3 h-3" aria-hidden />
                      {opportunity.gridConnection || 'TBC'}
                    </Badge>
                  </Field>
                  <Field label="Land">
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {opportunity.landAvailability || 'TBC'}
                    </Badge>
                  </Field>
                  {opportunity.environmentalFlags && opportunity.environmentalFlags.length > 0 && (
                    <Field label="Environmental">
                      <div className="flex flex-wrap gap-1">
                        {opportunity.environmentalFlags.map((f) => (
                          <Badge key={f} className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{f}</Badge>
                        ))}
                      </div>
                    </Field>
                  )}
                </div>
              </div>

              {/* Section 3 — Commercial */}
              <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                <SectionLabel>Commercial Screening</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Client">
                    <span className="font-medium">{opportunity.clientName || '—'}</span>
                  </Field>
                  <Field label="Client Type">
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {opportunity.clientType || '—'}
                    </Badge>
                  </Field>
                  <Field label="Budget Range">
                    <span className="font-medium">
                      {opportunity.budgetMin && opportunity.budgetMax
                        ? `${opportunity.currency || 'USD'} ${Number(opportunity.budgetMin).toLocaleString()} – ${Number(opportunity.budgetMax).toLocaleString()}`
                        : (opportunity.capexEstimateUsd ? `USD ${Number(opportunity.capexEstimateUsd).toLocaleString()}` : '—')}
                    </span>
                  </Field>
                  <Field label="Currency">
                    <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {opportunity.currency || 'USD'}
                    </Badge>
                  </Field>
                  <Field label="Funding">
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {opportunity.fundingStatus || '—'}
                    </Badge>
                  </Field>
                  <Field label="PPA">
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {opportunity.ppaStatus || '—'}
                    </Badge>
                  </Field>
                  <Field label="Expected IRR">
                    <span className={`font-medium ${IRR_COLOR(opportunity.expectedIrr || opportunity.targetIrrPct || '')}`}>
                      {opportunity.expectedIrr || opportunity.targetIrrPct || '—'}%
                    </span>
                  </Field>
                </div>
              </div>

              {/* Section 4 — Risk */}
              {opportunity.overallRisk && (
                <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                  <SectionLabel>Risk Screening</SectionLabel>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Overall Risk:</span>
                    <Badge className={`text-sm px-3 py-1 ${levelBadge(opportunity.overallRisk)}`}>
                      {opportunity.overallRisk}
                    </Badge>
                  </div>
                  {(opportunity.risks ?? []).length > 0 && (
                    <div className="flex flex-col gap-2.5">
                      {(opportunity.risks as G0RiskRow[]).map((r, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
                          <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{r.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">P:</span>
                            <Badge className={levelBadge(r.probability)}>{r.probability}</Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">I:</span>
                            <Badge className={levelBadge(r.impact)}>{r.impact}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section 5 — Stakeholders */}
              {(opportunity.stakeholders ?? []).length > 0 && (
                <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                  <SectionLabel>Key Stakeholders</SectionLabel>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          {['Name', 'Role', 'Organization', 'Influence', 'Interest'].map((h) => (
                            <th key={h} className="pb-2 text-xs text-slate-400 dark:text-slate-500 font-medium pr-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(opportunity.stakeholders as G0StakeholderRow[]).map((s, i) => (
                          <tr key={i}>
                            <td className="py-2 pr-4 font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                            <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">{s.role}</td>
                            <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">{s.organization}</td>
                            <td className="py-2 pr-4"><Badge className={levelBadge(s.influence)}>{s.influence}</Badge></td>
                            <td className="py-2"><Badge className={levelBadge(s.interest)}>{s.interest}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Decision Card */}
          <Card>
            <CardHeader icon={<Gavel className="w-5 h-5" />} title="Your Decision" />
            <div className="p-5 space-y-4">

              {/* Decision options */}
              {(['proceed', 'conditional_proceed', 'hold', 'reject'] as Decision[]).map((d) => {
                const c = DECISION_CONFIG[d]
                const selected = decision === d
                return (
                  <label
                    key={d}
                    className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                      selected ? `${c.border} ${c.bg}` : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value={d}
                      checked={selected}
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

              {/* Conditions — only for conditional */}
              {decision === 'conditional_proceed' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Conditions
                  </label>
                  <textarea
                    rows={3}
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    placeholder="List conditions that must be satisfied..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    These will be tracked as G1 prerequisites.
                  </p>
                </div>
              )}

              {/* Rationale */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Decision Rationale <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-xs ${charCount < minChars ? 'text-amber-500' : 'text-green-600'}`}>
                    {charCount} / 500
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Explain your decision..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Minimum {minChars} characters for {cfg.label}.
                </p>
              </div>

              {/* Previously captured signatures for this approval */}
              {existingSignatures.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Recorded signatures
                  </p>
                  {existingSignatures.map((sig) => (
                    <SignatureDisplay key={sig.id} signature={sig} />
                  ))}
                </div>
              )}

              {/* Electronic signature — required to approve */}
              {needsSignature && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Electronic Signature <span className="text-red-500">*</span>
                    </label>
                    {signature && (
                      <button
                        type="button"
                        onClick={() => { setSignature(null); setShowSig(true) }}
                        className="text-xs font-medium text-sky-600 hover:underline"
                      >
                        Re-sign
                      </button>
                    )}
                  </div>

                  {signature ? (
                    /* Local preview of the pending signature. It is not saved yet,
                       so it renders straight from the captured data URL. */
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-3">
                      <img
                        src={signature.dataUrl}
                        alt="Your captured signature, pending submission"
                        className="h-20 w-full object-contain"
                      />
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                        <PenLine className="w-3 h-3" aria-hidden />
                        Captured — saved when you submit your decision
                      </p>
                    </div>
                  ) : showSig ? (
                    <SignaturePad
                      entityType="gate_approval"
                      entityId={approval.id}
                      projectId={projectId ?? null}
                      statement={`I, as the authorized approver, endorse the "${cfg.label}" decision for ${approval.title}${projectName ? ` (${projectName})` : ''}. This electronic signature is legally binding.`}
                      defer
                      onDraft={(d) => { setSignature(d); setShowSig(false) }}
                      onCancel={() => setShowSig(false)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSig(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 py-4 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-sky-400 hover:text-sky-600 transition-colors"
                    >
                      <PenLine className="w-4 h-4" aria-hidden />
                      Sign to authorize this decision
                    </button>
                  )}
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50 flex-1 justify-center ${cfg.btn}`}
                >
                  {submitting ? (
                    <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    cfg.icon
                  )}
                  Submit Decision
                </button>
                <button
                  type="button"
                  onClick={() => setShowInfo((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" aria-hidden />
                  Request Info
                </button>
                <button
                  type="button"
                  onClick={() => setShowDelegate(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Users className="w-4 h-4" aria-hidden />
                  Delegate
                </button>
              </div>

              {showInfo && (
                <RequestInfoPanel
                  onSend={handleRequestInfo}
                  onClose={() => setShowInfo(false)}
                  isLoading={requesting}
                />
              )}
            </div>
          </Card>
        </div>

        {/* ── Right column (1/3) ─────────────────────────────── */}
        <div className="space-y-6">

          {/* Approval Context */}
          <Card>
            <CardHeader icon={<Info className="w-5 h-5" />} title="Approval Context" />
            <div className="p-5 flex flex-col gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Approval Level</span>
                <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Level 1</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Required Role</span>
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Executive Sponsor</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">SLA</span>
                <span className={`font-medium ${slaColor}`}>48 hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Auto-escalation</span>
                <span className="text-slate-600 dark:text-slate-300">To: CEO</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Quorum</span>
                <span className="text-slate-600 dark:text-slate-300">1 of 1 required</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Previous</span>
                <span className="text-slate-600 dark:text-slate-300">None</span>
              </div>
            </div>
          </Card>

          {/* Requester Info */}
          <Card>
            <CardHeader icon={<User className="w-5 h-5" />} title="Requested By" />
            <div className="p-5">
              <div className="flex flex-col items-start gap-2">
                <span
                  className="size-12 rounded-full flex items-center justify-center text-base font-bold"
                  style={{ background: requester.avatarColor ?? '#a5f3fc', color: '#164e63' }}
                  aria-hidden
                >
                  {requester.initials}
                </span>
                <div className="mt-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{requester.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{requester.email}</p>
                </div>
                <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">{requester.role}</Badge>
                <p className="text-xs text-slate-400 dark:text-slate-500">{requester.department}</p>
                <a
                  href={`mailto:${requester.email}`}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" aria-hidden />
                  Contact
                </a>
              </div>
            </div>
          </Card>

          {/* History */}
          <Card>
            <CardHeader icon={<Clock className="w-5 h-5" />} title="Approval History" />
            <div className="p-5">
              <ol className="relative border-l border-slate-200 dark:border-slate-700 flex flex-col gap-5 pl-5">
                <li>
                  <span className="absolute -left-1.5 mt-1 size-3 rounded-full bg-green-500" aria-hidden />
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Submitted</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{submitted}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">by {requester.name}</p>
                </li>
                <li>
                  <span className="absolute -left-1.5 mt-1 size-3 rounded-full bg-amber-400" aria-hidden />
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Pending Review</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Current</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Awaiting your decision</p>
                </li>
              </ol>
            </div>
          </Card>

          {/* Supporting Documents */}
          <Card>
            <CardHeader icon={<FileText className="w-5 h-5" />} title="Supporting Documents" />
            <div className="p-5 flex flex-col gap-3">
              {[
                { name: 'Opportunity Assessment.pdf',    size: '2.4 MB' },
                { name: 'Preliminary Risk Screening.pdf', size: '1.1 MB' },
                { name: 'Stakeholder Register.xlsx',     size: '156 KB' },
              ].map((doc) => (
                <div key={doc.name} className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{doc.size}</p>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="flex items-center gap-1.5 mt-1 text-sm text-sky-600 hover:underline self-start"
              >
                <Download className="w-3.5 h-3.5" aria-hidden />
                Download All
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Delegate Modal */}
      {showDelegate && (
        <DelegateModal
          onClose={() => setShowDelegate(false)}
          onConfirm={handleDelegate}
          isLoading={delegating}
        />
      )}
    </div>
  )
}
