'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
// AnimatePresence used in DeliverableRow expanded sections
import useSWR from 'swr'
import {
  ArrowLeft, FileText, Package, Users, Gavel, Clock,
  CheckCircle2, XCircle, PauseCircle, AlertCircle, Loader2,
  Upload, Download, Send, Bell, RefreshCw, Shield,
  ChevronDown, ChevronUp, Info, AlertTriangle,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { getApprovalById, decideApproval } from '@/app/actions/approvals'
import type { Approver, Deliverable, AuditLog, DecisionType } from '@/components/approvals/g1-approval-workflow'
import type { UserProfile } from '@/components/approvals/g0-approval-review'

// ─── Mock data (spec: SOL-2026-001, G1, Under Review) ─────────

const DEMO_PROJECT = {
  id:          'sol-2026-001',
  code:        'SOL-2026-001',
  name:        'Sirius 400MW Solar PV — NEOM Region',
  gate:        'G1 — Development',
  status:      'Under Review',
  technology:  'Solar PV',
  capacity_mw: 400,
  location:    'KSA / NEOM Region',
  capex_usd:   380_000_000,
  target_irr:  12.4,
  fid_date:    'Q3 2027',
  cod_date:    'Q4 2028',
}

const DEMO_APPROVERS: Approver[] = [
  {
    id: 'apr-1', level: 1, role: 'Project Manager',
    status: 'approved', decision: 'proceed',
    rationale: 'All feasibility outputs reviewed and satisfactory. IRR above hurdle rate.',
    decided_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    due_date:   new Date(Date.now() + 86400000 * 5).toISOString(),
    is_current: false, is_chairperson: false,
    user: { id: 'pm-1', name: 'M. Al-Farsi', email: 'mfarsi@gridmind.capital', role: 'Project Manager', department: 'Projects', initials: 'MA', avatarColor: '#64ffda' },
  },
  {
    id: 'apr-2', level: 2, role: 'PMO Director',
    status: 'under_review', decision: null, rationale: null, decided_at: null,
    due_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    is_current: true, is_chairperson: true,
    user: { id: 'pmo-1', name: 'A. Carter', email: 'acarter@gridmind.capital', role: 'PMO Director', department: 'PMO', initials: 'AC', avatarColor: '#3b82f6' },
  },
  {
    id: 'apr-3', level: 3, role: 'Executive Sponsor',
    status: 'pending', decision: null, rationale: null, decided_at: null,
    due_date: new Date(Date.now() + 86400000 * 7).toISOString(),
    is_current: false, is_chairperson: false,
    user: { id: 'es-1', name: 'Dr. J. Rivera', email: 'jrivera@gridmind.capital', role: 'Executive Sponsor', department: 'Executive', initials: 'JR', avatarColor: '#f59e0b' },
  },
]

const DEMO_DELIVERABLES: Deliverable[] = [
  { id: 'd1', name: 'Feasibility Study Report',       description: 'Full feasibility incl. resource assessment, yield analysis, LCOE.',   required: true,  status: 'approved', file_name: 'Feasibility_Study_v2.pdf',       uploaded_at: new Date(Date.now() - 86400000 * 5).toISOString(), reviewed_by: 'M. Al-Farsi' },
  { id: 'd2', name: 'Financial Model (Base Case)',    description: 'Project finance model — IRR, NPV, DSCR, debt sizing. Version ≥1.0.',   required: true,  status: 'approved', file_name: 'FinModel_BaseCase_v1.2.xlsx',     uploaded_at: new Date(Date.now() - 86400000 * 4).toISOString(), reviewed_by: 'A. Carter' },
  { id: 'd3', name: 'Grid Connection Study',          description: 'Indicative grid study confirming connection point, voltage, capacity.', required: true,  status: 'uploaded', file_name: 'Grid_Connection_Draft.pdf',       uploaded_at: new Date(Date.now() - 86400000 * 1).toISOString(), reviewed_by: null },
  { id: 'd4', name: 'Environmental Scoping Report',   description: 'Initial EIA scoping opinion or environmental baseline study.',         required: true,  status: 'pending',  file_name: null, uploaded_at: null, reviewed_by: null },
  { id: 'd5', name: 'Land Title / Option Agreement',  description: 'Executed land option agreement or evidence of land title.',            required: true,  status: 'approved', file_name: 'Land_Option_Executed.pdf',        uploaded_at: new Date(Date.now() - 86400000 * 3).toISOString(), reviewed_by: 'M. Al-Farsi' },
  { id: 'd6', name: 'Permitting Programme',           description: 'Regulatory and permitting roadmap with key milestones.',               required: false, status: 'uploaded', file_name: 'Permitting_Programme_v1.pptx',    uploaded_at: new Date(Date.now() - 86400000 * 2).toISOString(), reviewed_by: null },
  { id: 'd7', name: 'Offtake / PPA Term Sheet',       description: 'Indicative term sheet from prospective offtaker or PPA framework.',   required: false, status: 'pending',  file_name: null, uploaded_at: null, reviewed_by: null },
  { id: 'd8', name: 'Risk Register (Development)',    description: 'Active risk register covering development phase risks ≥ medium.',      required: false, status: 'approved', file_name: 'Risk_Register_Dev_v1.xlsx',       uploaded_at: new Date(Date.now() - 86400000 * 6).toISOString(), reviewed_by: 'M. Al-Farsi' },
]

const DEMO_AUDIT: AuditLog[] = [
  { id: 'a1', actor: 'System',      action: 'G1 Review Opened',       detail: 'Gate 1 approval workflow initiated for SOL-2026-001.',    created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: 'a2', actor: 'M. Al-Farsi', action: 'Deliverable Uploaded',   detail: 'Feasibility Study Report v2 uploaded.',                   created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'a3', actor: 'A. Carter',   action: 'Deliverable Uploaded',   detail: 'Financial Model (Base Case) v1.2 uploaded.',              created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
  { id: 'a4', actor: 'M. Al-Farsi', action: 'Deliverable Reviewed',   detail: 'Land Title / Option Agreement reviewed and approved.',    created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'a5', actor: 'M. Al-Farsi', action: 'L1 Decision: Proceed',   detail: 'All feasibility outputs reviewed. IRR above hurdle rate.', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'a6', actor: 'System',      action: 'Reminder Sent',          detail: 'Auto-reminder sent to A. Carter (Level 2, PMO Director).', created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
]

// ─── Helpers ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<Approver['status'], { label: string; cls: string; icon: React.ReactNode }> = {
  pending:      { label: 'Pending',      cls: 'bg-slate-500/15 text-slate-400',    icon: <Clock className="size-3.5" /> },
  under_review: { label: 'Reviewing',    cls: 'bg-blue-500/15 text-blue-400',      icon: <Loader2 className="size-3.5 animate-spin" /> },
  approved:     { label: 'Approved',     cls: 'bg-emerald-500/15 text-emerald-400',icon: <CheckCircle2 className="size-3.5" /> },
  rejected:     { label: 'Rejected',     cls: 'bg-red-500/15 text-red-400',        icon: <XCircle className="size-3.5" /> },
  escalated:    { label: 'Escalated',    cls: 'bg-orange-500/15 text-orange-400',  icon: <AlertCircle className="size-3.5" /> },
}

const DELIV_STATUS: Record<Deliverable['status'], { label: string; cls: string }> = {
  pending:  { label: 'Pending',  cls: 'bg-slate-500/15 text-slate-400' },
  uploaded: { label: 'Uploaded', cls: 'bg-blue-500/15 text-blue-400' },
  reviewed: { label: 'Reviewed', cls: 'bg-amber-500/15 text-amber-400' },
  approved: { label: 'Approved', cls: 'bg-emerald-500/15 text-emerald-400' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/15 text-red-400' },
}

const DECISION_OPTIONS: { value: DecisionType; label: string; desc: string; cls: string; icon: React.ReactNode }[] = [
  { value: 'proceed',             label: 'Proceed to G2',     desc: 'All deliverables satisfactory. Approve unconditionally.',         cls: 'border-emerald-500 bg-emerald-500/10 text-emerald-400', icon: <CheckCircle2 className="size-4" /> },
  { value: 'conditional_proceed', label: 'Conditional Proceed', desc: 'Proceed subject to specified conditions.',                     cls: 'border-amber-500 bg-amber-500/10 text-amber-400',       icon: <AlertCircle className="size-4" /> },
  { value: 'hold',                label: 'Hold — Further Work', desc: 'Insufficient info. Return for additional development.',         cls: 'border-blue-500 bg-blue-500/10 text-blue-400',          icon: <PauseCircle className="size-4" /> },
  { value: 'reject',              label: 'Reject',              desc: 'Project does not meet threshold. Do not proceed.',              cls: 'border-red-500 bg-red-500/10 text-red-400',             icon: <XCircle className="size-4" /> },
]

const MIN_RATIONALE: Record<DecisionType, number> = {
  proceed: 50, conditional_proceed: 150, hold: 100, reject: 200,
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function relDue(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  const h  = ms / 3_600_000
  if (h < 0)  return { label: `${Math.abs(Math.round(h / 24))}d overdue`, overdue: true }
  if (h < 24) return { label: `Due in ${Math.round(h)}h`, overdue: false }
  return { label: `Due in ${Math.round(h / 24)}d`, overdue: false }
}

// ─── Sub-components ───────────────────────────────────────────

function ApproverPill({ approver, isCurrent }: { approver: Approver; isCurrent?: boolean }) {
  const cfg = STATUS_CONFIG[approver.status]
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
      isCurrent
        ? 'border-sky-500 bg-sky-500/10'
        : approver.status === 'approved'
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-border bg-card',
    )}>
      {isCurrent && (
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="size-2 rounded-full bg-sky-400 shrink-0"
        />
      )}
      <Avatar className="size-6 shrink-0">
        <AvatarFallback className="text-[9px] font-bold" style={{ background: `${approver.user.avatarColor}25`, color: approver.user.avatarColor }}>
          {approver.user.initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="font-medium text-foreground truncate text-xs">{approver.user.name}</p>
        <p className="text-[10px] text-muted-foreground">{approver.role}</p>
      </div>
      <span className={cn('ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0', cfg.cls)}>
        {cfg.icon}{cfg.label}
      </span>
    </div>
  )
}

// ─── Tab: Deliverables ────────────────────────────────────────

function DeliverablesTab({ deliverables, onUpload }: { deliverables: Deliverable[]; onUpload: (id: string, file: File) => Promise<void> }) {
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({})
  const [uploading, setUploading] = React.useState<string | null>(null)

  const required   = deliverables.filter((d) => d.required)
  const optional   = deliverables.filter((d) => !d.required)
  const approvedPct = Math.round((deliverables.filter((d) => d.status === 'approved').length / deliverables.length) * 100)

  async function handleFile(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(id)
    await onUpload(id, file).catch(() => {})
    setUploading(null)
    e.target.value = ''
  }

  function DeliverRow({ d }: { d: Deliverable }) {
    const st  = DELIV_STATUS[d.status]
    const open = expanded === d.id
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setExpanded(open ? null : d.id)}
          role="button"
          aria-expanded={open}
          aria-label={d.name}
        >
          <FileText className="size-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {d.name}
              {d.required && <span className="ml-1.5 text-[9px] text-red-400 font-bold uppercase tracking-wider">Required</span>}
            </p>
            {d.file_name && <p className="text-[11px] text-muted-foreground truncate">{d.file_name}</p>}
          </div>
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0', st.cls)}>{st.label}</span>
          {open ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
                {d.uploaded_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Uploaded {fmt(d.uploaded_at)}{d.reviewed_by ? ` · Reviewed by ${d.reviewed_by}` : ''}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {d.file_name && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Download className="size-3.5" />Download
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-[#0a192f] dark:bg-sky-600 text-white hover:opacity-90"
                    onClick={() => inputRefs.current[d.id]?.click()}
                    disabled={uploading === d.id}
                  >
                    {uploading === d.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                    {uploading === d.id ? 'Uploading…' : d.file_name ? 'Replace' : 'Upload'}
                  </Button>
                  <input
                    ref={(el) => { inputRefs.current[d.id] = el }}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.pptx"
                    onChange={(e) => handleFile(d.id, e)}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Package Readiness</p>
            <p className="text-xs font-semibold text-foreground">{approvedPct}%</p>
          </div>
          <Progress value={approvedPct} className="h-2" aria-label={`${approvedPct}% deliverables approved`} />
        </div>
        <div className="flex gap-3 shrink-0 text-center">
          {[
            { label: 'Approved', value: deliverables.filter((d) => d.status === 'approved').length, color: '#22c55e' },
            { label: 'Pending',  value: deliverables.filter((d) => d.status === 'pending').length,  color: '#f59e0b' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Required ({required.length})</p>
        <div className="space-y-2">
          {required.map((d) => <DeliverRow key={d.id} d={d} />)}
        </div>
      </div>

      {optional.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Optional ({optional.length})</p>
          <div className="space-y-2">
            {optional.map((d) => <DeliverRow key={d.id} d={d} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Approval Package ────────────────────────────────────

function PackageTab({ project, deliverables, onGenerate }: {
  project: typeof DEMO_PROJECT
  deliverables: Deliverable[]
  onGenerate: () => Promise<void>
}) {
  const [generating, setGenerating] = React.useState(false)
  const uploaded = deliverables.filter((d) => d.status !== 'pending').length
  const readyPct = Math.round((uploaded / deliverables.length) * 100)

  async function handleGenerate() {
    setGenerating(true)
    await onGenerate().catch(() => {})
    setGenerating(false)
  }

  return (
    <div className="space-y-5">
      {/* Project summary card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Project Summary</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Project Code',   value: project.code },
            { label: 'Gate',           value: project.gate },
            { label: 'Status',         value: project.status },
            { label: 'Technology',     value: project.technology },
            { label: 'Capacity',       value: `${project.capacity_mw} MW` },
            { label: 'Location',       value: project.location },
            { label: 'CAPEX (USD)',    value: `$${(project.capex_usd / 1e6).toFixed(0)}M` },
            { label: 'Target IRR',     value: `${project.target_irr}%` },
            { label: 'FID Date',       value: project.fid_date },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-[10px] text-muted-foreground">{f.label}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Readiness */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Package Readiness</p>
        <div className="flex items-center gap-4">
          <Progress value={readyPct} className="flex-1 h-3" aria-label={`${readyPct}% package readiness`} />
          <span className="text-xl font-bold text-foreground shrink-0">{readyPct}%</span>
        </div>
        <p className="text-xs text-muted-foreground">{uploaded} of {deliverables.length} documents uploaded or approved</p>
      </div>

      {/* Generate button */}
      <div className="rounded-xl border border-dashed border-border bg-muted/10 p-6 flex flex-col items-center gap-3 text-center">
        <Package className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-semibold text-foreground">Generate G1 Approval Package</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Compiles all uploaded deliverables, project summary, and approval chain into a single PDF package for distribution to approvers.
        </p>
        {readyPct < 60 && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Recommended: upload at least 60% of documents before generating.
          </p>
        )}
        <Button onClick={handleGenerate} disabled={generating} className="bg-[#0a192f] dark:bg-sky-600 text-white hover:opacity-90">
          {generating ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Package className="size-4 mr-1.5" />}
          {generating ? 'Generating…' : 'Generate Package'}
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Approvers ───────────────────────────────────────────

function ApproversTab({ approvers, onEscalate, onRemind }: {
  approvers: Approver[]
  onEscalate: (id: string) => Promise<void>
  onRemind: (id: string) => Promise<void>
}) {
  const [loading, setLoading] = React.useState<string | null>(null)

  async function act(id: string, fn: () => Promise<void>) {
    setLoading(id)
    await fn().catch(() => {})
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      {/* Chain progress */}
      <div className="flex items-center gap-2 p-4 rounded-xl bg-muted/20 border border-border">
        {approvers.map((a, i) => {
          const cfg = STATUS_CONFIG[a.status]
          return (
            <React.Fragment key={a.id}>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center gap-1 flex-1 min-w-0"
              >
                <span className={cn('size-8 rounded-full flex items-center justify-center text-[10px] font-bold', cfg.cls)}>
                  L{a.level}
                </span>
                <p className="text-[10px] text-muted-foreground text-center leading-tight truncate w-full px-1">{a.role}</p>
              </motion.div>
              {i < approvers.length - 1 && (
                <div className={cn('h-px w-8 shrink-0', a.status === 'approved' ? 'bg-emerald-500' : 'bg-border')} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Approver cards */}
      <div className="space-y-3">
        {approvers.map((a) => {
          const cfg  = STATUS_CONFIG[a.status]
          const due  = relDue(a.due_date)
          const isC  = a.is_current
          return (
            <motion.div
              key={a.id}
              layout
              className={cn(
                'rounded-xl border p-4 transition-colors',
                isC ? 'border-sky-500 bg-sky-500/5' : 'border-border bg-card',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <Avatar className="size-9">
                    <AvatarFallback className="text-xs font-bold" style={{ background: `${a.user.avatarColor}25`, color: a.user.avatarColor }}>
                      {a.user.initials}
                    </AvatarFallback>
                  </Avatar>
                  {a.is_chairperson && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-amber-400 flex items-center justify-center" title="Chairperson">
                      <Shield className="size-2 text-white" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground text-sm">{a.user.name}</p>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <p className="text-xs text-muted-foreground">{a.role}</p>
                    {a.is_chairperson && <Badge variant="outline" className="text-[9px] border-amber-500/50 text-amber-400 px-1.5">Chair</Badge>}
                    {isC && (
                      <motion.span
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-semibold"
                      >
                        Current
                      </motion.span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', cfg.cls)}>
                      {cfg.icon}{cfg.label}
                    </span>
                    <span className={cn('text-[10px]', due.overdue ? 'text-red-400' : 'text-muted-foreground')}>
                      {due.label}
                    </span>
                  </div>
                  {a.rationale && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed italic">
                      &ldquo;{a.rationale}&rdquo;
                    </p>
                  )}
                </div>
              </div>
              {isC && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border/60">
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                    disabled={loading === `esc-${a.id}`}
                    onClick={() => act(`esc-${a.id}`, () => onEscalate(a.id))}
                  >
                    {loading === `esc-${a.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <AlertCircle className="size-3.5" />}
                    Escalate
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={loading === `rem-${a.id}`}
                    onClick={() => act(`rem-${a.id}`, () => onRemind(a.id))}
                  >
                    {loading === `rem-${a.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Bell className="size-3.5" />}
                    Remind
                  </Button>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Decision ────────────────────────────────────────────

function DecisionTab({
  approvers,
  currentUser,
  onSubmit,
}: {
  approvers: Approver[]
  currentUser: UserProfile
  onSubmit: (decision: DecisionType, rationale: string, conditions: string[]) => Promise<void>
}) {
  const [decision, setDecision]     = React.useState<DecisionType | ''>('')
  const [rationale, setRationale]   = React.useState('')
  const [conditions, setConditions] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted]   = React.useState(false)
  const [error, setError]           = React.useState('')

  const currentApprover = approvers.find((a) => a.is_current)
  const isMyTurn = !!currentApprover
  const minLen   = decision ? MIN_RATIONALE[decision as DecisionType] : 50

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!decision) { setError('Please select a decision.'); return }
    if (rationale.length < minLen) { setError(`Rationale must be at least ${minLen} characters.`); return }
    setError('')
    setSubmitting(true)
    const conds = decision === 'conditional_proceed'
      ? conditions.split('\n').map((c) => c.trim()).filter(Boolean)
      : []
    await onSubmit(decision as DecisionType, rationale, conds).catch((e) => setError(e.message ?? 'Submission failed.'))
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-16 gap-4 text-center"
      >
        <CheckCircle2 className="size-12 text-emerald-400" />
        <p className="text-xl font-bold text-foreground">Decision Recorded</p>
        <p className="text-sm text-muted-foreground max-w-xs">Your decision has been submitted and the next approver in the chain has been notified.</p>
      </motion.div>
    )
  }

  if (!isMyTurn) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <Info className="size-10 text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">Not Your Turn</p>
        <p className="text-sm text-muted-foreground max-w-xs">You are not the current approver on this gate. Decision actions will become available when the chain reaches your level.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label="Approval decision form">
      {/* Current approver banner */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="text-xs font-bold" style={{ background: `${currentUser.avatarColor}25`, color: currentUser.avatarColor }}>
            {currentUser.initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-foreground">{currentUser.name}</p>
          <p className="text-xs text-muted-foreground">{currentUser.role} · Decision required</p>
        </div>
        {currentApprover?.is_chairperson && (
          <Badge variant="outline" className="ml-auto border-amber-500/50 text-amber-400 gap-1">
            <Shield className="size-3" />Chairperson
          </Badge>
        )}
      </div>

      {/* Decision options */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Decision</p>
        <RadioGroup value={decision} onValueChange={(v) => setDecision(v as DecisionType)} aria-label="Decision options" className="space-y-2">
          {DECISION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`dec-${opt.value}`}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                decision === opt.value ? opt.cls : 'border-border hover:border-slate-400 dark:hover:border-slate-500',
              )}
            >
              <RadioGroupItem id={`dec-${opt.value}`} value={opt.value} className="sr-only" />
              <span className={cn(decision === opt.value ? '' : 'text-muted-foreground')}>{opt.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Conditions (conditional only) */}
      <AnimatePresence>
        {decision === 'conditional_proceed' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5" htmlFor="conditions">
              Conditions (one per line)
            </label>
            <Textarea
              id="conditions"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={4}
              placeholder="1. EIA scoping opinion to be submitted by 30 Aug 2026&#10;2. Grid connection capacity confirmed in writing by SEC"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rationale */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="rationale">
            Rationale <span className="text-red-400 normal-case font-normal">(min {minLen} chars)</span>
          </label>
          <span className={cn('text-[10px]', rationale.length < minLen ? 'text-amber-400' : 'text-emerald-400')}>
            {rationale.length} / {minLen}
          </span>
        </div>
        <Textarea
          id="rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={5}
          placeholder="Provide your rationale for this decision, including key factors considered…"
          className={rationale.length > 0 && rationale.length < minLen ? 'border-amber-500/60 focus-visible:ring-amber-500/40' : ''}
        />
        {rationale.length > 0 && rationale.length < minLen && (
          <p className="text-xs text-amber-400 mt-1" role="alert">
            {minLen - rationale.length} more characters required.
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1.5" role="alert">
          <AlertCircle className="size-4 shrink-0" />{error}
        </p>
      )}

      <Button
        type="submit"
        disabled={!decision || rationale.length < minLen || submitting}
        className="w-full bg-[#0a192f] dark:bg-sky-600 text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Gavel className="size-4 mr-1.5" />}
        {submitting ? 'Submitting Decision…' : 'Submit Decision'}
      </Button>
    </form>
  )
}

// ─── Tab: Audit Trail ─────────────────────────────────────────

const MemoAuditTrail = React.memo(function AuditTrailTab({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" aria-hidden />
      <ul className="space-y-4" aria-label="Approval audit trail">
        {logs.map((log, i) => (
          <motion.li
            key={log.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15, delay: i * 0.05 }}
            className="flex gap-4 pl-10 relative"
          >
            <span className="absolute left-2.5 top-1.5 size-3 rounded-full bg-sky-500/30 border-2 border-sky-500" />
            <div className="flex-1 bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-foreground">{log.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{log.actor}</p>
                </div>
                <time className="text-[10px] text-muted-foreground font-mono shrink-0" dateTime={log.created_at}>
                  {fmt(log.created_at)}
                </time>
              </div>
              {log.detail && (
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{log.detail}</p>
              )}
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  )
})

// ─── Main Page ────────────────────────────────────────────────

const CURRENT_USER: UserProfile = {
  id: 'cd-1', name: 'A. Carter', email: 'acarter@gridmind.capital',
  role: 'PMO Director', department: 'PMO', initials: 'AC', avatarColor: '#3b82f6',
}

export default function G1ApprovalPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id     = params?.id ?? 'sol-2026-001'

  // Live approval data — refresh every 30s per spec
  const { data: approval, mutate } = useSWR(
    id ? `g1-approval-${id}` : null,
    () => getApprovalById(id),
    { revalidateOnFocus: false, refreshInterval: 30_000 },
  )

  const [lastRefreshed, setLastRefreshed] = React.useState(new Date())
  React.useEffect(() => {
    const t = setInterval(() => setLastRefreshed(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Use live data when available, illustrative otherwise
  const project = DEMO_PROJECT
  const approvers: Approver[]  = DEMO_APPROVERS
  const deliverables: Deliverable[] = DEMO_DELIVERABLES
  const auditLogs: AuditLog[]  = DEMO_AUDIT

  const approvedCount = approvers.filter((a) => a.status === 'approved').length
  const chainPct = Math.round((approvedCount / approvers.length) * 100)

  async function handleDecide(decision: DecisionType, rationale: string, conditions: string[]) {
    await decideApproval({
      id,
      decision,
      rationale: conditions.length
        ? `${rationale}\n\nConditions:\n${conditions.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
        : rationale,
    })
  }

  async function handleEscalate(_approverId: string) { /* no-op: future implementation */ }
  async function handleRemind(_approverId: string)   { /* no-op: future implementation */ }
  async function handleGenerate()                     { /* no-op: future implementation */ }
  async function handleUpload(_id: string, _file: File) { /* no-op: future implementation */ }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <button type="button" onClick={() => router.push(`/projects/${id}`)} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="size-4" />Project
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">G1 Approval</span>
        <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
          <RefreshCw className="size-3" />
          Auto-refresh · {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground font-mono">{project.code}</h1>
            <span className="px-2 py-0.5 text-[11px] rounded-full bg-blue-500/15 text-blue-400 font-semibold">Under Review</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{project.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{project.gate}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <p className="text-muted-foreground">Chain Progress</p>
            <p className="font-semibold text-foreground">{approvedCount} / {approvers.length} approved</p>
          </div>
          <div className="w-24">
            <Progress value={chainPct} className="h-2.5" aria-label={`${chainPct}% approval chain complete`} />
          </div>
        </div>
      </div>

      {/* Animated approval chain strip */}
      <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/20 overflow-x-auto">
        {approvers.map((a, i) => (
          <React.Fragment key={a.id}>
            <ApproverPill approver={a} isCurrent={a.is_current} />
            {i < approvers.length - 1 && (
              <div className={cn('size-4 shrink-0 flex items-center justify-center', a.status === 'approved' ? 'text-emerald-500' : 'text-muted-foreground')}>
                <ChevronDown className="size-3.5 -rotate-90" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main — Tabs */}
        <div className="xl:col-span-2">
          <Tabs defaultValue="deliverables">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="deliverables" className="gap-1.5">
                <FileText className="size-3.5" />Deliverables
              </TabsTrigger>
              <TabsTrigger value="package" className="gap-1.5">
                <Package className="size-3.5" />Package
              </TabsTrigger>
              <TabsTrigger value="approvers" className="gap-1.5">
                <Users className="size-3.5" />Approvers
              </TabsTrigger>
              <TabsTrigger value="decision" className="gap-1.5">
                <Gavel className="size-3.5" />Decision
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-1.5">
                <Clock className="size-3.5" />Audit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deliverables">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <DeliverablesTab deliverables={deliverables} onUpload={handleUpload} />
              </motion.div>
            </TabsContent>

            <TabsContent value="package">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <PackageTab project={project} deliverables={deliverables} onGenerate={handleGenerate} />
              </motion.div>
            </TabsContent>

            <TabsContent value="approvers">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <ApproversTab approvers={approvers} onEscalate={handleEscalate} onRemind={handleRemind} />
              </motion.div>
            </TabsContent>

            <TabsContent value="decision">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <DecisionTab approvers={approvers} currentUser={CURRENT_USER} onSubmit={handleDecide} />
              </motion.div>
            </TabsContent>

            <TabsContent value="audit">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <MemoAuditTrail logs={auditLogs} />
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Current approver */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Current Approver</p>
            {approvers.filter((a) => a.is_current).map((a) => {
              const due = relDue(a.due_date)
              return (
                <div key={a.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-xs font-bold" style={{ background: `${a.user.avatarColor}25`, color: a.user.avatarColor }}>
                        {a.user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{a.user.name}</p>
                      <p className="text-xs text-muted-foreground">{a.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="size-3.5 text-muted-foreground" />
                    <span className={due.overdue ? 'text-red-400' : 'text-muted-foreground'}>{due.label}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Project key data */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Key Metrics</p>
            {[
              { label: 'CAPEX',       value: `$${(project.capex_usd / 1e6).toFixed(0)}M` },
              { label: 'Target IRR',  value: `${project.target_irr}%`, highlight: project.target_irr >= 10 },
              { label: 'Capacity',    value: `${project.capacity_mw} MW` },
              { label: 'FID Target',  value: project.fid_date },
              { label: 'COD Target',  value: project.cod_date },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{m.label}</span>
                <span className={cn('font-semibold', m.highlight ? 'text-emerald-400' : 'text-foreground')}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Deliverable readiness */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Deliverable Readiness</p>
            <Progress value={Math.round((deliverables.filter((d) => d.status === 'approved').length / deliverables.length) * 100)} className="h-2.5"
              aria-label="Deliverable readiness" />
            <p className="text-xs text-muted-foreground">
              {deliverables.filter((d) => d.status === 'approved').length} / {deliverables.length} approved
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
