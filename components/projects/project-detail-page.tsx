'use client'

import * as React from 'react'
import {
  FileText,
  MessageSquare,
  Users,
  Settings,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  ArrowRight,
  GitBranch,
  Info,
  Activity,
  Zap,
  ClipboardCheck,
  Send,
  RefreshCw,
} from 'lucide-react'
import { useRouter as useNextRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProjectCommandCenter, type ProjectData } from '@/components/project/project-command-center'
import { PhaseGateStepper, GATE_DEFINITIONS } from '@/components/project/phase-gate-stepper'
import { WorkflowTimeline, type WorkflowLogEntry } from '@/components/workflow/workflow-timeline'
import { ApprovalQueue } from '@/components/dashboard/approval-queue'
import { ClientAnnouncementsPanel } from '@/components/client/client-announcements-panel'
import type { ApprovalItem } from '@/components/dashboard/dashboard-data'
import type {
  Project,
  AuditLog,
  Approval,
  ProjectMember,
  Document,
  Comment,
} from '@/lib/project-types'

// ─────────────────────────────────────────────────────────────
// Spec mock data
// ─────────────────────────────────────────────────────────────

const SPEC_PROJECT: ProjectData = {
  id: 'proj-001',
  name: 'Al Dhafra Solar PV - Phase 1',
  code: 'SOL-2026-001',
  client: 'Emirates Water and Electricity Company',
  status: 'active',
  phase: 'g3',
  gate: 2,
  gateName: 'Engineering IFC Release',
  budgetUsd: 1_200_000_000,
  currency: 'USD',
  startDate: '2026-01-15',
  targetCod: '2028-06-30',
  location: 'Al Dhafra, Abu Dhabi, UAE',
  commentCount: 8,
  documentCount: 12,
}

const _T = (hrsAgo: number) => new Date(Date.now() - hrsAgo * 3_600_000).toISOString()

const SPEC_LOGS: WorkflowLogEntry[] = [
  { id: 'l1', action: 'workflow.approve',  object_type: 'Gate',     object_id: 'g1', object_code: 'G1 — Development Approval', actor_name: 'Sarah Al-Zaabi',  actor_role: 'PMO Director',    before_state: 'under_review', after_state: 'approved',  decision_reason: 'Development approval conditions fully satisfied. EWEC sign-off received.',          metadata: null,                                                  created_at: _T(1)   },
  { id: 'l2', action: 'workflow.submit',   object_type: 'Document', object_id: 'd1', object_code: 'IFC-DWG-REV-C',            actor_name: 'Ahmed Hassan',    actor_role: 'Lead Engineer',   before_state: 'draft',        after_state: 'submitted', decision_reason: null,                                                                              metadata: { detail: '164 IFC drawings submitted — REV C' },      created_at: _T(6)   },
  { id: 'l3', action: 'workflow.escalate', object_type: 'Finance',  object_id: 'f1', object_code: 'CONT-2026-014',            actor_name: 'James Thornton',  actor_role: 'Finance Lead',    before_state: 'pending',      after_state: 'escalated', decision_reason: 'Module cost escalation exceeds 5% threshold — CFO approval required.',              metadata: null,                                                  created_at: _T(14)  },
  { id: 'l4', action: 'approval.approve',  object_type: 'Contract', object_id: 'c1', object_code: 'CTR-PV-MODULE-001',        actor_name: 'Sarah Al-Zaabi',  actor_role: 'PMO Director',    before_state: 'pending',      after_state: 'approved',  decision_reason: 'Competitive bid. Vendor qualified. Insurance verified.',                           metadata: { detail: 'Contract value: $342M · 18-month supply' }, created_at: _T(24)  },
  { id: 'l5', action: 'comment.create',    object_type: 'Document', object_id: 'd2', object_code: 'SPEC-PV-MODULE-REV2',      actor_name: 'Fatima Al-Rashid',actor_role: 'Owner Engineer',  before_state: null,           after_state: null,        decision_reason: null,                                                                              metadata: { detail: 'Section 4.1 — panel efficiency spec updated to 22.8% per latest datasheet.' }, created_at: _T(36) },
  { id: 'l6', action: 'workflow.submit',   object_type: 'Document', object_id: 'd3', object_code: 'BOM-ELEC-001-DRAFT',       actor_name: 'Ahmed Hassan',    actor_role: 'Lead Engineer',   before_state: 'draft',        after_state: 'submitted', decision_reason: null,                                                                              metadata: { detail: 'Electrical BOM — 2,847 line items' },       created_at: _T(60)  },
  { id: 'l7', action: 'workflow.reject',   object_type: 'Design',   object_id: 'dz', object_code: 'CALC-STRUCT-PILE-V1',      actor_name: 'Lena Brandt',     actor_role: 'Owner Engineer',  before_state: 'under_review', after_state: 'rejected',  decision_reason: 'Pile foundation calculations do not account for Abu Dhabi seismic zone 2a loads.', metadata: null,                                                  created_at: _T(96)  },
  { id: 'l8', action: 'project.create',    object_type: 'Project',  object_id: 'p1', object_code: 'SOL-2026-001',             actor_name: 'System',          actor_role: 'Platform',        before_state: null,           after_state: 'active',    decision_reason: null,                                                                              metadata: { detail: 'Project created at G0 — Opportunity Accepted.' },                              created_at: _T(432) },
]

