'use client'

import * as React from 'react'
import {
  CheckCircle2, Clock, AlertCircle, XCircle, PauseCircle,
  ChevronRight, FileText, Upload, Download, Send, Bell,
  User, Shield, Gavel, ChevronDown, ChevronUp, Loader2,
  ArrowRight, Info, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/components/approvals/g0-approval-review'
import type { G1FormData } from '@/app/actions/gate-submissions'

// ─── Types ────────────────────────────────────────────────────

export type DecisionType = 'proceed' | 'conditional_proceed' | 'hold' | 'reject'

export interface Deliverable {
  id: string
  name: string
  description: string
  required: boolean
  status: 'pending' | 'uploaded' | 'reviewed' | 'approved' | 'rejected'
  file_name: string | null
  uploaded_at: string | null
  reviewed_by: string | null
}

export interface Approver {
  id: string
  user: UserProfile
  level: number
  role: string
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'escalated'
  decision: DecisionType | null
  rationale: string | null
  decided_at: string | null
  due_date: string
  is_current: boolean
  is_chairperson: boolean
}

export interface AuditLog {
  id: string
  actor: string
  action: string
  detail: string | null
  created_at: string
}

export interface G1ApprovalWorkflowProps {
  project: {
    id: string
    name: string
    code: string
    technology?: string
    capacity_mw?: number
    location?: string
    capex_usd?: number
    target_irr?: number
  }
  deliverables: Deliverable[]
  approvers: Approver[]
  auditTrail: AuditLog[]
  currentApprover: UserProfile | null
  isChairperson: boolean
  onSubmitDecision: (decision: DecisionType, rationale: string, conditions?: string[]) => Promise<void>
  onEscalate: (approverId: string) => Promise<void>
  onRemind: (approverId: string) => Promise<void>
  onGeneratePackage: () => Promise<void>
  onUploadDeliverable: (deliverableId: string, file: File) => Promise<void>
  g1Data?: Partial<G1FormData>
}

// ─── Helpers ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<Approver['status'], { label: string; icon: React.ReactNode; className: string }> = {
  pending:      { label: 'Pending',      icon: <Clock className="size-3.5" />,        className: 'bg-amber-500/15 text-amber-400' },
  under_review: { label: 'Under Review', icon: <Loader2 className="size-3.5 animate-spin" />, className: 'bg-blue-500/15 text-blue-400' },
  approved:     { label: 'Approved',     icon: <CheckCircle2 className="size-3.5" />, className: 'bg-emerald-500/15 text-emerald-400' },
  rejected:     { label: 'Rejected',     icon: <XCircle className="size-3.5" />,      className: 'bg-red-500/15 text-red-400' },
  escalated:    { label: 'Escalated',    icon: <AlertCircle className="size-3.5" />,  className: 'bg-orange-500/15 text-orange-400' },
}

