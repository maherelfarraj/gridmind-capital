'use client'

import * as React from 'react'
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
  TrendingUp,
  Leaf,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

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

// ─── Mock gate data ───────────────────────────────────────────

const GATES: GateMeta[] = [
  {
    gate: 0, phase: 'Intake', shortName: 'G0', fullName: 'Project Registration & Screening',
    purpose: 'Validate strategic fit, assign project code, confirm preliminary resource availability.',
    color: '#64748b', icon: Zap, status: 'passed', approvedDate: '14 Jan 2025', approvedBy: 'A. Carter',
    reviewers: [{ name: 'A. Carter', initials: 'AC', color: '#64ffda', decision: 'approve' }],
    deliverables: [
      { id: 'g0d1', title: 'Project Registration Form', owner: 'A. Carter', status: 'complete', isMandatory: true },
      { id: 'g0d2', title: 'Strategic Fit Assessment',   owner: 'A. Carter', status: 'complete', isMandatory: true },
    ],
  },
  {
    gate: 1, phase: 'Development', shortName: 'G1', fullName: 'Development Sanction',
    purpose: 'Approve project development budget and confirm site acquisition pathway.',
    color: '#3b82f6', icon: Building2, status: 'passed', approvedDate: '08 Mar 2025', approvedBy: 'A. Carter',
    reviewers: [
      { name: 'A. Carter',  initials: 'AC', color: '#64ffda', decision: 'approve' },
      { name: 'R. Chen',    initials: 'RC', color: '#8b5cf6', decision: 'approve' },
    ],
    deliverables: [
      { id: 'g1d1', title: 'Preliminary Site Survey',          owner: 'M. Al-Farsi', status: 'complete', isMandatory: true },
      { id: 'g1d2', title: 'Grid Connection Pre-Application',  owner: 'R. Chen',     status: 'complete', isMandatory: true },
      { id: 'g1d3', title: 'Development Budget ($480M TBC)',   owner: 'A. Carter',   status: 'complete', isMandatory: true },
      { id: 'g1d4', title: 'Environmental Desk Study',         owner: 'L. Schmidt',  status: 'complete', isMandatory: false },
    ],
  },
  {
    gate: 2, phase: 'Commercial', shortName: 'G2', fullName: 'Commercial Sanction & PPA',
    purpose: 'Approve commercial structure, PPA execution and project finance term sheet.',
    color: '#6366f1', icon: TrendingUp, status: 'passed', approvedDate: '22 Apr 2025', approvedBy: 'A. Carter',
    reviewers: [
      { name: 'A. Carter',  initials: 'AC', color: '#64ffda', decision: 'approve' },
      { name: 'S. Park',    initials: 'SP', color: '#a855f7', decision: 'approve' },
      { name: 'T. Müller',  initials: 'TM', color: '#3b82f6', decision: 'approve' },
    ],
    deliverables: [
      { id: 'g2d1', title: 'PPA Executed (TotalEnergies)',           owner: 'R. Chen',    status: 'complete', isMandatory: true },
      { id: 'g2d2', title: 'Project Finance Term Sheet',             owner: 'A. Carter',  status: 'complete', isMandatory: true },
      { id: 'g2d3', title: 'Land Rights Agreement (20yr lease)',     owner: 'S. Park',    status: 'complete', isMandatory: true },
      { id: 'g2d4', title: 'Grid Connection Agreement',              owner: 'R. Chen',    status: 'complete', isMandatory: true },
    ],
  },
  {
    gate: 3, phase: 'Engineering', shortName: 'G3', fullName: 'Engineering Design Freeze',
    purpose: 'Approve IFT design package, confirm technology selections, release for IFC.',
    color: '#8b5cf6', icon: Wrench, status: 'passed', approvedDate: '10 Jun 2025', approvedBy: 'A. Carter',
    reviewers: [
      { name: 'A. Carter',   initials: 'AC', color: '#64ffda', decision: 'approve' },
      { name: 'M. Al-Farsi', initials: 'MA', color: '#f97316', decision: 'approve' },
      { name: 'J. Rivera',   initials: 'JR', color: '#22c55e', decision: 'approve' },
    ],
    deliverables: [
      { id: 'g3d1', title: 'IFT Drawing Package (100%)',          owner: 'M. Al-Farsi', status: 'complete', isMandatory: true },
      { id: 'g3d2', title: 'Tracker Technology Selection',        owner: 'M. Al-Farsi', status: 'complete', isMandatory: true },
      { id: 'g3d3', title: 'Inverter Technology Selection',       owner: 'R. Chen',     status: 'complete', isMandatory: true },
      { id: 'g3d4', title: 'BESS Interface Design Study',         owner: 'R. Chen',     status: 'complete', isMandatory: false },
      { id: 'g3d5', title: 'Geotechnical Final Report',           owner: 'M. Al-Farsi', status: 'complete', isMandatory: true },
    ],
  },
  {
    gate: 4, phase: 'Procurement', shortName: 'G4', fullName: 'Procurement Sanction & EPC Award',
    purpose: 'Approve procurement strategy, key equipment awards, and EPC sub-contract structure.',
    color: '#a855f7', icon: Truck, status: 'active',
    reviewers: [
      { name: 'A. Carter',  initials: 'AC', color: '#64ffda', decision: 'pending' },
      { name: 'T. Müller',  initials: 'TM', color: '#3b82f6', decision: 'pending' },
      { name: 'R. Chen',    initials: 'RC', color: '#8b5cf6', decision: 'approve' },
    ],
    deliverables: [
      { id: 'g4d1', title: 'IFC Drawing Package (100%)',           owner: 'M. Al-Farsi', status: 'complete',    isMandatory: true },
      { id: 'g4d2', title: 'Inverter Supply Contract',             owner: 'R. Chen',     status: 'complete',    isMandatory: true },
      { id: 'g4d3', title: 'Tracker Supply Contract',              owner: 'R. Chen',     status: 'complete',    isMandatory: true },
      { id: 'g4d4', title: 'HV Cable Supply Contract',             owner: 'R. Chen',     status: 'complete',    isMandatory: true },
      { id: 'g4d5', title: 'Civil EPC Sub-Contract Award',         owner: 'R. Chen',     status: 'in-progress', isMandatory: true, notes: 'Awaiting board sign-off on Construcciones Andinas SA award.' },
      { id: 'g4d6', title: 'Construction Safety Management Plan',  owner: 'L. Schmidt',  status: 'complete',    isMandatory: true },
      { id: 'g4d7', title: 'Environmental Permit (Final)',         owner: 'L. Schmidt',  status: 'in-progress', isMandatory: true, notes: 'Permit expected from CONAF by 25 Jul 2025.' },
      { id: 'g4d8', title: 'Insurance Placement Confirmation',     owner: 'A. Carter',   status: 'not-started', isMandatory: false },
    ],
  },
  {
    gate: 5, phase: 'Construction', shortName: 'G5', fullName: 'Construction Mobilization',
    purpose: 'Confirm site readiness, approve mobilization budget, release construction workforce.',
    color: '#f97316', icon: HardHat, status: 'locked',
    reviewers: [
      { name: 'A. Carter', initials: 'AC', color: '#64ffda', decision: 'pending' },
    ],
    deliverables: [
      { id: 'g5d1', title: 'Cat-A Punch List Closed (100%)',          owner: 'J. Rivera', status: 'not-started', isMandatory: true },
      { id: 'g5d2', title: 'Site Mobilization Plan',                  owner: 'J. Rivera', status: 'not-started', isMandatory: true },
      { id: 'g5d3', title: 'First Power Date Confirmed',              owner: 'R. Chen',   status: 'not-started', isMandatory: true },
      { id: 'g5d4', title: 'Commissioning Plan Rev A',                owner: 'T. Müller', status: 'not-started', isMandatory: true },
    ],
  },
  {
    gate: 6, phase: 'Commissioning', shortName: 'G6', fullName: 'Mechanical Completion',
    purpose: 'Declare mechanical completion and hand over systems for commissioning.',
    color: '#14b8a6', icon: Settings, status: 'locked',
    reviewers: [],
    deliverables: [
      { id: 'g6d1', title: 'Mechanical Completion Certificate', owner: 'J. Rivera', status: 'not-started', isMandatory: true },
      { id: 'g6d2', title: 'Systems Hand-Over Package',         owner: 'T. Müller', status: 'not-started', isMandatory: true },
    ],
  },
]

