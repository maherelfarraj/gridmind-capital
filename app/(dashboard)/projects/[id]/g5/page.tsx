'use client'

import React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
import {
  ChevronRight, Plus, FileText, Download,
  Eye, ClipboardList, AlertCircle, CheckSquare, Award, FolderOpen, BarChart2,
} from 'lucide-react'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'
import { G5GateApprovalButton } from '@/components/g5/gate-approval-dialog'
import { getNcrs } from '@/app/actions/ncrs'

import { Tab, KpiCard } from '@/components/g5/shared'
import { InspectionsTab }   from '@/components/g5/inspections-tab'
import { PunchListTab }     from '@/components/g5/punch-tab'
import { NcrTab }           from '@/components/g5/ncr-tab'
import { TestPlansTab }     from '@/components/g5/test-plans-tab'
import { MCCertificatesTab } from '@/components/g5/certs-tab'
import { GateCertificatePanel } from '@/components/stage-gate/gate-certificate'
import { getProject } from '@/app/actions/projects'
import { AnalyticsTab }     from '@/components/g5/analytics-tab'
import { AsBuiltsTab }      from '@/components/g5/as-builts-tab'
import {
  MOCK_INSPECTIONS, MOCK_PUNCH_ITEMS, MOCK_NCRS,
  MOCK_MC_CERTS, MOCK_TEST_PLANS, MOCK_AS_BUILTS,
  MC_PROGRESS,
} from '@/components/g5/data'

const TABS = [
  { id: 'inspections', label: 'Inspections',     icon: Eye            },
  { id: 'punch',       label: 'Punch List',      icon: ClipboardList  },
  { id: 'ncr',         label: 'NCRs',            icon: AlertCircle    },
  { id: 'testplans',   label: 'Test Plans',      icon: CheckSquare    },
  { id: 'certs',       label: 'MC Certificates', icon: Award          },
  { id: 'asbuilts',    label: 'As-Builts',       icon: FolderOpen     },
  { id: 'analytics',   label: 'Analytics',       icon: BarChart2      },
] as const

type TabId = typeof TABS[number]['id']

export default function G5MechanicalCompletionPage() {
  const params    = useParams()
  const projectId = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? 'demo')
  const [activeTab, setActiveTab] = React.useState<TabId>('inspections')

  // Live NCRs drive the gate-approval guard + the Open NCRs KPI.
  const { data: ncrData } = useSWR(`g5-ncrs-${projectId}`, () => getNcrs(projectId))
  const liveOpenNcrs = ncrData?.kpis.open

  // Project name for the completion certificate.
  const { data: project } = useSWR(`project-${projectId}`, () => getProject(projectId))
  const certDeliverables = MC_PROGRESS.map((m) => ({
    label: m.system,
    status: m.pct >= 100 ? 'Complete' : `${m.pct}%`,
  }))

  const totalMC     = Math.round(MC_PROGRESS.reduce((s, r) => s + r.pct, 0) / MC_PROGRESS.length)
  const openPunchA  = MOCK_PUNCH_ITEMS.filter((p) => p.category === 'A' && p.status !== 'closed').length
  const openNcrs    = liveOpenNcrs ?? MOCK_NCRS.filter((n) => n.status !== 'closed').length
  const issuedCerts = MOCK_MC_CERTS.filter((c) => c.status === 'issued').length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
          <ChevronRight className="size-4" />
          <Link href={`/projects/${projectId}`} className="hover:text-foreground transition-colors font-mono text-xs">{projectId}</Link>
          <ChevronRight className="size-4" />
          <span className="text-foreground font-medium">G5 Mechanical Completion</span>
        </nav>

        {/* Phase gate stepper */}
        <PhaseGateStepper currentGate="G5" completedGates={['G0', 'G1', 'G2', 'G3', 'G4']} projectId={projectId} />

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">G5 Mechanical Completion</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Inspections · Punch Lists · NCRs · Test Plans · MC Certificates
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/stage-gates/${projectId}/gate/5`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <ClipboardList className="size-4" /> Gate Submission Form
            </Link>
            <button type="button"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <FileText className="size-4" /> ITP Register
            </button>
            <button type="button"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <Download className="size-4" /> Export Report
            </button>
            <button type="button"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <Plus className="size-4" /> New Inspection
            </button>
            <G5GateApprovalButton projectId={projectId} />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Overall MC %"     value={`${totalMC}%`}   color="#64ffda"  sub="across all systems"    />
          <KpiCard label="Open Cat-A Punch" value={openPunchA}       color="#ef4444"  sub="blocks MC certificate"  />
          <KpiCard label="Open NCRs"        value={openNcrs}         color="#f59e0b"  sub={openNcrs > 0 ? 'blocks G5 approval' : 'none — G5 clear'} />
          <KpiCard label="MC Certs Issued"  value={`${issuedCerts}/${MOCK_MC_CERTS.length}`} color="#22c55e" sub="systems certified" />
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          {TABS.map((t) => (
            <Tab key={t.id} label={t.label} icon={t.icon} active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)} />
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'inspections' && <InspectionsTab    inspections={MOCK_INSPECTIONS} projectId={projectId} />}
          {activeTab === 'punch'       && <PunchListTab      items={MOCK_PUNCH_ITEMS}        />}
          {activeTab === 'ncr'         && <NcrTab            ncrs={MOCK_NCRS}                />}
          {activeTab === 'testplans'   && <TestPlansTab      plans={MOCK_TEST_PLANS}         />}
          {activeTab === 'certs'       && (
            <div className="space-y-6">
              <GateCertificatePanel
                projectId={projectId}
                projectName={project?.name ?? projectId}
                gateCode="G5"
                gateName="Mechanical Completion"
                deliverables={certDeliverables}
              />
              <MCCertificatesTab certs={MOCK_MC_CERTS} />
            </div>
          )}
          {activeTab === 'asbuilts'    && <AsBuiltsTab       drawings={MOCK_AS_BUILTS}       />}
          {activeTab === 'analytics'   && <AnalyticsTab                                      />}
        </div>

      </div>
    </div>
  )
}