const DELIVERABLE_STATUS: Record<Deliverable['status'], { label: string; className: string }> = {
  pending:  { label: 'Pending',  className: 'bg-slate-500/15 text-slate-400' },
  uploaded: { label: 'Uploaded', className: 'bg-blue-500/15 text-blue-400' },
  reviewed: { label: 'Reviewed', className: 'bg-amber-500/15 text-amber-400' },
  approved: { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-400' },
  rejected: { label: 'Rejected', className: 'bg-red-500/15 text-red-400' },
}

const DECISION_OPTIONS: {
  value: DecisionType
  label: string
  description: string
  icon: React.ReactNode
  selectedClass: string
}[] = [
  {
    value: 'proceed',
    label: 'Proceed to G2',
    description: 'All deliverables are satisfactory. Approve unconditionally.',
    icon: <CheckCircle2 className="size-4" />,
    selectedClass: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
  },
  {
    value: 'conditional_proceed',
    label: 'Conditional Proceed',
    description: 'Proceed subject to specified conditions being met.',
    icon: <AlertCircle className="size-4" />,
    selectedClass: 'border-amber-500 bg-amber-500/10 text-amber-400',
  },
  {
    value: 'hold',
    label: 'Hold — Further Work',
    description: 'Insufficient information. Return for additional development.',
    icon: <PauseCircle className="size-4" />,
    selectedClass: 'border-blue-500 bg-blue-500/10 text-blue-400',
  },
  {
    value: 'reject',
    label: 'Reject',
    description: 'Project does not meet the threshold. Do not proceed.',
    icon: <XCircle className="size-4" />,
    selectedClass: 'border-red-500 bg-red-500/10 text-red-400',
  },
]

function StatusBadge({ status }: { status: Approver['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', cfg.className)}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function DeliverableBadge({ status }: { status: Deliverable['status'] }) {
  const cfg = DELIVERABLE_STATUS[status]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', cfg.className)}>
      {cfg.label}
    </span>
  )
}

function Avatar({ user, size = 'md' }: { user: UserProfile; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'size-6 text-[9px]' : 'size-8 text-xs'
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full font-bold shrink-0', sz)}
      style={{ background: `${user.avatarColor ?? '#64ffda'}25`, color: user.avatarColor ?? '#64ffda' }}
    >
      {user.initials}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
      {children}
    </p>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-5', className)}>
      {children}
    </div>
  )
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function relDue(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  const h = ms / 3_600_000
  if (h < 0) return { label: `${Math.abs(Math.round(h / 24))}d overdue`, overdue: true }
  if (h < 24) return { label: `Due in ${Math.round(h)}h`, overdue: false }
  return { label: `Due in ${Math.round(h / 24)}d`, overdue: false }
}

// ─── Deliverable upload row ───────────────────────────────────

function DeliverableRow({
  item,
  onUpload,
}: {
  item: Deliverable
  onUpload: (file: File) => Promise<void>
}) {
  const [uploading, setUploading] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    await onUpload(file).catch(() => {})
    setUploading(false)
    e.target.value = ''
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700/60 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        aria-expanded={expanded}
      >
        <FileText className="size-4 text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {item.name}
            {item.required && <span className="text-red-400 ml-1 text-[10px]">REQUIRED</span>}
          </p>
          {item.file_name && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.file_name}</p>
          )}
        </div>
        <DeliverableBadge status={item.status} />
        {expanded ? <ChevronUp className="size-3.5 text-slate-400" /> : <ChevronDown className="size-3.5 text-slate-400" />}
      </div>

      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700/60 px-4 py-3 bg-slate-50 dark:bg-slate-800/30 space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">{item.description}</p>
          {item.uploaded_at && (
            <p className="text-[11px] text-slate-500">
              Uploaded {fmt(item.uploaded_at)}{item.reviewed_by ? ` · Reviewed by ${item.reviewed_by}` : ''}
            </p>
          )}
          <div className="flex items-center gap-2">
            {item.file_name && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Download className="size-3.5" />
                Download
              </button>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#0a192f] dark:bg-sky-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {uploading ? 'Uploading…' : item.file_name ? 'Replace' : 'Upload'}
            </button>
            <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.xlsx,.pptx" onChange={handleFile} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Approver chain row ───────────────────────────────────────

function ApproverRow({
  approver,
  isLast,
  onEscalate,
  onRemind,
}: {
  approver: Approver
  isLast: boolean
  onEscalate: () => void
  onRemind: () => void
}) {
  const [acting, setActing] = React.useState(false)
  const due = relDue(approver.due_date)

  async function handle(fn: () => void) {
    setActing(true)
    fn()
    setActing(false)
  }

  return (
    <div className="flex items-start gap-3">
      {/* connector */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className={cn(
          'size-7 rounded-full flex items-center justify-center text-[10px] font-bold',
          approver.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
          approver.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
          approver.is_current ? 'bg-sky-500/20 text-sky-400 ring-2 ring-sky-500/40' :
          'bg-slate-200 dark:bg-slate-700 text-slate-500'
        )}>
          {approver.level}
        </div>
        {!isLast && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1 min-h-[20px]" />}
      </div>

      <div className="flex-1 min-w-0 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Avatar user={approver.user} size="sm" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-none">
                {approver.user.name}
                {approver.is_chairperson && (
                  <span className="ml-1.5 text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Chair</span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{approver.role}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <StatusBadge status={approver.status} />
            <span className={cn('text-[10px] font-medium', due.overdue ? 'text-red-400' : 'text-slate-500 dark:text-slate-400')}>
              {due.label}
            </span>
          </div>
        </div>

        {approver.decision && (
          <div className="mt-2 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Decision: <span className="capitalize font-medium text-slate-700 dark:text-slate-300">{approver.decision.replace('_', ' ')}</span>
              {approver.decided_at && ` · ${fmt(approver.decided_at)}`}
            </p>
            {approver.rationale && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 italic">&ldquo;{approver.rationale}&rdquo;</p>
            )}
          </div>
        )}

        {approver.is_current && approver.status === 'pending' && (
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => handle(onRemind)}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <Bell className="size-3" /> Send Reminder
            </button>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <button
              type="button"
              disabled={acting}
              onClick={() => handle(onEscalate)}
              className="flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-400 transition-colors"
            >
              <ArrowRight className="size-3" /> Escalate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Decision Panel ───────────────────────────────────────────

function DecisionPanel({
  onSubmit,
  isChairperson,
}: {
  onSubmit: (decision: DecisionType, rationale: string, conditions?: string[]) => Promise<void>
  isChairperson: boolean
}) {
  const [decision, setDecision] = React.useState<DecisionType | null>(null)
  const [rationale, setRationale] = React.useState('')
  const [conditionsRaw, setConditionsRaw] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  const MIN_RATIONALE: Record<DecisionType, number> = {
    proceed: 50, conditional_proceed: 100, hold: 80, reject: 100,
  }

  const minChars = decision ? MIN_RATIONALE[decision] : 50
  const canSubmit = decision && rationale.length >= minChars

  async function handleSubmit() {
    if (!decision || !canSubmit) return
    setSubmitting(true)
    const conditions = decision === 'conditional_proceed'
      ? conditionsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
      : undefined
    await onSubmit(decision, rationale, conditions).catch(() => {})
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="size-10 text-emerald-400" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Decision Recorded</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Your {decision?.replace('_', ' ')} decision has been submitted.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <div className="size-7 rounded-lg bg-[#64ffda]/10 flex items-center justify-center">
          <Gavel className="size-4 text-[#64ffda]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Submit Decision</p>
          {isChairperson && (
            <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">Chairperson Authority</p>
          )}
        </div>
      </div>

      {/* Decision options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {DECISION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDecision(opt.value)}
            className={cn(
              'text-left rounded-lg border p-3 transition-all',
              decision === opt.value
                ? opt.selectedClass
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300',
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {opt.icon}
              <span className="text-xs font-semibold">{opt.label}</span>
            </div>
            <p className="text-[10px] opacity-70">{opt.description}</p>
          </button>
        ))}
      </div>

      {/* Conditions (conditional_proceed only) */}
      {decision === 'conditional_proceed' && (
        <div className="mb-3">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
            Conditions <span className="text-slate-400">(one per line)</span>
          </label>
          <textarea
            value={conditionsRaw}
            onChange={(e) => setConditionsRaw(e.target.value)}
            rows={3}
            placeholder="1. Independent resource assessment to be submitted within 30 days&#10;2. Land title confirmed before FID"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>
      )}

      {/* Rationale */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
          Rationale <span className="text-red-400">*</span>
          <span className="text-slate-400 font-normal ml-1">(min {minChars} chars)</span>
        </label>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={4}
          placeholder="Provide your detailed rationale for this decision…"
          className={cn(
            'w-full rounded-lg border bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 transition-colors',
            rationale.length >= minChars
              ? 'border-emerald-400/60 focus:ring-emerald-500/30'
              : 'border-slate-200 dark:border-slate-700 focus:ring-sky-500/40',
          )}
        />
        <div className="flex justify-end mt-0.5">
          <span className={cn('text-[10px]', rationale.length >= minChars ? 'text-emerald-400' : 'text-slate-400')}>
            {rationale.length} / {minChars}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#0a192f] dark:bg-sky-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Gavel className="size-4" />}
        {submitting ? 'Submitting…' : 'Submit Decision'}
      </button>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────

type Tab = 'overview' | 'deliverables' | 'chain' | 'audit'

export function G1ApprovalWorkflow({
  project,
  deliverables,
  approvers,
  auditTrail,
  currentApprover,
  isChairperson,
  onSubmitDecision,
  onEscalate,
  onRemind,
  onGeneratePackage,
  onUploadDeliverable,
  g1Data,
}: G1ApprovalWorkflowProps) {
  const [activeTab, setActiveTab] = React.useState<Tab>('overview')
  const [generatingPkg, setGeneratingPkg] = React.useState(false)

  const requiredCount   = deliverables.filter((d) => d.required).length
  const uploadedCount   = deliverables.filter((d) => d.status !== 'pending').length
  const approvedCount   = approvers.filter((a) => a.status === 'approved').length
  const currentLevel    = approvers.find((a) => a.is_current)
  const overallStatus   = approvers.some((a) => a.status === 'rejected')
    ? 'rejected' : approvers.every((a) => a.status === 'approved')
    ? 'approved' : 'in_progress'

  const canDecide = !!currentApprover && (
    currentLevel?.user.id === currentApprover.id || isChairperson
  )

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview',     label: 'Overview' },
    { id: 'deliverables', label: 'Deliverables', count: deliverables.length },
    { id: 'chain',        label: 'Approval Chain', count: approvers.length },
    { id: 'audit',        label: 'Audit Trail', count: auditTrail.length },
  ]

  async function handleGeneratePackage() {
    setGeneratingPkg(true)
    await onGeneratePackage().catch(() => {})
    setGeneratingPkg(false)
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Gate 1 · Development Approval
            </span>
            <ChevronRight className="size-3 text-slate-400" />
            <span className="text-[10px] font-mono text-sky-500">{project.code}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            {project.technology && <span>{project.technology}</span>}
            {project.capacity_mw && <span>{project.capacity_mw} MW</span>}
            {project.location && <span>{project.location}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
            overallStatus === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
            overallStatus === 'rejected' ? 'bg-red-500/15 text-red-400' :
            'bg-amber-500/15 text-amber-400',
          )}>
            {overallStatus === 'approved' ? <CheckCircle2 className="size-3.5" /> :
             overallStatus === 'rejected' ? <XCircle className="size-3.5" /> :
             <Clock className="size-3.5" />}
            {overallStatus === 'in_progress' ? 'In Progress' :
             overallStatus === 'approved' ? 'Approved' : 'Rejected'}
          </span>
          <button
            type="button"
            onClick={handleGeneratePackage}
            disabled={generatingPkg}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {generatingPkg ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Generate Package
          </button>
        </div>
      </div>

      {/* ── Progress Bar ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-wrap gap-4 mb-4">
          {[
            { label: 'Approvers',     value: `${approvedCount} / ${approvers.length}`, accent: '#22c55e' },
            { label: 'Deliverables',  value: `${uploadedCount} / ${deliverables.length}`, accent: '#3b82f6' },
            { label: 'Current Level', value: currentLevel ? `Level ${currentLevel.level}` : '—', accent: '#f59e0b' },
            { label: 'Gate Status',   value: overallStatus === 'in_progress' ? 'In Progress' : overallStatus === 'approved' ? 'Approved' : 'Rejected', accent: overallStatus === 'approved' ? '#22c55e' : '#f59e0b' },
          ].map((kpi) => (
            <div key={kpi.label} className="flex-1 min-w-[100px]">
              <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5" style={{ color: kpi.accent }}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
        {/* Approval chain progress strip */}
        <div className="flex items-center gap-1">
          {approvers.map((a, i) => (
            <React.Fragment key={a.id}>
              <div
                className={cn(
                  'flex-1 h-1.5 rounded-full transition-colors',
                  a.status === 'approved' ? 'bg-emerald-400' :
                  a.status === 'rejected' ? 'bg-red-400' :
                  a.is_current ? 'bg-sky-400 animate-pulse' : 'bg-slate-200 dark:bg-slate-700',
                )}
                title={`Level ${a.level}: ${a.user.name} — ${a.status}`}
              />
              {i < approvers.length - 1 && (
                <ArrowRight className="size-3 text-slate-300 dark:text-slate-600 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors relative',
              activeTab === tab.id
                ? 'text-slate-900 dark:text-slate-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-sky-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* G1 Technical summary */}
              {g1Data && (
                <Card>
                  <SectionLabel>G1 Technical Data</SectionLabel>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {[
                      { label: 'Feasibility Status',   value: g1Data.feasibilityStatus ?? '—' },
                      { label: 'Feasibility Contractor', value: g1Data.feasibilityContractor || '—' },
                      { label: 'P50 Yield (GWh)',       value: g1Data.p50YieldGwh || '—' },
                      { label: 'P90 Yield (GWh)',       value: g1Data.p90YieldGwh || '—' },
                      { label: 'Base IRR',              value: g1Data.baseIrrPct ? `${g1Data.baseIrrPct}%` : '—' },
                      { label: 'Base DSCR (min)',       value: g1Data.baseDscrMin || '—' },
                      { label: 'LCOE (USD/MWh)',        value: g1Data.lcoeUsdMwh || '—' },
                      { label: 'EIA Status',            value: g1Data.eiaStatus ?? '—' },
                      { label: 'Grid Study',            value: g1Data.gridStudyStatus ?? '—' },
                      { label: 'Land Secured',          value: g1Data.landSecured ? 'Yes' : 'No' },
                      { label: 'FID Target',            value: g1Data.fidTargetDate || '—' },
                      { label: 'COD Target',            value: g1Data.codTargetDate || '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">{value}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Project financials */}
              {(project.capex_usd || project.target_irr) && (
                <Card>
                  <SectionLabel>Project Financials</SectionLabel>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {project.capex_usd && (
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Total CAPEX</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          ${(project.capex_usd / 1_000_000).toFixed(0)}M
                        </p>
                      </div>
                    )}
                    {project.target_irr && (
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Target IRR</p>
                        <p className={cn(
                          'text-lg font-bold',
                          project.target_irr >= 8 ? 'text-emerald-400' :
                          project.target_irr >= 5 ? 'text-amber-400' : 'text-red-400',
                        )}>
                          {project.target_irr}%
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Deliverables summary */}
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel>Deliverables Summary</SectionLabel>
                  <button
                    type="button"
                    onClick={() => setActiveTab('deliverables')}
                    className="text-xs text-sky-500 hover:text-sky-400 flex items-center gap-1"
                  >
                    View all <ChevronRight className="size-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {deliverables.slice(0, 4).map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300 truncate mr-3">{d.name}</span>
                      <DeliverableBadge status={d.status} />
                    </div>
                  ))}
                  {deliverables.length > 4 && (
                    <p className="text-xs text-slate-400">+{deliverables.length - 4} more</p>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Deliverables tab */}
          {activeTab === 'deliverables' && (
            <Card>
              <SectionLabel>Gate 1 Deliverables</SectionLabel>
              <div className="space-y-2">
                {deliverables.map((d) => (
                  <DeliverableRow
                    key={d.id}
                    item={d}
                    onUpload={(file) => onUploadDeliverable(d.id, file)}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Approval chain tab */}
          {activeTab === 'chain' && (
            <Card>
              <SectionLabel>Approval Chain</SectionLabel>
              <div className="space-y-0">
                {approvers.map((a, i) => (
                  <ApproverRow
                    key={a.id}
                    approver={a}
                    isLast={i === approvers.length - 1}
                    onEscalate={() => onEscalate(a.id)}
                    onRemind={() => onRemind(a.id)}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Audit trail tab */}
          {activeTab === 'audit' && (
            <Card>
              <SectionLabel>Audit Trail</SectionLabel>
              {auditTrail.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No audit events yet.</p>
              ) : (
                <div className="space-y-0">
                  {auditTrail.map((log, i) => (
                    <div key={log.id} className="flex gap-3 pb-4">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="size-2 rounded-full bg-slate-400 dark:bg-slate-500 mt-1.5" />
                        {i < auditTrail.length - 1 && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{log.action}</span>
                          <span className="text-[10px] text-slate-400">by {log.actor}</span>
                          <span className="text-[10px] text-slate-400">{fmt(log.created_at)}</span>
                        </div>
                        {log.detail && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{log.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ── Right sidebar ──────────────────────────────────── */}
        <div className="space-y-4">
          {/* Decision panel — only when eligible */}
          {canDecide && overallStatus === 'in_progress' && (
            <DecisionPanel onSubmit={onSubmitDecision} isChairperson={isChairperson} />
          )}

          {/* Current approver info */}
          {currentApprover && (
            <Card>
              <SectionLabel>Logged In As</SectionLabel>
              <div className="flex items-center gap-3">
                <Avatar user={currentApprover} />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{currentApprover.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{currentApprover.role}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{currentApprover.department}</p>
                </div>
              </div>
              {isChairperson && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold">
                  <Shield className="size-3" />
                  Chairperson — override authority
                </div>
              )}
              {!canDecide && overallStatus === 'in_progress' && (
                <div className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
                  <Info className="size-3 mt-0.5 shrink-0" />
                  Not your turn to decide. Awaiting Level {currentLevel?.level}.
                </div>
              )}
            </Card>
          )}

          {/* Pending approver quick-actions */}
          {currentLevel && currentLevel.status === 'pending' && (
            <Card>
              <SectionLabel>Pending Action</SectionLabel>
              <div className="flex items-center gap-2 mb-3">
                <Avatar user={currentLevel.user} size="sm" />
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{currentLevel.user.name}</p>
                  <p className="text-[10px] text-slate-400">Level {currentLevel.level} · {currentLevel.role}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onRemind(currentLevel.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Bell className="size-3.5" /> Remind
                </button>
                <button
                  type="button"
                  onClick={() => onEscalate(currentLevel.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-colors"
                >
                  <AlertTriangle className="size-3.5" /> Escalate
                </button>
              </div>
            </Card>
          )}

          {/* Deliverables readiness */}
          <Card>
            <SectionLabel>Deliverable Readiness</SectionLabel>
            <div className="flex items-end gap-2 mb-2">
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{uploadedCount}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">/ {deliverables.length} uploaded</p>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-3">
              <div
                className="bg-sky-500 h-1.5 rounded-full transition-all"
                style={{ width: deliverables.length ? `${(uploadedCount / deliverables.length) * 100}%` : '0%' }}
              />
            </div>
            {requiredCount > uploadedCount && (
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertCircle className="size-3" />
                {requiredCount - Math.min(uploadedCount, requiredCount)} required deliverable(s) outstanding
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
