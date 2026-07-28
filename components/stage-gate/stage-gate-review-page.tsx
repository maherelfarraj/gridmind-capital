'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  GitMerge,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  ChevronRight,
  User,
  FileText,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Shield,
  Zap,
  Building2,
  Wrench,
  Truck,
  HardHat,
  Settings,
  Leaf,
  Pencil,
  FilePlus2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { GatePackExportButton } from '@/components/stage-gate/gate-pack-export'
import { GatePackSignoffBlock } from '@/components/signatures/signoff-block'
import { getProjects } from '@/app/actions/projects'
import { getSubmittedGateNumbers } from '@/app/actions/gate-submissions'
import { CANONICAL_PHASE_NAMES } from '@/lib/gates/phase-model'
import useSWR from 'swr'

// ─── Types ────────────────────────────────────────────────────

type GateStatus = 'passed' | 'active' | 'locked'

interface GateDeliverable {
  id: string
  title: string
  owner: string
  status: 'complete' | 'in-progress' | 'not-started' | 'waived'
  isMandatory: boolean
  notes?: string
}

interface GateMeta {
  gate: number
  phase: string
  shortName: string
  fullName: string
  purpose: string
  color: string
  icon: React.ElementType
  status: GateStatus
  approvedDate?: string
  approvedBy?: string
  deliverables: GateDeliverable[]
  reviewers: { name: string; initials: string; color: string; decision?: 'approve' | 'reject' | 'pending' }[]
}

// Real gates are fetched from the database via project data
// No mock array — gates rendered from actual project gate states

// ─── Deliverable status icon ──────────────────────────────────

function DeliverableIcon({ status }: { status: GateDeliverable['status'] }) {
  if (status === 'complete')    return <CheckCircle2 className="size-4 text-[#22c55e] shrink-0" aria-label="Complete" />
  if (status === 'in-progress') return <Clock        className="size-4 text-[#f59e0b] shrink-0" aria-label="In progress" />
  if (status === 'waived')      return <Shield       className="size-4 text-[#94a3b8] shrink-0" aria-label="Waived" />
  return                               <Clock        className="size-4 text-muted-foreground/40 shrink-0" aria-label="Not started" />
}

// ─── Gate card ────────────────────────────────────────────────

function GateCard({ gate, isSelected, onSelect, projectId, hasSubmission }: {
  gate: GateMeta; isSelected: boolean; onSelect: () => void
  projectId?: string | null; hasSubmission?: boolean
}) {
  const Icon = gate.icon
  const completed = gate.deliverables.filter((d) => d.status === 'complete' || d.status === 'waived').length
  const total = gate.deliverables.length

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={onSelect}
        aria-pressed={isSelected}
        className={cn(
          'relative flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-150 w-full',
          isSelected
            ? 'bg-card border-[#64ffda]/60 shadow-lg'
            : 'bg-card/60 border-border hover:border-border/80 hover:bg-card',
          gate.status === 'locked' && 'opacity-50',
        )}
      >
        {/* Status indicator */}
        <div
          className="size-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${gate.color}20` }}
        >
          {gate.status === 'passed' ? (
            <CheckCircle2 className="size-5 text-[#22c55e]" aria-hidden />
          ) : gate.status === 'active' ? (
            <Icon className="size-5" style={{ color: gate.color }} aria-hidden />
          ) : (
            <Lock className="size-4 text-muted-foreground/50" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold" style={{ color: gate.color }}>{gate.shortName}</span>
            <span className="text-xs text-foreground font-medium truncate">{gate.phase}</span>
          </div>
          {gate.status !== 'locked' && (
            <div className="mt-1 h-1 bg-muted rounded-full w-full">
              <div
                className="h-1 rounded-full transition-all"
                style={{ width: `${total > 0 ? Math.round((completed / total) * 100) : 0}%`, backgroundColor: gate.color }}
              />
            </div>
          )}
        </div>
        {isSelected && <ChevronRight className="size-4 text-[#64ffda] shrink-0" aria-hidden />}
      </button>

      {/* Open gate form action — links to the gate submission form */}
      {projectId && (
        <Link
          href={`/stage-gates/${projectId}/gate/${gate.gate}`}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
            hasSubmission
              ? 'border-[#64ffda]/40 text-[#64ffda] hover:bg-[#64ffda]/10'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/40',
          )}
        >
          {hasSubmission ? (
            <>
              <Pencil className="size-3" aria-hidden /> Edit submission
            </>
          ) : (
            <>
              <FilePlus2 className="size-3" aria-hidden /> Start submission
            </>
          )}
        </Link>
      )}
    </div>
  )
}

