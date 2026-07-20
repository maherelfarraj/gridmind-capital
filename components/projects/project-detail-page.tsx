'use client'

import * as React from 'react'
import {
  FileText,
  MessageSquare,
  Users,
  Settings,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProjectCommandCenter, type ProjectData } from '@/components/project/project-command-center'
import { PhaseGateStepper, GATE_DEFINITIONS } from '@/components/project/phase-gate-stepper'
import { WorkflowTimeline, type WorkflowLogEntry } from '@/components/workflow/workflow-timeline'
import { ApprovalQueue } from '@/components/dashboard/approval-queue'
import { HelpHubPanel } from '@/components/help/help-hub-panel'
import type { ApprovalItem } from '@/components/dashboard/dashboard-data'

// ─────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────

const MOCK_PROJECT: ProjectData = {
  id: 'p-sirius',
  name: 'Sirius 400MW Solar Farm',
  code: 'SRS-400',
  client: 'TotalEnergies',
  status: 'active',
  phase: 'g4',
  gate: 4,
  gateName: 'Construction Mobilization',
  budgetUsd: 480_000_000,
  startDate: '2023-03-15',
  targetCod: '2025-12-31',
  location: 'Atacama Desert, Chile',
  commentCount: 12,
}

const MOCK_LOGS: WorkflowLogEntry[] = [
  {
    id: 'l1',
    action: 'workflow.approve',
    objectType: 'gate',
    objectLabel: 'G4 Gate Review — Construction Mobilization',
    actor: { id: 'u1', name: 'Ana Reyes', role: 'PMO Director', avatarInitials: 'AR' },
    timestamp: new Date(Date.now() - 1000 * 60 * 18),
    stateBefore: 'under_review',
    stateAfter: 'approved',
    reason: 'All G4 pre-conditions satisfied. Mobilization plan accepted by PMO and client.',
  },
  {
    id: 'l2',
    action: 'workflow.submit',
    objectType: 'document',
    objectLabel: 'Mobilization Plan Rev B — SRS-MOB-001',
    actor: { id: 'u2', name: 'James Rivera', role: 'Project Manager', avatarInitials: 'JR' },
    timestamp: new Date(Date.now() - 1000 * 60 * 95),
    stateBefore: 'draft',
    stateAfter: 'submitted',
    detail: 'SRS-MOB-001-RevB.pdf · 4.2 MB',
  },
  {
    id: 'l3',
    action: 'workflow.escalate',
    objectType: 'budget',
    objectLabel: '+$8.2M Contingency Draw-Down',
    actor: { id: 'u3', name: 'Thomas Müller', role: 'Finance Lead', avatarInitials: 'TM' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
    stateBefore: 'pending',
    stateAfter: 'escalated',
    reason: 'Module price escalation on inverter supply chain requires CFO sign-off above standard threshold.',
  },
  {
    id: 'l4',
    action: 'approval.approve',
    objectType: 'contract',
    objectLabel: 'EPC Sub-Contract — Civil Works Package',
    actor: { id: 'u1', name: 'Ana Reyes', role: 'PMO Director', avatarInitials: 'AR' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 7),
    stateBefore: 'pending_approval',
    stateAfter: 'executed',
    reason: 'Competitive bid. Vendor qualified. Insurance certificates verified.',
    detail: 'Contract value: $24.6M · Duration: 14 months',
  },
  {
    id: 'l5',
    action: 'comment.create',
    objectType: 'document',
    objectLabel: 'G4 Gate Report',
    actor: { id: 'u4', name: 'Sofia Al-Farsi', role: 'Lead Engineer', avatarInitials: 'SA' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 11),
    detail: '"Section 3.2 inverter spec needs updated datasheet — Rev C superseded Rev B on 12-Nov."',
  },
  {
    id: 'l6',
    action: 'workflow.submit',
    objectType: 'document',
    objectLabel: 'IFC Drawing Package — Civil Foundations',
    actor: { id: 'u4', name: 'Sofia Al-Farsi', role: 'Lead Engineer', avatarInitials: 'SA' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18),
    stateBefore: 'draft',
    stateAfter: 'submitted',
    detail: '48 drawings · SRS-CIV-IFC-001 through SRS-CIV-IFC-048',
  },
  {
    id: 'l7',
    action: 'workflow.reject',
    objectType: 'change-order',
    objectLabel: 'CO-037 — Tracker Row Spacing Change',
    actor: { id: 'u5', name: 'Luca Costa', role: 'Client Rep (TotalEnergies)', avatarInitials: 'LC' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 29),
    stateBefore: 'under_review',
    stateAfter: 'rejected',
    reason: 'Row spacing change impacts yield model assumptions agreed in G2. Requires yield engineer re-certification before resubmission.',
  },
  {
    id: 'l8',
    action: 'project.create',
    objectType: 'project',
    objectLabel: 'SRS-400 — Sirius 400MW Solar Farm',
    actor: { id: 'u6', name: 'System', role: 'Platform', avatarInitials: 'SY' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18),
    stateAfter: 'active',
    detail: 'Project created at G0 — Opportunity Accepted.',
  },
]

const MOCK_APPROVALS: ApprovalItem[] = [
  { id: 'a1', type: 'gate-review',     title: 'G5 Gate Review Convene',        projectCode: 'SRS-400', projectName: 'Sirius 400MW', requestedBy: 'J. Rivera',   daysOpen: 8, isOverdue: true,  priority: 'critical' },
  { id: 'a2', type: 'budget-variance', title: '+$8.2M Contingency Draw-Down',  projectCode: 'SRS-400', projectName: 'Sirius 400MW', requestedBy: 'T. Müller',   daysOpen: 4, isOverdue: true,  priority: 'high'     },
  { id: 'a3', type: 'change-order',    title: 'CO-041 Inverter Substitution',  projectCode: 'SRS-400', projectName: 'Sirius 400MW', requestedBy: 'S. Al-Farsi', daysOpen: 2, isOverdue: false, priority: 'high'     },
  { id: 'a4', type: 'contract',        title: 'O&M Framework Agreement',       projectCode: 'SRS-400', projectName: 'Sirius 400MW', requestedBy: 'R. Chen',     daysOpen: 1, isOverdue: false, priority: 'medium'   },
]

// ─────────────────────────────────────────────────────────────
// Current Gate Status card
// ─────────────────────────────────────────────────────────────

interface GateDeliverable {
  label: string
  status: 'complete' | 'in-progress' | 'pending' | 'overdue'
}

const GATE_4_DELIVERABLES: GateDeliverable[] = [
  { label: 'Mobilization Plan approved',        status: 'complete'     },
  { label: 'Site access & permits confirmed',   status: 'complete'     },
  { label: 'EPC sub-contracts executed',        status: 'complete'     },
  { label: 'Health & Safety Induction plan',    status: 'in-progress'  },
  { label: 'Equipment delivery schedule locked',status: 'in-progress'  },
  { label: 'Construction baseline schedule',    status: 'pending'      },
  { label: 'Client G4 sign-off received',       status: 'overdue'      },
]

const DELIVERABLE_META: Record<GateDeliverable['status'], { icon: React.ElementType; color: string; label: string }> = {
  complete:    { icon: CheckCircle2,  color: '#22c55e', label: 'Complete'     },
  'in-progress':{ icon: Clock,        color: '#f59e0b', label: 'In Progress'  },
  pending:     { icon: Circle,        color: '#64748b', label: 'Pending'      },
  overdue:     { icon: AlertTriangle, color: '#ef4444', label: 'Overdue'      },
}

function GateStatusCard({ gateNumber = 4, loading = false }: { gateNumber?: number; loading?: boolean }) {
  const gate = GATE_DEFINITIONS[gateNumber]
  if (!gate) return null

  const completed = GATE_4_DELIVERABLES.filter((d) => d.status === 'complete').length
  const total = GATE_4_DELIVERABLES.length
  const pct = Math.round((completed / total) * 100)

  const Skeleton = () => (
    <div className="animate-pulse space-y-3 p-4">
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-2 w-full rounded bg-muted" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="size-4 rounded-full bg-muted shrink-0" />
          <div className="h-3 rounded bg-muted" style={{ width: `${60 + (i % 3) * 12}%` }} />
        </div>
      ))}
    </div>
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Current Gate
            </p>
            <CardTitle className="text-sm font-semibold leading-snug">
              {gate.fullName}
            </CardTitle>
          </div>
          <Badge variant="gate" className="shrink-0 mt-0.5">Active</Badge>
        </div>
      </CardHeader>

      {loading ? <Skeleton /> : (
        <CardContent className="pt-0 space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted-foreground">Deliverable progress</span>
              <span className="text-[11px] font-semibold text-foreground">{completed}/{total} complete</span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Gate ${gateNumber} deliverable progress: ${pct}%`}
            >
              <div
                className="h-full rounded-full bg-[#64ffda] transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{pct}%</p>
          </div>

          {/* Purpose */}
          <p className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-[#64ffda]/40 pl-2.5">
            {gate.purpose.slice(0, 140)}{gate.purpose.length > 140 ? '…' : ''}
          </p>

          {/* Deliverables */}
          <ul className="space-y-1.5" aria-label="Gate deliverables">
            {GATE_4_DELIVERABLES.map((d, i) => {
              const meta = DELIVERABLE_META[d.status]
              const Icon = meta.icon
              return (
                <li key={i} className="flex items-start gap-2">
                  <Icon
                    className="size-3.5 shrink-0 mt-0.5"
                    style={{ color: meta.color }}
                    aria-label={meta.label}
                  />
                  <span
                    className={cn(
                      'text-[11px] leading-snug',
                      d.status === 'complete'
                        ? 'text-muted-foreground line-through'
                        : d.status === 'overdue'
                        ? 'text-[#ef4444] font-medium'
                        : 'text-foreground',
                    )}
                  >
                    {d.label}
                  </span>
                </li>
              )
            })}
          </ul>

          {/* Approvers */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
              Required approvers
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gate.approvers.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Button
            variant="gate"
            size="sm"
            className="w-full"
            aria-label="Open Gate 4 review panel"
          >
            Open Gate Review
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Quick Actions card
// ─────────────────────────────────────────────────────────────

interface QuickAction {
  label: string
  icon: React.ElementType
  count?: number
  countColor?: string
  variant?: 'default' | 'outline' | 'ghost'
  ariaLabel: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Documents',  icon: FileText,      count: 48,  countColor: '#3b82f6',  variant: 'outline', ariaLabel: 'Open Documents — 48 files' },
  { label: 'Comments',   icon: MessageSquare, count: 12,  countColor: '#64ffda',  variant: 'outline', ariaLabel: 'Open Comments — 12 unread' },
  { label: 'Team',       icon: Users,         count: 9,   countColor: '#a855f7',  variant: 'outline', ariaLabel: 'Open Team — 9 members' },
  { label: 'Settings',   icon: Settings,                                           variant: 'outline', ariaLabel: 'Open Project Settings' },
]

function QuickActionsCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map(({ label, icon: Icon, count, countColor, ariaLabel }) => (
            <button
              key={label}
              type="button"
              aria-label={ariaLabel}
              className={cn(
                'group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border',
                'py-4 px-2 text-center',
                'bg-card hover:bg-muted/60 transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <div
                className="flex size-8 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: countColor ? `${countColor}18` : 'hsl(var(--muted))',
                  color: countColor ?? 'hsl(var(--muted-foreground))',
                }}
                aria-hidden="true"
              >
                <Icon className="size-4" />
              </div>
              <span className="text-xs font-medium text-foreground">{label}</span>
              {count !== undefined && (
                <span
                  className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full text-[10px] font-bold leading-none text-white"
                  style={{ backgroundColor: countColor ?? '#64748b' }}
                  aria-hidden="true"
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Props + main page
// ────────────────────────────────────────���────────────────────

export interface ProjectDetailPageProps {
  project?: ProjectData
  logs?: WorkflowLogEntry[]
  approvals?: ApprovalItem[]
  loading?: boolean
  onBack?: () => void
}

export function ProjectDetailPage({
  project = MOCK_PROJECT,
  logs = MOCK_LOGS,
  approvals = MOCK_APPROVALS,
  loading = false,
  onBack,
}: ProjectDetailPageProps) {
  const gateNumber = project?.gate ?? 4
  const currentGateCode = `G${gateNumber}`
  const completedGateCodes = Array.from({ length: gateNumber }, (_, i) => `G${i}`)

  return (
    <div className="relative min-h-full">
      {/* ── Project Command Center header ── */}
      <ProjectCommandCenter
        project={project}
        loading={loading}
        onBack={onBack}
      />

      {/* ── Phase Gate Stepper ── */}
      <section className="mt-6" aria-label="Stage gate progress">
        <PhaseGateStepper
          currentGate={currentGateCode}
          completedGates={completedGateCodes}
        />
      </section>

      {/* ── Main 2/3 + 1/3 grid ── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── Left column (2/3) ── */}
        <div className="flex flex-col gap-6 lg:col-span-2">

          {/* Activity Timeline */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Activity Timeline</CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  {logs.length} events
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 max-h-[520px] overflow-y-auto pr-1">
              <WorkflowTimeline
                logs={logs}
                showActor
                initialVisible={5}
                loading={loading}
                emptyMessage="No activity recorded for this project yet."
              />
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <QuickActionsCard />
        </div>

        {/* ── Right column (1/3) ── */}
        <div className="flex flex-col gap-6">

          {/* Project Approvals */}
          <ApprovalQueue
            items={approvals}
            loading={loading}
            maxVisible={4}
          />

          {/* Current Gate Status */}
          <GateStatusCard gateNumber={gateNumber} loading={loading} />
        </div>
      </div>

      {/* ── Help Hub (floating) ── */}
      <HelpHubPanel
        context={`Gate ${gateNumber} — ${GATE_DEFINITIONS[gateNumber]?.shortName ?? ''}`}
        userRole="PROJECT_MANAGER"
        defaultModule="construction"
      />
    </div>
  )
}
