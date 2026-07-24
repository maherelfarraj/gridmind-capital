'use client'
import React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { getG6Data } from '@/app/actions/commissioning'
import { ChevronRight, Plus, TrendingUp, Zap, AlertTriangle, FlaskConical, CheckCircle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'
import type { GateDef, GateState } from '@/components/project/phase-gate-stepper'

import { TestPackagesTab }  from '@/components/g6/test-packages-tab'
import { PerformanceTab }   from '@/components/g6/performance-tab'
import { EnergizationTab }  from '@/components/g6/energization-tab'
import { FailuresTab }      from '@/components/g6/failures-tab'
import { TrainingTab }      from '@/components/g6/training-tab'
import { DocumentationTab } from '@/components/g6/documentation-tab'
import { GuaranteesCloseoutCard } from '@/components/g6/guarantees-closeout-card'
import { GridComplianceSection }  from '@/components/energy/energy-dashboard'

import {
  MOCK_TEST_PACKAGES,
  MOCK_PERF_TESTS,
  MOCK_ENERGIZATION,
  MOCK_FAILURES,
  MOCK_TRAINING,
  MOCK_COMM_DOCS,
} from '@/components/g6/data'

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = 'testpackages' | 'performance' | 'energization' | 'failures' | 'training' | 'documentation' | 'grid-compliance'

// ─── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { label: 'Test Packages',    value: '24',    sub: 'total',       icon: <FlaskConical size={18} />, color: '#0f766e', bg: '#ccfbf1' },
    { label: 'Tests Complete',   value: '18/24', sub: 'complete',    icon: <CheckCircle  size={18} />, color: '#16a34a', bg: '#dcfce7' },
    { label: 'Performance Tests',value: '4/6',   sub: 'passed',      icon: <TrendingUp   size={18} />, color: '#d97706', bg: '#fef3c7' },
    { label: 'Energization',     value: '1/2',   sub: 'complete',    icon: <Zap          size={18} />, color: '#1d4ed8', bg: '#dbeafe' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
          <span className="p-2.5 rounded-xl" style={{ background: s.bg, color: s.color }}>{s.icon}</span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className="text-xl font-bold text-slate-900">{s.value}</p>
            <p className="text-[10px] text-slate-400">{s.sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function G6Page() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = React.useState<TabId>('testpackages')

  const { data: g6Data } = useSWR(
    id ? `g6-data-${id}` : null,
    () => getG6Data(id!),
  )

  const testPackages = ((g6Data && g6Data.testPackages.length > 0
    ? g6Data.testPackages : null) ?? MOCK_TEST_PACKAGES) as unknown as typeof MOCK_TEST_PACKAGES

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'testpackages',  label: 'Test Packages',      count: testPackages.length },
    { id: 'performance',   label: 'Performance Tests',  count: MOCK_PERF_TESTS.length },
    { id: 'energization',  label: 'Energization',       count: MOCK_ENERGIZATION.length },
    { id: 'failures',      label: 'Failures',           count: MOCK_FAILURES.filter((f) => f.status !== 'closed').length },
    { id: 'training',         label: 'Training Records',   count: MOCK_TRAINING.length },
    { id: 'documentation',    label: 'Documentation',      count: MOCK_COMM_DOCS.length },
    { id: 'grid-compliance',  label: 'Grid Compliance' },
  ]

  return (
    <div className="bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto p-6">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
            <Link href="/projects" className="hover:text-slate-700">Projects</Link>
            <ChevronRight size={14} />
            <Link href={`/projects/${id}`} className="hover:text-slate-700">SOL-2026-001</Link>
            <ChevronRight size={14} />
            <span className="text-slate-700 font-medium">G6 Commissioning</span>
          </nav>

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">G6: Commissioning Completion</h1>
                <span className="bg-teal-100 text-teal-700 text-xs font-bold px-2 py-1 rounded">G6</span>
                <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-1 rounded">In Progress</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">Commissioning test packages, performance testing, and system energization</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Link href={`/stage-gates/${id}/gate/6`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors">
                <FileText size={14} /> Gate Submission Form
              </Link>
              <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors shadow-sm">
                <Plus size={14} /> New Test Package
              </button>
              <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors">
                <TrendingUp size={14} /> Performance Test
              </button>
              <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors">
                <Zap size={14} /> Energization Checklist
              </button>
              <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors">
                <AlertTriangle size={14} /> Failure Report
              </button>
            </div>
          </div>

          {/* Gate Stepper */}
          <div className="mb-6">
            <PhaseGateStepper
              currentGate="G6"
              completedGates={['G0', 'G1', 'G2', 'G3', 'G4', 'G5']}
              onGateClick={(gate: GateDef, _state: GateState) => { if (gate.code !== 'G6') window.location.href = `/projects/${id}/${gate.code.toLowerCase()}` }}
            />
          </div>

          {/* Stats bar */}
          <StatsBar />

          {/* Financial closeout: bank guarantee discharge gate */}
          <GuaranteesCloseoutCard projectId={id} />

          {/* Tab navigation */}
          <div className="flex gap-0 border-b border-slate-200 mb-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                  activeTab === tab.id
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                )}>
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    activeTab === tab.id ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500')}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'testpackages'   && <TestPackagesTab  packages={testPackages} />}
          {activeTab === 'performance'    && <PerformanceTab   tests={MOCK_PERF_TESTS}        />}
          {activeTab === 'energization'   && <EnergizationTab  records={MOCK_ENERGIZATION}    />}
          {activeTab === 'failures'       && <FailuresTab       failures={MOCK_FAILURES}       />}
          {activeTab === 'training'       && <TrainingTab       records={MOCK_TRAINING}        />}
          {activeTab === 'documentation'  && <DocumentationTab  docs={MOCK_COMM_DOCS}          />}
          {activeTab === 'grid-compliance' && (
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6">
              <GridComplianceSection projectId={id} />
            </div>
          )}

        </div>
    </div>
  )
}