// ─── Deliverable status icon ──────────────────────────────────

function DeliverableIcon({ status }: { status: GateDeliverable['status'] }) {
  if (status === 'complete')    return <CheckCircle2 className="size-4 text-[#22c55e] shrink-0" aria-label="Complete" />
  if (status === 'in-progress') return <Clock        className="size-4 text-[#f59e0b] shrink-0" aria-label="In progress" />
  if (status === 'waived')      return <Shield       className="size-4 text-[#94a3b8] shrink-0" aria-label="Waived" />
  return                               <Clock        className="size-4 text-muted-foreground/40 shrink-0" aria-label="Not started" />
}

// ─── Gate card ────────────────────────────────────────────────

function GateCard({ gate, isSelected, onSelect }: {
  gate: GateMeta; isSelected: boolean; onSelect: () => void
}) {
  const Icon = gate.icon
  const completed = gate.deliverables.filter((d) => d.status === 'complete' || d.status === 'waived').length
  const total = gate.deliverables.length

  return (
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
  const [selectedGate, setSelectedGate] = React.useState<number>(4) // G4 active

  const gate = GATES.find((g) => g.gate === selectedGate) ?? GATES[4]

  const passedCount = GATES.filter((g) => g.status === 'passed').length
  const activeGate  = GATES.find((g) => g.status === 'active')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stage Gate Control</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            G0–G6 lifecycle governance — <span className="font-mono text-[#64ffda]">SRS-400</span> Sirius 400MW Solar Farm
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
        </div>
      </div>

      {/* Main layout: gate list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        {/* Gate list */}
        <nav aria-label="Stage gates" className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 lg:overflow-x-visible">
          {GATES.map((g) => (
            <div key={g.gate} className="min-w-[160px] lg:min-w-0">
              <GateCard
                gate={g}
                isSelected={selectedGate === g.gate}
                onSelect={() => setSelectedGate(g.gate)}
              />
            </div>
          ))}
        </nav>

        {/* Detail panel */}
        <div>
          <GateDetailPanel gate={gate} />
        </div>
      </div>
    </div>
  )
}
