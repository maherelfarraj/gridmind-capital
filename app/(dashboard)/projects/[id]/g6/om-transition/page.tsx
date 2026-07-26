'use client'
import React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { getProject } from '@/app/actions/projects'
import {
  ChevronRight, CheckCircle2, Circle, PartyPopper, X,
  BarChart2, Calendar, Users, FileCheck2, Zap, Award,
  ClipboardCheck, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'
import type { GateDef, GateState } from '@/components/project/phase-gate-stepper'
import { HandoverChecklist } from '@/components/g7/handover-checklist'
import { AssetRegistry }     from '@/components/g7/asset-registry'
import { OmTransition }      from '@/components/g7/om-transition'
import {
  MOCK_MILESTONES,
  MOCK_ASSETS,
  MOCK_OM_PERSONNEL,
  MOCK_MAINTENANCE,
  MOCK_WARRANTIES,
  MOCK_SLA,
} from '@/components/g7/data'

// ─── Closeout checklist types ─────────────────────────────────
type CheckStatus = 'complete' | 'in-progress' | 'pending'

interface CloseoutItem {
  id: string
  label: string
  description: string
  status: CheckStatus
  owner: string
}

const INITIAL_CLOSEOUT: CloseoutItem[] = [
  {
    id: 'co1',
    label: 'Final Accounts Settled',
    description: 'All contractor final accounts agreed and settled; retention released.',
    status: 'in-progress',
    owner: 'Commercial Director',
  },
  {
    id: 'co2',
    label: 'As-Built Documentation Delivered',
    description: 'Complete as-built drawing package issued to the Asset Owner and uploaded to the DMS.',
    status: 'complete',
    owner: 'Lead Engineer',
  },
  {
    id: 'co3',
    label: 'O&M Manuals Handed Over',
    description: 'All O&M manuals, maintenance schedules, and spare parts lists transferred.',
    status: 'complete',
    owner: 'Commissioning Manager',
  },
  {
    id: 'co4',
    label: 'Lessons-Learned Workshop Held',
    description: 'Post-project lessons-learned session completed; register published to the PMO knowledge base.',
    status: 'pending',
    owner: 'PMO Director',
  },
  {
    id: 'co5',
    label: 'Project Formally Closed',
    description: 'Project close-out notice issued; WBS codes closed in the ERP; team demobilised.',
    status: 'pending',
    owner: 'Project Director',
  },
]

// ─── Status meta ──────────────────────────────────────────────
const STATUS_META: Record<CheckStatus, { label: string; color: string; icon: React.ReactNode }> = {
  complete:    { label: 'Complete',    color: '#22c55e', icon: <CheckCircle2 size={16} className="shrink-0" /> },
  'in-progress': { label: 'In Progress', color: '#f59e0b', icon: <AlertCircle   size={16} className="shrink-0" /> },
  pending:     { label: 'Pending',     color: '#94a3b8', icon: <Circle          size={16} className="shrink-0" /> },
}

// ─── Closeout Checklist component ────────────────────────────
function CloseoutChecklist() {
  const [items, setItems] = React.useState<CloseoutItem[]>(INITIAL_CLOSEOUT)

  function advance(id: string) {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        const next: Record<CheckStatus, CheckStatus> = {
          pending: 'in-progress',
          'in-progress': 'complete',
          complete: 'complete',
        }
        return { ...item, status: next[item.status] }
      })
    )
  }

  const complete = items.filter(i => i.status === 'complete').length
  const pct = Math.round((complete / items.length) * 100)

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <ClipboardCheck size={18} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">Closeout Checklist</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{complete} of {items.length} items complete</p>
          </div>
        </div>
        {/* Progress bar + percentage */}
        <div className="flex items-center gap-3 min-w-[140px]">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm font-bold text-foreground tabular-nums w-10 text-right">{pct}%</span>
        </div>
      </div>

      {/* Items */}
      <ul className="divide-y divide-border">
        {items.map(item => {
          const meta = STATUS_META[item.status]
          return (
            <li key={item.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
              <span style={{ color: meta.color }} className="mt-0.5">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span
                    className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Owner: {item.owner}</p>
              </div>
              {item.status !== 'complete' && (
                <button
                  type="button"
                  onClick={() => advance(item.id)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted shrink-0 transition-colors font-medium text-muted-foreground hover:text-foreground"
                >
                  {item.status === 'pending' ? 'Start' : 'Mark Complete'}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {pct === 100 && (
        <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-t border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            All closeout items complete — project is ready for G6 gate approval.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Celebration overlay ──────────────────────────────────────
function CelebrationModal({
  onClose,
  projectName,
  projectCode,
  capacityMw,
}: {
  onClose: () => void
  projectName?: string
  projectCode?: string
  capacityMw?: number
}) {
  const stats = [
    { icon: <Calendar size={18} />,   label: 'Project Duration', value: '24 months' },
    { icon: <Users size={18} />,      label: 'Peak Headcount',   value: '412 people' },
    { icon: <FileCheck2 size={18} />, label: 'Docs Issued',      value: '1,847' },
    { icon: <Zap size={18} />,        label: 'Capacity',         value: capacityMw ? `${capacityMw} MW` : '—' },
    { icon: <BarChart2 size={18} />,  label: 'Budget Variance',  value: '+1.3%' },
    { icon: <Award size={18} />,      label: 'Safety Record',    value: '0 LTI' },
  ]
  const heading = [projectName, projectCode].filter(Boolean).join(' — ') || 'Project'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-emerald-200 overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-10 text-center text-white">
          <div className="text-5xl mb-3">
            <PartyPopper className="inline-block" size={52} />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Project Complete!</h2>
          <p className="text-emerald-100 mt-1 text-sm">{heading}</p>
          <p className="text-emerald-200 text-xs mt-0.5">
            G6 close-out confirmed {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="px-8 py-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 text-center">Project Summary</p>
          <div className="grid grid-cols-3 gap-3">
            {stats.map(s => (
              <div key={s.label} className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-3 text-center">
                <div className="text-emerald-600 flex justify-center mb-1">{s.icon}</div>
                <p className="text-base font-black text-slate-800">{s.value}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="px-8 pb-6 flex gap-3 justify-center">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
          >
            Close Out Project
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors"
          >
            Export Report
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function G6OmTransitionPage() {
  const { id } = useParams<{ id: string }>()
  const [showCelebration, setShowCelebration] = React.useState(false)

  const { data: project } = useSWR(
    id ? `project-${id}` : null,
    () => getProject(id!),
  )
  const currentGate    = `G${project?.gate ?? 6}`
  const completedGates = Array.from({ length: Math.max(0, project?.gate ?? 6) }, (_, i) => `G${i}`)

  const complete = MOCK_MILESTONES.filter(m => m.status === 'complete').length
  const allDone  = complete === MOCK_MILESTONES.length
  const pct      = Math.round((complete / MOCK_MILESTONES.length) * 100)

  return (
    <div className="bg-slate-50 dark:bg-background min-h-screen">
      <div className="max-w-7xl mx-auto p-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
          <Link href="/projects" className="hover:text-slate-700 dark:hover:text-foreground">Projects</Link>
          <ChevronRight size={14} />
          <Link href={`/projects/${id}`} className="hover:text-slate-700 dark:hover:text-foreground">{project?.code ?? id}</Link>
          <ChevronRight size={14} />
          <Link href={`/projects/${id}/g6`} className="hover:text-slate-700 dark:hover:text-foreground">G6</Link>
          <ChevronRight size={14} />
          <span className="text-slate-700 dark:text-foreground font-medium">O&amp;M Transition</span>
        </nav>

        {/* Header banner */}
        <div
          className="rounded-2xl overflow-hidden mb-6 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' }}
        >
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                  G6 · Handover, Operations &amp; Closeout
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {pct === 100 ? 'Ready to Close' : 'In Progress'}
                </span>
              </div>
              <h1 className="text-xl font-black text-white">G6 — O&amp;M Transition</h1>
              <p className="text-emerald-200 text-sm mt-0.5">
                Asset handover, documentation transfer, operator training &amp; warranty start
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] text-emerald-200 uppercase tracking-wider">Handover Progress</p>
                <p className="text-3xl font-black text-white">{pct}%</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCelebration(true)}
                disabled={!allDone}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all',
                  allDone
                    ? 'bg-white text-emerald-700 shadow-lg hover:shadow-xl hover:scale-105'
                    : 'bg-white/20 text-white/50 cursor-not-allowed'
                )}
              >
                <CheckCircle2 size={16} />
                G6 Gate Approval Request
              </button>
            </div>
          </div>
          <div className="h-1.5 bg-emerald-800/30">
            <div
              className="h-full bg-white/70 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Phase gate stepper */}
        <div className="mb-6">
          <PhaseGateStepper
            currentGate={currentGate}
            completedGates={completedGates}
            onGateClick={(gate: GateDef, _state: GateState) => {
              if (gate.code !== 'G6') {
                window.location.href = `/projects/${id}/${gate.code.toLowerCase()}`
              }
            }}
          />
        </div>

        {/* Section 1: Closeout Checklist (full width, shown first per P-A3) */}
        <div className="mb-6">
          <CloseoutChecklist />
        </div>

        {/* Section 2: O&M Handover Checklist (full width) */}
        <div className="mb-6">
          <HandoverChecklist milestones={MOCK_MILESTONES} />
        </div>

        {/* Sections 3 + 4: Asset Registry | O&M Transition details */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <AssetRegistry assets={MOCK_ASSETS} />
          </div>
          <div className="lg:col-span-2">
            <OmTransition
              personnel={MOCK_OM_PERSONNEL}
              maintenance={MOCK_MAINTENANCE}
              warranties={MOCK_WARRANTIES}
              sla={MOCK_SLA}
            />
          </div>
        </div>

      </div>

      {showCelebration && (
        <CelebrationModal
          onClose={() => setShowCelebration(false)}
          projectName={project?.name}
          projectCode={project?.code}
          capacityMw={project?.capacityMw}
        />
      )}
    </div>
  )
}