const SPEC_APPROVALS: ApprovalItem[] = [
  { id: 'a1', type: 'gate-review',    title: 'G2 IFC Drawing Package Sign-off',   projectCode: 'SOL-2026-001', projectName: 'Al Dhafra Solar PV', requestedBy: 'A. Hassan',    daysOpen: 5, isOverdue: false, priority: 'critical' },
  { id: 'a2', type: 'budget-variance',title: '+$14M Solar Module Price Revision', projectCode: 'SOL-2026-001', projectName: 'Al Dhafra Solar PV', requestedBy: 'J. Thornton',  daysOpen: 3, isOverdue: false, priority: 'high'     },
  { id: 'a3', type: 'change-order',   title: 'CO-012 Tracker System Upgrade',     projectCode: 'SOL-2026-001', projectName: 'Al Dhafra Solar PV', requestedBy: 'F. Al-Rashid', daysOpen: 1, isOverdue: false, priority: 'medium'   },
]

// ─────────────────────────────────────────────────────────────
// Gate Status card (G2 — spec)
// ─────────────────────────────────────────────────────────────

interface Deliverable {
  name: string
  completed: boolean
}

const SPEC_DELIVERABLES: Deliverable[] = [
  { name: 'IFC Drawings',             completed: true  },
  { name: 'Technical Specifications', completed: true  },
  { name: 'Bill of Materials',        completed: false },
  { name: 'Design Calculations',      completed: false },
]

interface Risk {
  title: string
  probability: 'high' | 'medium' | 'low'
  impact: 'high' | 'medium' | 'low'
  status: 'open' | 'closed'
}

const SPEC_RISKS: Risk[] = [
  { title: 'Permit delays',              probability: 'high',   impact: 'high',   status: 'open' },
  { title: 'Supply chain disruption',    probability: 'medium', impact: 'medium', status: 'open' },
  { title: 'Weather delays',             probability: 'medium', impact: 'low',    status: 'open' },
]

const SPEC_PROJECT_INFO = {
  technology:     'Solar PV',
  capacity:       '2,000 MW',
  epcContractor:  'GridMind EPC Solutions',
  ownerEngineer:  'GridMind Engineering',
  created:        'Jan 15, 2026',
  projectManager: 'Mohammed Al-Rashidi',
  pmInitials:     'MR',
}

