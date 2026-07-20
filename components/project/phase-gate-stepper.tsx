'use client'

import * as React from 'react'
import {
  Check,
  Lock,
  ChevronRight,
  X,
  CalendarDays,
  Target,
  Users,
  FileCheck2,
  Milestone,
  Zap,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────
// Gate definitions
// ─────────────────────────────────────────────────────────────

export interface GateDef {
  id: number
  code: string
  shortName: string
  fullName: string
  purpose: string
  phase: string
  phaseColor: string
  keyDeliverables: string[]
  typicalDuration: string
  approvers: string[]
}

export const GATE_DEFINITIONS: GateDef[] = [
  {
    id: 0,
    code: 'G0',
    shortName: 'Opportunity Accepted',
    fullName: 'G0 — Opportunity Accepted',
    purpose: 'Formal acceptance of a new project opportunity into the GridMind pipeline. Confirms strategic fit, preliminary resource allocation, and assigns a Project Sponsor.',
    phase: 'Intake',
    phaseColor: '#64748b',
    keyDeliverables: ['Opportunity Brief', 'Strategic Fit Assessment', 'Initial Risk Register', 'Sponsor Assignment'],
    typicalDuration: '1–2 weeks',
    approvers: ['Portfolio Steering Committee', 'Project Sponsor'],
  },
  {
    id: 1,
    code: 'G1',
    shortName: 'Project Baseline Approved',
    fullName: 'G1 — Project Baseline Approved',
    purpose: 'Locks the project baseline: scope, schedule, budget, and team. Triggers transition from development to active delivery.',
    phase: 'Development',
    phaseColor: '#3b82f6',
    keyDeliverables: ['Project Charter', 'Baseline Schedule', 'Approved Budget', 'Risk Management Plan'],
    typicalDuration: '2–4 weeks',
    approvers: ['PMO Director', 'CFO', 'Project Sponsor'],
  },
  {
    id: 2,
    code: 'G2',
    shortName: 'Engineering IFC Release',
    fullName: 'G2 — Engineering IFC Release',
    purpose: 'Confirms all Issued for Construction (IFC) drawings and technical specifications are complete and approved, enabling procurement to commence.',
    phase: 'Engineering',
    phaseColor: '#6366f1',
    keyDeliverables: ['IFC Drawing Package', 'Technical Specifications', 'Engineering Review Sign-Off', 'BIM Model Issued'],
    typicalDuration: '4–8 weeks',
    approvers: ['Lead Engineer', 'Design Review Board', 'Client Representative'],
  },
  {
    id: 3,
    code: 'G3',
    shortName: 'Procurement Award',
    fullName: 'G3 — Procurement Award',
    purpose: 'Confirms award of all major supply contracts and subcontract packages. Full procurement close-out before mobilisation.',
    phase: 'Procurement',
    phaseColor: '#8b5cf6',
    keyDeliverables: ['Signed Contracts', 'Procurement Register', 'Logistics Plan', 'Insurance Certificates'],
    typicalDuration: '6–12 weeks',
    approvers: ['Commercial Director', 'Legal Counsel', 'PMO Director'],
  },
  {
    id: 4,
    code: 'G4',
    shortName: 'Construction Mobilization',
    fullName: 'G4 — Construction Mobilization',
    purpose: 'Authorises full site mobilisation. Confirms HSE plans, site access, temporary works, and construction methodology are approved.',
    phase: 'Construction',
    phaseColor: '#f97316',
    keyDeliverables: ['HSMP Approved', 'Mobilisation Plan', 'Site Establishment Complete', 'Subcontractor Induction Records'],
    typicalDuration: '2–3 weeks',
    approvers: ['Construction Manager', 'HSE Director', 'Client Authority'],
  },
  {
    id: 5,
    code: 'G5',
    shortName: 'Mechanical Completion',
    fullName: 'G5 — Mechanical Completion',
    purpose: 'Certifies that all physical construction works are complete per the IFC drawings. Triggers pre-commissioning activities.',
    phase: 'Construction',
    phaseColor: '#f97316',
    keyDeliverables: ['Mechanical Completion Certificate', 'Punch List (Cat A cleared)', 'As-Built Drawings (Preliminary)', 'System Handover Packages'],
    typicalDuration: '1–2 weeks',
    approvers: ['Site Manager', 'Client Inspector', 'Independent Certifier'],
  },
  {
    id: 6,
    code: 'G6',
    shortName: 'Commissioning Completion',
    fullName: 'G6 — Commissioning Completion',
    purpose: 'Confirms all systems have been tested, commissioned, and are operating within specification. Enables commercial operation declaration.',
    phase: 'Commissioning',
    phaseColor: '#14b8a6',
    keyDeliverables: ['Commissioning Test Reports', 'Performance Test Certificate', 'O&M Manuals Issued', 'Training Records'],
    typicalDuration: '3–6 weeks',
    approvers: ['Commissioning Manager', 'Grid Authority', 'Independent Engineer'],
  },
  {
    id: 7,
    code: 'G7',
    shortName: 'Handover & Warranty Start',
    fullName: 'G7 — Handover and Warranty Start',
    purpose: 'Formal transfer of the asset to the Owner/Operator. Warranty period commences and defects liability clock starts.',
    phase: 'Handover',
    phaseColor: '#22c55e',
    keyDeliverables: ['Taking-Over Certificate', 'Final As-Built Package', 'Warranty Schedule', 'Asset Register'],
    typicalDuration: '1–2 weeks',
    approvers: ['Project Director', 'Asset Owner', 'Financial Lenders'],
  },
  {
    id: 8,
    code: 'G8',
    shortName: 'Operations Performance Review',
    fullName: 'G8 — Operations Performance Review',
    purpose: 'Formal review of operational performance against contractual KPIs after 12 months of operation. Triggers final account settlement.',
    phase: 'O&M',
    phaseColor: '#10b981',
    keyDeliverables: ['Performance Report (Year 1)', 'KPI Scorecard', 'Final Account Statement', 'Lessons Learned Register'],
    typicalDuration: '4 weeks',
    approvers: ['O&M Director', 'Lenders Technical Advisor', 'Asset Management Board'],
  },
  {
    id: 9,
    code: 'G9',
    shortName: 'AI/Enterprise Optimization',
    fullName: 'G9 — AI & Enterprise Optimization',
    purpose: 'Continuous improvement gate driven by GridMind AI analytics. Evaluates operational data to optimise yield, reduce OPEX, and surface portfolio insights.',
    phase: 'AI & Analytics',
    phaseColor: '#06b6d4',
    keyDeliverables: ['AI Analytics Dashboard', 'Optimisation Recommendations', 'OPEX Reduction Plan', 'Digital Twin Baseline'],
    typicalDuration: 'Ongoing (quarterly review)',
    approvers: ['Chief Digital Officer', 'Asset Performance Team', 'GridMind AI Governance Board'],
  },
]

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type GateState = 'completed' | 'current' | 'future' | 'locked'

export interface PhaseGateStepperProps {
  /** Gate code string, e.g. "G2" */
  currentGate: string
  /** Array of completed gate code strings, e.g. ["G0", "G1"] */
  completedGates?: string[]
  className?: string
  onGateClick?: (gate: GateDef, state: GateState) => void
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getGateState(gateCode: string, currentGate: string, completedGates: string[]): GateState {
  if (completedGates.includes(gateCode)) return 'completed'
  if (gateCode === currentGate) return 'current'
  const currentIdx = GATE_DEFINITIONS.findIndex((g) => g.code === currentGate)
  const gateIdx = GATE_DEFINITIONS.findIndex((g) => g.code === gateCode)
  if (gateIdx < currentIdx && !completedGates.includes(gateCode)) return 'locked'
  return 'future'
}

// ─────────────────────────────────────────────────────────────
// GateNode
// ─────────────────────────────────────────────────────────────

interface GateNodeProps {
  gate: GateDef
  state: GateState
  isLast: boolean
  onClick: () => void
  tooltipVisible: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  isActive: boolean
}

function GateNode({
  gate,
  state,
  isLast,
  onClick,
  tooltipVisible,
  onMouseEnter,
  onMouseLeave,
  isActive,
}: GateNodeProps) {
  return (
    <div className="flex flex-col items-center relative">
      {/* Node + connector row */}
      <div className="flex items-center">
        {/* Connector line (before node, except first) */}
        <div
          className={cn(
            'hidden sm:block h-[2px] w-8 xl:w-12 transition-colors duration-300',
            gate.id === 0 && 'hidden',
            state === 'completed' || (state === 'current' && gate.id > 0)
              ? 'bg-[#22c55e]'
              : 'bg-border',
          )}
          aria-hidden="true"
        />

        {/* Clickable node */}
        <div className="relative flex flex-col items-center" style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onMouseEnter}
            onBlur={onMouseLeave}
            aria-label={`${gate.fullName} — ${state}`}
            aria-pressed={isActive}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'relative flex items-center justify-center rounded-full',
              'size-10 shrink-0',
              'border-2 transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              // State styles
              state === 'completed' && [
                'bg-[#22c55e] border-[#22c55e]',
                'hover:scale-110 cursor-pointer shadow-[0_0_0_3px_rgba(34,197,94,0.15)]',
              ],
              state === 'current' && [
                'bg-[#0a192f] border-[#64ffda]',
                'cursor-pointer scale-110',
                'shadow-[0_0_0_4px_rgba(100,255,218,0.15),0_0_16px_rgba(100,255,218,0.1)]',
                'dark:bg-[#112240] dark:border-[#64ffda]',
              ],
              state === 'locked' && [
                'bg-muted border-border',
                'cursor-pointer hover:border-muted-foreground/50',
              ],
              state === 'future' && [
                'bg-background border-border',
                'cursor-pointer hover:border-muted-foreground hover:bg-muted/30',
              ],
              isActive && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
            )}
          >
            {/* Pulse ring for current */}
            {state === 'current' && (
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-30 bg-[#64ffda]"
                aria-hidden="true"
              />
            )}

            {/* Icon / number */}
            {state === 'completed' && (
              <Check className="size-4 text-white" strokeWidth={3} aria-hidden="true" />
            )}
            {state === 'current' && (
              <span className="text-[#64ffda] font-mono font-bold text-sm leading-none">
                {gate.id}
              </span>
            )}
            {state === 'locked' && (
              <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
            )}
            {state === 'future' && (
              <span className="text-muted-foreground font-mono font-semibold text-sm leading-none">
                {gate.id}
              </span>
            )}
          </button>

          {/* Tooltip */}
          {tooltipVisible && (
            <div
              role="tooltip"
              id={`tooltip-gate-${gate.id}`}
              className={cn(
                'absolute bottom-full mb-3 z-50',
                'w-64 rounded-xl border border-border bg-popover p-3.5 shadow-xl',
                'animate-[fade-in_0.12s_ease-out]',
                // Align to edges for first/last gates
                gate.id <= 1 ? 'left-0' : gate.id >= 8 ? 'right-0' : '-translate-x-1/2 left-1/2',
              )}
            >
              <div className="flex items-start gap-2 mb-2">
                <span
                  className="inline-block size-2 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: gate.phaseColor }}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-mono font-semibold text-foreground leading-tight">
                    {gate.code} · {gate.phase}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {gate.purpose.length > 90 ? gate.purpose.slice(0, 90) + '…' : gate.purpose}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-2 border-t border-border">
                <Clock className="size-3" />
                <span>{gate.typicalDuration}</span>
              </div>
              {/* Caret */}
              <div
                className={cn(
                  'absolute top-full w-2 h-2 border-b border-r border-border bg-popover rotate-45 -mt-1',
                  gate.id <= 1 ? 'left-4' : gate.id >= 8 ? 'right-4' : 'left-1/2 -translate-x-1/2',
                )}
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        {/* Connector line (after node, except last) */}
        {!isLast && (
          <div
            className={cn(
              'hidden sm:block h-[2px] w-8 xl:w-12 transition-colors duration-300',
              state === 'completed' ? 'bg-[#22c55e]' : 'bg-border',
            )}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Label below node */}
      <div className="mt-2.5 flex flex-col items-center gap-0.5 w-14 xl:w-16">
        <span
          className={cn(
            'font-mono text-[11px] font-bold leading-none',
            state === 'completed' && 'text-[#22c55e]',
            state === 'current' && 'text-[#64ffda]',
            state === 'locked' && 'text-muted-foreground/50',
            state === 'future' && 'text-muted-foreground',
          )}
        >
          {gate.code}
        </span>
        <span
          className={cn(
            'text-[10px] leading-tight text-center',
            state === 'completed' && 'text-foreground/70',
            state === 'current' && 'text-foreground font-medium',
            (state === 'locked' || state === 'future') && 'text-muted-foreground/60',
          )}
          style={{ maxWidth: '56px' }}
        >
          {gate.shortName.split(' ').slice(0, 3).join(' ')}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Detail Panel (slide-in from right)
// ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  gate: GateDef | null
  state: GateState | null
  onClose: () => void
}

const STATE_BANNERS: Record<GateState, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  completed: {
    bg: 'bg-[#22c55e]/10 border-[#22c55e]/20',
    text: 'text-[#22c55e]',
    icon: <CheckCircle2 className="size-4" />,
    label: 'Completed',
  },
  current: {
    bg: 'bg-[#64ffda]/10 border-[#64ffda]/20',
    text: 'text-[#64ffda]',
    icon: <Milestone className="size-4" />,
    label: 'Active Gate',
  },
  future: {
    bg: 'bg-[#3b82f6]/10 border-[#3b82f6]/20',
    text: 'text-[#3b82f6]',
    icon: <CalendarDays className="size-4" />,
    label: 'Upcoming',
  },
  locked: {
    bg: 'bg-[#f59e0b]/10 border-[#f59e0b]/20',
    text: 'text-[#f59e0b]',
    icon: <AlertCircle className="size-4" />,
    label: 'Locked — complete previous gate first',
  },
}

function DetailPanel({ gate, state, onClose }: DetailPanelProps) {
  const banner = state ? STATE_BANNERS[state] : null

  // Close on Escape
  React.useEffect(() => {
    if (!gate) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gate, onClose])

  return (
    <AnimatePresence>
      {gate !== null && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={gate ? `${gate.code} Gate Details` : 'Gate Details'}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'fixed right-0 top-0 h-full z-50 w-full max-w-md',
              'bg-card border-l border-border shadow-2xl',
              'flex flex-col',
            )}
          >
        {/* Panel header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border shrink-0">
          <div className="min-w-0">
            {gate && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: gate.phaseColor }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    {gate.phase}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-foreground leading-tight font-sans">
                  {gate.fullName}
                </h2>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close gate details"
            className="shrink-0 mt-0.5"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {gate && banner && (
            <>
              {/* Status banner */}
              <div className={cn('flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium', banner.bg, banner.text)}>
                {banner.icon}
                {banner.label}
              </div>

              {/* Purpose */}
              <section aria-labelledby={`panel-purpose-${gate.id}`}>
                <h3 id={`panel-purpose-${gate.id}`} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Purpose
                </h3>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {gate.purpose}
                </p>
              </section>

              {/* Key deliverables */}
              <section aria-labelledby={`panel-deliverables-${gate.id}`}>
                <h3 id={`panel-deliverables-${gate.id}`} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileCheck2 className="size-3.5" />
                  Key Deliverables
                </h3>
                <ul className="space-y-1.5" role="list">
                  {gate.keyDeliverables.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className="size-3.5 text-[#22c55e] mt-0.5 shrink-0" strokeWidth={3} aria-hidden="true" />
                      {d}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Approvers */}
              <section aria-labelledby={`panel-approvers-${gate.id}`}>
                <h3 id={`panel-approvers-${gate.id}`} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  Approvers
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {gate.approvers.map((a) => (
                    <Badge key={a} variant="outline" className="text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              </section>

              {/* Duration + Phase */}
              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Typical Duration</p>
                  <p className="text-sm font-semibold text-foreground">{gate.typicalDuration}</p>
                </div>
                <div className="rounded-lg bg-muted/50 border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Project Phase</p>
                  <span
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border"
                    style={{
                      backgroundColor: `${gate.phaseColor}18`,
                      color: gate.phaseColor,
                      borderColor: `${gate.phaseColor}30`,
                    }}
                  >
                    {gate.phase}
                  </span>
                </div>
              </section>

              {/* CTA for current/locked */}
              {state === 'current' && (
                <Button variant="gate" className="w-full" size="lg">
                  <Target className="size-4" />
                  Open Gate Review
                </Button>
              )}
              {state === 'locked' && (
                <div className="rounded-lg bg-[#f59e0b]/8 border border-[#f59e0b]/20 p-3.5 text-sm text-[#f59e0b]">
                  <p className="font-medium mb-1">Gate Locked</p>
                  <p className="text-xs text-[#f59e0b]/80 leading-relaxed">
                    Complete all prior gates and their deliverables before this gate can be initiated.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} />
}

function PhaseGateStepperSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Skeleton className="h-5 w-32 mb-5" />
      <div className="flex items-end gap-0 overflow-x-auto pb-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center flex-1 min-w-[64px]">
            <div className="flex items-center w-full justify-center">
              {i > 0 && <Skeleton className="h-0.5 flex-1" />}
              <Skeleton className="size-10 rounded-full shrink-0 mx-1" />
              {i < 9 && <Skeleton className="h-0.5 flex-1" />}
            </div>
            <Skeleton className="h-3 w-8 mt-2.5" />
            <Skeleton className="h-2.5 w-12 mt-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function PhaseGateStepper({
  currentGate,
  completedGates = [],
  className,
  onGateClick,
}: PhaseGateStepperProps) {
  const [activeTooltip, setActiveTooltip] = React.useState<number | null>(null)
  const [activePanel, setActivePanel] = React.useState<{ gate: GateDef; state: GateState } | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const handleGateClick = React.useCallback((gate: GateDef, state: GateState) => {
    setActivePanel({ gate, state })
    onGateClick?.(gate, state)
  }, [onGateClick])

  const closePanel = React.useCallback(() => setActivePanel(null), [])

  // Scroll current gate into view on mount
  React.useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-gate-code="${currentGate}"]`) as HTMLElement | null
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [currentGate])

  return (
    <>
      <nav
        aria-label="Project stage gates"
        className={cn('rounded-xl border border-border bg-card', className)}
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-[#64ffda] shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground font-sans">Stage Gate Progress</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              {completedGates.length}/10 Complete
            </span>
            <Badge variant="gate" className="tabular-nums">
              {currentGate} Active
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-5 py-3 border-b border-border">
          <div
            className="h-1 w-full rounded-full bg-border overflow-hidden"
            role="progressbar"
            aria-valuenow={completedGates.length}
            aria-valuemin={0}
            aria-valuemax={10}
            aria-label={`${completedGates.length} of 10 gates completed`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#64ffda] transition-all duration-500"
              style={{ width: `${(completedGates.length / 10) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {Math.round((completedGates.length / 10) * 100)}% of gate milestones reached
          </p>
        </div>

        {/* Stepper scroll area */}
        <div
          ref={scrollRef}
          className="overflow-x-auto overscroll-x-contain"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          <div
            className="flex items-start px-4 py-5 gap-0 min-w-max sm:min-w-0 sm:w-full"
            role="list"
          >
            {GATE_DEFINITIONS.map((gate, idx) => {
              const state = getGateState(gate.code, currentGate, completedGates)
              return (
                <div
                  key={gate.code}
                  data-gate-code={gate.code}
                  role="listitem"
                  style={{ scrollSnapAlign: 'center' }}
                  className={cn(
                    'flex flex-col items-center',
                    'px-1.5 sm:flex-1',
                  )}
                >
                  <GateNode
                    gate={gate}
                    state={state}
                    isLast={idx === GATE_DEFINITIONS.length - 1}
                    onClick={() => handleGateClick(gate, state)}
                    tooltipVisible={activeTooltip === gate.id}
                    onMouseEnter={() => setActiveTooltip(gate.id)}
                    onMouseLeave={() => setActiveTooltip(null)}
                    isActive={activePanel?.gate.code === gate.code}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 pb-4 border-t border-border pt-3">
          {([
            { state: 'completed', color: 'bg-[#22c55e]', label: 'Completed' },
            { state: 'current',   color: 'bg-[#0a192f] border-2 border-[#64ffda]', label: 'Active' },
            { state: 'future',    color: 'bg-background border-2 border-border', label: 'Upcoming' },
            { state: 'locked',    color: 'bg-muted border-2 border-border', label: 'Locked' },
          ] as const).map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5" aria-hidden="true">
              <span className={cn('size-3 rounded-full shrink-0', color)} />
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </nav>

      {/* Detail panel — AnimatePresence drives slide-in/out */}
      <DetailPanel
        gate={activePanel?.gate ?? null}
        state={activePanel?.state ?? null}
        onClose={closePanel}
      />
    </>
  )
}

export { PhaseGateStepperSkeleton }
