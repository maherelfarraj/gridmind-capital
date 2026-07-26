'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, FileText, Users, AlertTriangle, CheckSquare, BarChart2, ClipboardList, Send, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_CHARTER, getStatusMeta, MOCK_DELIVERABLES } from '@/components/g0/data'
import type { ProjectCharter } from '@/components/g0/types'
import { CharterTab }      from '@/components/g0/charter-tab'
import { DeliverablesTab } from '@/components/g0/deliverables-tab'
import { StakeholdersTab } from '@/components/g0/stakeholders-tab'
import { RisksTab }        from '@/components/g0/risks-tab'
import { ScreeningTab }    from '@/components/g0/screening-tab'
import { MilestonesTab }   from '@/components/g0/milestones-tab'
import { getG0Data } from '@/app/actions/gate-submissions'
import { getProject } from '@/app/actions/projects'

const TABS = [
  { id: 'charter',      label: 'Project Charter',       icon: FileText    },
  { id: 'screening',    label: 'Opp. Screening',        icon: CheckSquare },
  { id: 'deliverables', label: 'Deliverables',          icon: ClipboardList },
  { id: 'stakeholders', label: 'Stakeholders',          icon: Users       },
  { id: 'risks',        label: 'Initiation Risks',      icon: AlertTriangle },
  { id: 'milestones',   label: 'Milestones',            icon: BarChart2   },
] as const

type TabId = typeof TABS[number]['id']

export default function G0Page() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState<TabId>('charter')

  const { data: g0Data } = useSWR(
    id ? `g0-data-${id}` : null,
    () => getG0Data(id!),
  )

  // Load the ACTUAL project named by the route param. This page previously rendered
  // MOCK_CHARTER unconditionally, so every /g0 URL displayed SOL-2026-001 (Sirius)
  // no matter which project id was requested.
  const { data: project } = useSWR(
    id ? `project-${id}` : null,
    () => getProject(id!),
  )

  // Real project identity; mock values are used only as a pre-load placeholder so
  // the header does not flicker while SWR resolves.
  const charter = React.useMemo<ProjectCharter>(() => {
    if (!project) return MOCK_CHARTER
    return {
      ...MOCK_CHARTER,
      id:           project.id,
      project_code: project.code,
      project_name: project.name,
      technology:   project.technology || MOCK_CHARTER.technology,
      capacity_mw:  project.capacityMw ?? 0,
      location:     project.location || project.country || '—',
      country:      project.country || '—',
      client:       project.client,
      description:  project.description || MOCK_CHARTER.description,
      capex_estimate_usd: project.budgetUsd ?? 0,
      // A project that has advanced past G0 necessarily has an approved charter.
      status:       project.gate > 0 ? 'approved' : 'under_review',
    }
  }, [project])

  const meta       = getStatusMeta(charter.status)
  const done       = MOCK_DELIVERABLES.filter((d) => d.status === 'approved' || d.status === 'complete').length
  const total      = MOCK_DELIVERABLES.length
  const donePct    = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap">
          <button type="button" onClick={() => router.push(`/projects/${id}`)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <ArrowLeft className="size-4" /> Back to Project
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-muted-foreground">{charter.project_code}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full border"
                style={{ color: '#f59e0b', borderColor: '#f59e0b40', background: '#f59e0b12' }}>
                G0 — Initiation
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}12` }}>
                {meta.label}
              </span>
            </div>
            <h1 className="text-xl font-black text-foreground leading-tight">{charter.project_name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{charter.technology} · {charter.capacity_mw} MWp · {charter.location}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/stage-gates/${id}/gate/0`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <ClipboardList className="size-4" /> Gate Submission Form
            </Link>
            <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <Download className="size-4" /> Export PDF
            </button>
            <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm font-semibold text-amber-500 hover:bg-amber-500/20 transition-colors">
              <Send className="size-4" /> Submit for G0 Approval
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Gate',           value: 'G0 — Initiation',              color: '#f59e0b' },
            { label: 'Charter Status', value: meta.label,                     color: meta.color },
            { label: 'Deliverables',   value: `${done}/${total} (${donePct}%)`, color: '#22c55e' },
            { label: 'Charter Version',value: charter.version,                color: '#3b82f6' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
              <p className="text-sm font-bold truncate" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
            {TABS.map(({ id: tid, label, icon: Icon }) => (
              <button key={tid} type="button" onClick={() => setActiveTab(tid)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tid
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}>
                <Icon className="size-4" />{label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'charter'      && <CharterTab      formData={g0Data?.formData} />}
          {activeTab === 'screening'    && <ScreeningTab    hasSubmission={g0Data?.hasSubmission} />}
          {activeTab === 'deliverables' && <DeliverablesTab />}
          {activeTab === 'stakeholders' && <StakeholdersTab liveData={g0Data?.stakeholders} />}
          {activeTab === 'risks'        && <RisksTab        liveData={g0Data?.risks} />}
          {activeTab === 'milestones'   && <MilestonesTab   liveData={g0Data?.milestones} />}
        </div>

      </div>
    </div>
  )
}
