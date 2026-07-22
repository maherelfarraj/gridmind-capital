'use client'
import React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronRight, CheckCircle2, PartyPopper, X, BarChart2,
  Calendar, Users, FileCheck2, Zap, Award,
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

// ─── Celebration overlay ──────────────────────────────────────────────────────
function CelebrationModal({ onClose }: { onClose: () => void }) {
  const stats = [
    { icon: <Calendar size={18} />,   label: 'Project Duration',  value: '24 months' },
    { icon: <Users size={18} />,      label: 'Peak Headcount',    value: '412 people' },
    { icon: <FileCheck2 size={18} />, label: 'Documents Issued',  value: '1,847' },
    { icon: <Zap size={18} />,        label: 'Capacity',          value: '400 MW' },
    { icon: <BarChart2 size={18} />,  label: 'Budget Variance',   value: '+1.3%' },
    { icon: <Award size={18} />,      label: 'Safety Record',     value: '0 LTI' },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-emerald-200 overflow-hidden">
        {/* Emerald celebration header */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-10 text-center text-white">
          <div className="text-5xl mb-3">
            <PartyPopper className="inline-block" size={52} />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Project Complete!</h2>
          <p className="text-emerald-100 mt-1 text-sm">Sirius 400MW Solar — SOL-2026-001</p>
          <p className="text-emerald-200 text-xs mt-0.5">Final close-out confirmed {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Stats */}
        <div className="px-8 py-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 text-center">Project Summary</p>
          <div className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-3 text-center">
                <div className="text-emerald-600 flex justify-center mb-1">{s.icon}</div>
                <p className="text-base font-black text-slate-800">{s.value}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 pb-6 flex gap-3 justify-center">
          <button type="button" onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
            Close Out Project
          </button>
          <button type="button" onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors">
            Export Report
          </button>
        </div>

        <button type="button" onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={18} /></button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function G7Page() {
  const { id } = useParams<{ id: string }>()
  const [showCelebration, setShowCelebration] = React.useState(false)

  const complete  = MOCK_MILESTONES.filter((m) => m.status === 'complete').length
  const allDone   = complete === MOCK_MILESTONES.length
  const pct       = Math.round((complete / MOCK_MILESTONES.length) * 100)

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto p-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
          <Link href="/projects" className="hover:text-slate-700">Projects</Link>
          <ChevronRight size={14} />
          <Link href={`/projects/${id}`} className="hover:text-slate-700">SOL-2026-001</Link>
          <ChevronRight size={14} />
          <span className="text-slate-700 font-medium">G7 Handover &amp; O&amp;M Transition</span>
        </nav>

        {/* Header banner */}
        <div className="rounded-2xl overflow-hidden mb-6 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' }}>
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Final Gate · G7</span>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {pct === 100 ? 'Ready to Close' : 'In Progress'}
                </span>
              </div>
              <h1 className="text-xl font-black text-white">Handover &amp; O&amp;M Transition</h1>
              <p className="text-emerald-200 text-sm mt-0.5">
                Asset handover, documentation transfer, operator training &amp; warranty start
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Overall progress pill */}
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
                Final Project Close-Out
              </button>
            </div>
          </div>

          {/* Progress bar in banner */}
          <div className="h-1.5 bg-emerald-800/30 mx-0">
            <div className="h-full bg-white/70 transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Phase gate stepper */}
        <div className="mb-6">
          <PhaseGateStepper
            currentGate="G7"
            completedGates={['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']}
            onGateClick={(gate: GateDef, _state: GateState) => {
              if (gate.code !== 'G7') window.location.href = `/projects/${id}/${gate.code.toLowerCase()}`
            }}
          />
        </div>

        {/* Section 1: Handover Checklist (full width) */}
        <div className="mb-6">
          <HandoverChecklist milestones={MOCK_MILESTONES} />
        </div>

        {/* Sections 2 + 3: Asset Registry | O&M Transition */}
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

      {showCelebration && <CelebrationModal onClose={() => setShowCelebration(false)} />}
    </div>
  )
}