function GateStatusCard({
  gateProgress = { G0: true, G1: true, G2: false },
  deliverables = SPEC_DELIVERABLES,
  overallProgress,
  onSubmitApproval,
  onRequestChanges,
}: {
  gateProgress?: Record<string, boolean>
  deliverables?: { name: string; completed: boolean }[]
  overallProgress?: number
  onSubmitApproval?: () => void
  onRequestChanges?: () => void
}) {
  const completed    = deliverables.filter((d) => d.completed).length
  const total        = deliverables.length
  const deliverPct   = Math.round((completed / total) * 100)
  const pct          = overallProgress ?? deliverPct

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm dark:border-border">
      <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-border">
        <div className="flex items-center gap-2">
          <GitBranch className="size-5 text-slate-500 dark:text-muted-foreground" aria-hidden />
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-foreground">
            Current Gate Status
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Gate badge + name */}
        <div>
          <span className="inline-block rounded-lg bg-sky-100 px-4 py-2 text-3xl font-bold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
            G2
          </span>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-foreground">
            Engineering IFC Release
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-muted-foreground leading-relaxed">
            Release Issued For Construction engineering drawings and specifications
          </p>
        </div>

        {/* Status + progress */}
        <div className="border-t border-slate-100 dark:border-border pt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
            Status
          </p>
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
            Active
          </span>
          <div
            className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`G2 progress: ${pct}%`}
          >
            <div className="h-full rounded-full bg-sky-600 transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-500 dark:text-muted-foreground">{pct}% Complete</p>
        </div>

        {/* Deliverables */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-2">
            Required Deliverables
          </p>
          <ul className="flex flex-col gap-2" aria-label="Gate deliverables">
            {deliverables.map((d) => (
              <li key={d.name} className="flex items-center gap-2">
                {d.completed
                  ? <CheckCircle2 className="size-4 shrink-0 text-green-500" aria-label="Complete" />
                  : <Circle       className="size-4 shrink-0 text-slate-300 dark:text-muted-foreground/40" aria-label="Pending" />
                }
                <span className={cn(
                  'text-sm text-slate-700 dark:text-foreground/80',
                  d.completed && 'line-through text-slate-400 dark:text-muted-foreground',
                )}>
                  {d.name}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500 dark:text-muted-foreground">
            {completed} of {total} completed
          </p>
        </div>

        {/* Next Actions */}
        <div className="border-t border-slate-100 dark:border-border pt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-2">
            Next Actions
          </p>
          <Button
            className="w-full bg-[#0a192f] hover:bg-slate-800 text-white dark:bg-[#64ffda] dark:text-[#0a192f] dark:hover:bg-[#64ffda]/90"
            size="sm"
            aria-label="Submit G2 package for approval"
            onClick={onSubmitApproval}
          >
            <Send className="size-4 mr-2" aria-hidden />
            Submit for Approval
          </Button>
          <Button
            variant="outline"
            className="w-full border-slate-200 hover:bg-slate-50 dark:border-border dark:hover:bg-muted"
            size="sm"
            aria-label="Request changes to G2 deliverables"
            onClick={onRequestChanges}
          >
            <RefreshCw className="size-4 mr-2" aria-hidden />
            Request Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Project Info card
// ─────────────────────────────────────────────────────────────

function ProjectInfoCard({ project = SPEC_PROJECT as unknown as Project }: { project?: Project }) {
  const info = {
    technology:     project.technology    ?? SPEC_PROJECT_INFO.technology,
    capacity:       project.capacity      ?? SPEC_PROJECT_INFO.capacity,
    epcContractor:  project.epcContractor ?? SPEC_PROJECT_INFO.epcContractor,
    ownerEngineer:  project.ownerEngineer ?? SPEC_PROJECT_INFO.ownerEngineer,
    projectManager: project.projectManager ?? SPEC_PROJECT_INFO.projectManager,
    pmInitials:     project.pmInitials    ?? SPEC_PROJECT_INFO.pmInitials,
    created:        project.startDate
      ? new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : SPEC_PROJECT_INFO.created,
  }

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Technology',    value: info.technology    },
    { label: 'Capacity',      value: info.capacity      },
    { label: 'EPC Contractor',value: info.epcContractor },
    { label: 'Owner Engineer',value: info.ownerEngineer },
    { label: 'Created',       value: info.created       },
    {
      label: 'Project Manager',
      value: (
        <span className="flex items-center gap-2">
          <span
            className="inline-flex size-6 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
            aria-hidden
          >
            {info.pmInitials}
          </span>
          <span className="text-sm font-medium text-slate-900 dark:text-foreground">
            {info.projectManager}
          </span>
        </span>
      ),
    },
  ]

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm dark:border-border">
      <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-border">
        <div className="flex items-center gap-2">
          <Info className="size-5 text-slate-500 dark:text-muted-foreground" aria-hidden />
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-foreground">
            Project Information
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-5 flex flex-col gap-4">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500 dark:text-muted-foreground shrink-0">{label}</span>
            {typeof value === 'string'
              ? <span className="text-sm font-medium text-slate-900 dark:text-foreground text-right">{value}</span>
              : value
            }
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Risk Summary card
// ─────────────────────────────────────────────────────────────

function RiskSummaryCard({ risks }: { risks: Risk[] }) {
  const open  = risks.filter((r) => r.status === 'open').length
  const total = risks.length

  // SVG circular progress
  const r = 24, stroke = 8
  const normalR   = r - stroke / 2
  const circ      = 2 * Math.PI * normalR
  const dashOffset = circ * (1 - open / Math.max(total, 1))

  const dotColor = (p: Risk['probability']) =>
    p === 'high' ? 'bg-red-500' : 'bg-amber-400'

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm dark:border-border">
      <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" aria-hidden />
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-foreground">
              Risk Summary
            </CardTitle>
          </div>
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
            {open} open
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Circular meter */}
        <div className="flex items-center gap-4">
          <div className="relative inline-flex items-center justify-center" aria-hidden>
            <svg width={r * 2} height={r * 2}>
              <circle cx={r} cy={r} r={normalR} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
              <circle
                cx={r} cy={r} r={normalR} fill="none"
                stroke="#f59e0b" strokeWidth={stroke}
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${r} ${r})`}
              />
            </svg>
            <span className="absolute text-xl font-bold text-amber-600 dark:text-amber-400">{open}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-foreground">{open} Open Risks</p>
            <p className="text-xs text-slate-500 dark:text-muted-foreground">{total} total identified</p>
          </div>
        </div>

        {/* Risk list */}
        <ul className="flex flex-col gap-2" aria-label="Open risks">
          {risks.map((risk) => (
            <li key={risk.title} className="flex items-start gap-2">
              <span
                className={cn('mt-1.5 size-2 rounded-full shrink-0', dotColor(risk.probability))}
                aria-hidden
              />
              <span className="text-sm text-slate-700 dark:text-foreground/80">
                {risk.title} — <span className="capitalize text-slate-500 dark:text-muted-foreground">{risk.probability} probability</span>
              </span>
            </li>
          ))}
        </ul>

        <a
          href="/risk/register"
          className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline dark:text-sky-400"
        >
          View Risk Register
          <ArrowRight className="size-3.5" aria-hidden />
        </a>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Quick Actions card
// ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS: {
  label:     string
  icon:      React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  iconColor: string
  bgColor:   string
  count:     string
  ariaLabel: string
  href?:     string
}[] = [
  { label: 'Documents', icon: FileText,      iconColor: '#0a192f', bgColor: 'bg-[#0a192f]/10',                       count: '12 files',       ariaLabel: 'Open Documents' },
  { label: 'Comments',  icon: MessageSquare, iconColor: '#2563eb', bgColor: 'bg-blue-100 dark:bg-blue-900/30',        count: '8 threads',      ariaLabel: 'Open Comments' },
  { label: 'Team',      icon: Users,         iconColor: '#059669', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',  count: '6 members',      ariaLabel: 'Open Team' },
  { label: 'Settings',  icon: Settings,      iconColor: '#64748b', bgColor: 'bg-slate-100 dark:bg-muted',             count: 'Project config', ariaLabel: 'Open Project Settings' },
  { label: 'G0 Intake', icon: FileText,      iconColor: '#d97706', bgColor: 'bg-amber-100 dark:bg-amber-900/30',      count: 'New opportunity',ariaLabel: 'Start G0 Intake',       href: '/projects/new/intake' },
]

function QuickActionsCard({ onAction, projectId }: { onAction?: (label: string) => void; projectId?: string }) {
  const router = useNextRouter()
  const actions = projectId
    ? [
        ...QUICK_ACTIONS,
        {
          label: 'Client Report', icon: FileText, iconColor: '#7c3aed',
          bgColor: 'bg-violet-100 dark:bg-violet-900/30', count: 'Monthly PDF',
          ariaLabel: 'Open Client Report', href: `/projects/${projectId}/client-report`,
        },
      ]
    : QUICK_ACTIONS
  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm dark:border-border">
      <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-border">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-slate-500 dark:text-muted-foreground" aria-hidden />
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-foreground">
            Quick Actions
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-2 gap-4">
          {actions.map(({ label, icon: Icon, iconColor, bgColor, count, ariaLabel, href }) => (
            <button
              key={label}
              type="button"
              aria-label={ariaLabel}
              onClick={() => href ? router.push(href) : onAction?.(label)}
              className={cn(
                'flex flex-col items-center rounded-lg border border-slate-200 p-4 text-center',
                'cursor-pointer transition-colors duration-150',
                'hover:bg-slate-50 hover:border-sky-200 dark:border-border dark:hover:bg-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <div
                className={cn('flex size-10 items-center justify-center rounded-full', bgColor)}
                aria-hidden
              >
                <Icon className="size-6" style={{ color: iconColor }} />
              </div>
              <span className="mt-2 text-sm font-semibold text-slate-900 dark:text-foreground">{label}</span>
              <span className="text-xs text-slate-500 dark:text-muted-foreground">{count}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Activity Timeline card
// ─────────────────────────────────────────────────────────────

function ActivityTimelineCard({ logs, loading }: { logs: WorkflowLogEntry[]; loading?: boolean }) {
  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm dark:border-border">
      <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-slate-500 dark:text-muted-foreground" aria-hidden />
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-foreground">
              Activity Timeline
            </CardTitle>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline dark:text-sky-400"
          >
            View All
            <ArrowRight className="size-3.5" aria-hidden />
          </a>
        </div>
      </CardHeader>
      <CardContent className="p-5 max-h-[400px] overflow-y-auto pr-2">
        <WorkflowTimeline logs={logs} showActor loading={loading} />
      </CardContent>
      <div className="border-t border-slate-100 dark:border-border px-5 py-3 text-center">
        <Button
          variant="ghost"
          size="sm"
          className="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          <ChevronDown className="size-4 mr-1.5" aria-hidden />
          Load More
        </Button>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Project Approvals widget
// ─────────────────────────────────────────────────────────────

function ProjectApprovalsCard({ approvals, loading }: { approvals: ApprovalItem[]; loading?: boolean }) {
  const pending = approvals.filter((a) => !a.isOverdue).length + approvals.filter((a) => a.isOverdue).length

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm dark:border-border">
      <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-slate-500 dark:text-muted-foreground" aria-hidden />
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-foreground">
              Project Approvals
            </CardTitle>
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            {pending} pending
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ApprovalQueue items={approvals} loading={loading} maxVisible={5} />
      </CardContent>
      <div className="border-t border-slate-100 dark:border-border px-5 py-3 text-center">
        <a
          href="/approvals"
          className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline dark:text-sky-400"
        >
          View All Approvals
          <ArrowRight className="size-3.5" aria-hidden />
        </a>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Props + main page
// ─────────────────────────────────────────────────────────────

export interface ProjectDetailPageProps {
  project: Project
  gateProgress: Record<string, boolean>
  /** Overall gate completion percentage (e.g. 65). Overrides deliverable-count-based pct in GateStatusCard. */
  overallProgress?: number
  deliverables: { name: string; completed: boolean }[]
  risks: { title: string; probability: string; impact: string; status: string }[]
  timelineLogs: AuditLog[]
  approvals: Approval[]
  teamMembers: ProjectMember[]
  documents: Document[]
  comments: Comment[]
  isLoading?: boolean
  error?: string | null
  onBack: () => void
  onEdit: () => void
  onComments: () => void
  onDocuments: () => void
  onTeam: () => void
  onSettings: () => void
  onSubmitApproval: () => void
  onRequestChanges: () => void
  /** Suppress the built-in PhaseGateStepper when the parent renders one */
  hideStepper?: boolean
  /** Suppress the built-in ActivityTimeline when the parent renders one */
  hideTimeline?: boolean
}

/** Adapt spec Approval → internal ApprovalItem for ApprovalQueue */
function toApprovalItem(a: Approval): ApprovalItem {
  return {
    id: a.id,
    type: a.type as ApprovalItem['type'],
    title: a.title,
    projectCode: a.projectCode,
    projectName: a.projectName,
    requestedBy: a.requestedBy,
    daysOpen: a.daysOpen,
    isOverdue: a.isOverdue,
    priority: a.priority,
  }
}

/** Adapt spec AuditLog → WorkflowLogEntry for WorkflowTimeline */
function toWorkflowEntry(l: AuditLog): WorkflowLogEntry {
  return {
    id: l.id,
    action: l.action,
    object_type: l.object_type,
    object_id: l.object_id,
    object_code: l.object_code,
    actor_name: l.actor_name,
    actor_role: l.actor_role,
    before_state: l.before_state,
    after_state: l.after_state,
    decision_reason: l.decision_reason,
    metadata: l.metadata,
    created_at: l.created_at,
  }
}

/** Adapt spec Project → ProjectData for ProjectCommandCenter */
function toProjectData(p: Project): ProjectData {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    client: p.client,
    status: p.status as ProjectData['status'],
    phase: p.phase as ProjectData['phase'],
    gate: p.gate,
    gateName: p.gateName,
    budgetUsd: p.budgetUsd,
    currency: p.currency ?? 'USD',
    startDate: p.startDate,
    targetCod: p.targetCod,
    location: p.location ?? 'Location TBD',
    commentCount: p.commentCount,
    documentCount: p.documentCount,
  }
}

export function ProjectDetailPage({
  project,
  gateProgress,
  overallProgress,
  deliverables,
  risks,
  timelineLogs,
  approvals,
  isLoading    = false,
  error        = null,
  onBack,
  onEdit,
  onComments,
  onDocuments,
  onTeam,
  onSettings,
  onSubmitApproval,
  onRequestChanges,
  hideStepper  = false,
  hideTimeline = false,
}: ProjectDetailPageProps) {
  const gateNumber      = project.gate ?? 2
  const currentGateCode = `G${gateNumber}`
  const completedGates  = Array.from({ length: gateNumber }, (_, i) => `G${i}`)

  const projectData   = toProjectData(project)
  const workflowLogs  = timelineLogs.map(toWorkflowEntry)
  const approvalItems = approvals.map(toApprovalItem)

  const router = useNextRouter()

  // Gate code → sub-page route (only wired gates navigate; others open the info panel)
  const GATE_ROUTES: Partial<Record<string, string>> = {
    G0: `/projects/${project.id}/g0`,
    G1: `/projects/${project.id}/g1/approval`,
    G2: `/projects/${project.id}/g2`,
    G3: `/projects/${project.id}/g3`,
    G4: `/projects/${project.id}/g4`,
    G5: `/projects/${project.id}/g5`,
    G6: `/projects/${project.id}/g6/om-transition`,
  }

  const handleGateClick = React.useCallback(
    (gate: import('@/components/project/phase-gate-stepper').GateDef) => {
      const route = GATE_ROUTES[gate.code]
      if (route) router.push(route)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.id, router],
  )

  return (
    <div className="relative min-h-full space-y-6 p-6 bg-slate-50 dark:bg-background">

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-4 -mt-2">
        <a href="/projects" className="text-sm text-sky-600 hover:underline dark:text-sky-400">
          Projects
        </a>
        <ChevronRight className="size-3.5 text-slate-400 dark:text-muted-foreground" aria-hidden />
        <span className="text-sm text-slate-500 dark:text-muted-foreground">{project.name}</span>
      </nav>

      {/* Error state */}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Project Command Center */}
      <ProjectCommandCenter project={projectData} loading={isLoading} onBack={onBack} />

      {/* Phase Gate Stepper */}
      {!hideStepper && (
        <section aria-label="Stage gate progress">
          <PhaseGateStepper
            currentGate={currentGateCode}
            completedGates={completedGates}
            onGateClick={handleGateClick}
          />
        </section>
      )}

      {/* 2/3 + 1/3 grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Left column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {!hideTimeline && (
            <ActivityTimelineCard logs={workflowLogs} loading={isLoading} />
          )}
          <QuickActionsCard
            projectId={project.id}
            onAction={(label) => {
              if (label === 'Documents') onDocuments()
              else if (label === 'Comments') onComments()
              else if (label === 'Team') onTeam()
              else if (label === 'Settings') onSettings()
            }}
          />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <ProjectApprovalsCard approvals={approvalItems} loading={isLoading} />
          <GateStatusCard
            gateProgress={gateProgress}
            overallProgress={overallProgress}
            deliverables={deliverables}
            onSubmitApproval={onSubmitApproval}
            onRequestChanges={onRequestChanges}
          />
          <ProjectInfoCard project={project} />
          <ClientAnnouncementsPanel projectId={project.id} isManager />
          <RiskSummaryCard risks={risks as Risk[]} />
        </div>
      </div>
    </div>
  )
}