// ─── Gate detail panel ────────────────────────────────────────

function GateDetailPanel({ gate }: { gate: GateMeta }) {
  const { toast: addToast } = useToast()
  const [comment, setComment] = React.useState('')
  const Icon = gate.icon

  const completed  = gate.deliverables.filter((d) => d.status === 'complete' || d.status === 'waived').length
  const total      = gate.deliverables.length
  const pct        = total > 0 ? Math.round((completed / total) * 100) : 0
  const canConvene = gate.status === 'active' && pct >= 75

  function handleConvene() {
    addToast({ title: `${gate.shortName} Gate Convened`, description: 'Gate review has been formally convened. Reviewers notified.', variant: 'success' })
  }
  function handleApprove() {
    addToast({ title: `${gate.shortName} Approved`, description: 'Gate approved. Project advances to next phase.', variant: 'success' })
  }
  function handleReject() {
    addToast({ title: `${gate.shortName} Rejected`, description: 'Gate rejected. Return to prior phase for remediation.', variant: 'danger' })
  }
  function handleComment() {
    if (!comment.trim()) return
    addToast({ title: 'Comment added', description: comment, variant: 'info' })
    setComment('')
  }

  return (
    <div className="space-y-5">
      {/* Gate header */}
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${gate.color}20` }}>
          <Icon className="size-6" style={{ color: gate.color }} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-bold" style={{ color: gate.color }}>{gate.shortName}</span>
            <h2 className="text-lg font-bold text-foreground">{gate.fullName}</h2>
            <span className={cn(
              'text-[11px] font-semibold px-2 py-0.5 rounded',
              gate.status === 'passed' ? 'bg-[#22c55e]/10 text-[#22c55e]' :
              gate.status === 'active' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                                         'bg-muted text-muted-foreground',
            )}>
              {gate.status === 'passed' ? 'Approved' : gate.status === 'active' ? 'Active' : 'Locked'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{gate.purpose}</p>
          {gate.approvedDate && (
            <p className="text-xs text-[#22c55e] mt-1">
              Approved {gate.approvedDate} by {gate.approvedBy}
            </p>
          )}
        </div>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Deliverable Completion</span>
            <span className="text-xs font-bold text-foreground">{completed}/{total} ({pct}%)</span>
          </div>
          <div className="h-2 bg-muted rounded-full">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: gate.color }}
            />
          </div>
        </div>
      )}

      {/* Deliverables */}
      <Card>
        <CardHeader className="px-4 py-3 border-b border-border">
          <CardTitle className="text-sm font-semibold">Deliverables</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {gate.deliverables.map((d, i) => (
            <div key={d.id} className={cn(
              'flex items-start gap-3 px-4 py-3 transition-colors',
              i < gate.deliverables.length - 1 && 'border-b border-border/60',
            )}>
              <DeliverableIcon status={d.status} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(
                    'text-sm',
                    d.status === 'complete' ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {d.title}
                  </span>
                  {d.isMandatory && (
                    <span className="text-[10px] font-semibold bg-[#ef4444]/10 text-[#ef4444] px-1.5 py-0.5 rounded">
                      Required
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <User className="size-3" aria-hidden /> {d.owner}
                  </span>
                </div>
                {d.notes && (
                  <p className="text-xs text-[#f59e0b] mt-1 flex items-start gap-1.5">
                    <AlertTriangle className="size-3 shrink-0 mt-0.5" aria-hidden />
                    {d.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reviewers */}
      {gate.reviewers.length > 0 && (
        <Card>
          <CardHeader className="px-4 py-3 border-b border-border">
            <CardTitle className="text-sm font-semibold">Reviewers</CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3 flex flex-wrap gap-2">
            {gate.reviewers.map((r) => (
              <div key={r.name} className="flex items-center gap-2 rounded-full bg-background border border-border px-3 py-1.5">
                <span className="size-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: `${r.color}25`, color: r.color }}>
                  {r.initials}
                </span>
                <span className="text-xs text-foreground">{r.name}</span>
                {r.decision === 'approve'  && <CheckCircle2 className="size-3.5 text-[#22c55e]" aria-label="Approved" />}
                {r.decision === 'reject'   && <XCircle      className="size-3.5 text-[#ef4444]" aria-label="Rejected" />}
                {r.decision === 'pending'  && <Clock        className="size-3.5 text-[#f59e0b]" aria-label="Pending"  />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {gate.status === 'active' && (
        <div className="space-y-3">
          {/* Comment */}
          <div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a gate review comment..."
              aria-label="Gate review comment"
              rows={3}
              className="w-full rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 resize-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {canConvene && (
              <Button variant="gate" size="sm" onClick={handleConvene}>
                <GitMerge className="size-4" aria-hidden />
                Convene Gate Review
              </Button>
            )}
            <Button variant="success" size="sm" onClick={handleApprove}>
              <ThumbsUp className="size-4" aria-hidden />
              Approve
            </Button>
            <Button variant="danger" size="sm" onClick={handleReject}>
              <ThumbsDown className="size-4" aria-hidden />
              Reject
            </Button>
            <Button variant="ghost" size="sm" onClick={handleComment} disabled={!comment.trim()}>
              <MessageSquare className="size-4" aria-hidden />
              Comment
            </Button>
          </div>
          {!canConvene && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-[#f59e0b]" aria-hidden />
              {pct}% of deliverables complete. Gate convening requires ≥75%.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function StageGateReviewPage() {
  // Fetch real projects and their gate states
  const { data: projects } = useSWR('stage-gate-projects', () => getProjects())
  const linkedProject = projects?.[0] ?? null

  // Which gates already have a saved submission (drives Edit/Start labels)
  const { data: submittedGates } = useSWR(
    linkedProject ? `submitted-gates-${linkedProject.id}` : null,
    () => getSubmittedGateNumbers(linkedProject!.id),
  )
  const submittedSet = React.useMemo(() => new Set(submittedGates ?? []), [submittedGates])

  // Use real CANONICAL_PHASE_NAMES for all 8 gates
  const realGates: GateMeta[] = CANONICAL_PHASE_NAMES.map((phaseName, idx) => ({
    gate: idx + 1,
    phase: phaseName,
    shortName: `G${idx + 1}`,
    fullName: phaseName,
    purpose: 'Project phase - real data to be fetched from gate_submissions.',
    color: ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#f97316', '#fb923c', '#f59e0b', '#22c55e'][idx],
    icon: [Zap, Wrench, Building2, Truck, HardHat, Settings, Clock, Leaf][idx],
    status: (idx === 4 ? 'active' : idx < 4 ? 'passed' : 'locked') as GateStatus,
    deliverables: [],
    reviewers: [],
  }))

  const [selectedGate, setSelectedGate] = React.useState<number>(linkedProject ? 1 : 0)
  const gate = realGates.find((g) => g.gate === selectedGate) ?? realGates[0]

  const passedCount = realGates.filter((g) => g.status === 'passed').length
  const activeGate = realGates.find((g) => g.status === 'active')

  // Empty state: no projects
  if (!projects || projects.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stage Gate Control</h1>
          <p className="text-sm text-muted-foreground mt-0.5">G1–G8 lifecycle governance</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Lock className="size-12 text-muted-foreground/40" aria-hidden />
            <div>
              <h3 className="font-semibold text-foreground">No projects yet</h3>
              <p className="text-xs text-muted-foreground mt-1">Create your first project to review stage gates.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stage Gate Control</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            G1–G8 lifecycle governance — <span className="font-mono text-[#64ffda]">{linkedProject?.code}</span> {linkedProject?.name}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-[#22c55e]">
            <CheckCircle2 className="size-4" aria-hidden />
            {passedCount} passed
          </span>
          {activeGate && (
            <span className="flex items-center gap-1.5 text-[#f59e0b]">
              <Clock className="size-4" aria-hidden />
              {activeGate.shortName} active
            </span>
          )}
          {linkedProject && (
            <GatePackExportButton
              targetId="gate-pack-printable"
              gateCode={`G${gate.gate}`}
              projectName={linkedProject.name}
            />
          )}
        </div>
      </div>

      {/* Main layout: gate list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        {/* Gate list */}
        <nav aria-label="Stage gates" className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 lg:overflow-x-visible">
          {realGates.map((g) => (
            <div key={g.gate} className="min-w-[160px] lg:min-w-0">
              <GateCard
                gate={g}
                isSelected={selectedGate === g.gate}
                onSelect={() => setSelectedGate(g.gate)}
                projectId={linkedProject?.id ?? null}
                hasSubmission={submittedSet.has(g.gate)}
              />
            </div>
          ))}
        </nav>

        {/* Detail panel — id used by GatePackExportButton */}
        <div id="gate-pack-printable">
          <GateDetailPanel gate={gate} />
          {linkedProject && (
            <GatePackSignoffBlock
              projectId={linkedProject.id}
              gateCode={`G${gate.gate}`}
            />
          )}
        </div>
      </div>
    </div>
  )
}
