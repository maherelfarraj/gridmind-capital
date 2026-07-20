'use client'

import * as React from 'react'
import {
  FolderKanban,
  Plus,
  Download,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, PhaseBadge } from '@/components/ui/badge'
import { DataRegister, type ColumnDef } from '@/components/ui/data-register'
import { MOCK_PROJECTS, type PipelineProject } from '@/components/dashboard/dashboard-data'
import type { PhaseKey } from '@/components/app-shell/nav-config'

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */

type ProjectStatus = 'active' | 'planning' | 'at-risk' | 'completed' | 'on-hold'

type PhaseFilter = 'all' | PhaseKey

interface PhaseTab {
  key: PhaseFilter
  label: string
  /** Badge variant matching the phase colour */
  badgeVariant?: string
}

export interface ProjectsListPageProps {
  projects?: PipelineProject[]
  loading?: boolean
  error?: string | null
  onNewProject?: () => void
  onExport?: () => void
  onRowClick?: (project: PipelineProject) => void
  initialPhase?: PhaseFilter
}

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

const PHASE_TABS: PhaseTab[] = [
  { key: 'all',          label: 'All' },
  { key: 'g0',           label: 'Intake',         badgeVariant: 'intake' },
  { key: 'g1',           label: 'Commercial',     badgeVariant: 'commercial' },
  { key: 'g2',           label: 'Engineering',    badgeVariant: 'engineering' },
  { key: 'g3',           label: 'Procurement',    badgeVariant: 'procurement' },
  { key: 'g4',           label: 'Construction',   badgeVariant: 'construction' },
  { key: 'g5',           label: 'Commissioning',  badgeVariant: 'commissioning' },
  { key: 'g6',           label: 'O&M',            badgeVariant: 'om' },
  { key: 'g7',           label: 'Finance',        badgeVariant: 'finance' },
]

const PHASE_LABEL: Record<PhaseKey, string> = {
  g0: 'Intake',
  g1: 'Commercial',
  g2: 'Engineering',
  g3: 'Procurement',
  g4: 'Construction',
  g5: 'Commissioning',
  g6: 'O&M',
  g7: 'Finance',
  g8: 'O&M',
  g9: 'AI & Analytics',
}

const PHASE_BADGE_VARIANT: Record<PhaseKey, string> = {
  g0: 'intake',
  g1: 'commercial',
  g2: 'engineering',
  g3: 'procurement',
  g4: 'construction',
  g5: 'commissioning',
  g6: 'om',
  g7: 'finance',
  g8: 'om',
  g9: 'ai-analytics',
}

const GATE_SHORT: Record<number, string> = {
  0: 'Opportunity',
  1: 'Baseline',
  2: 'IFC Release',
  3: 'Procurement',
  4: 'Mobilization',
  5: 'Mech Complete',
  6: 'Commissioning',
  7: 'Handover',
  8: 'Ops Review',
  9: 'AI Optimise',
}

const STATUS_VARIANT: Record<ProjectStatus, string> = {
  active:    'approved',
  planning:  'draft',
  'at-risk': 'critical',
  completed: 'info',
  'on-hold': 'submitted',
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active:    'Active',
  planning:  'Planning',
  'at-risk': 'At Risk',
  completed: 'Completed',
  'on-hold': 'On Hold',
}

/* ─────────────────────────────────────────────────────────────
   COLUMN DEFINITIONS
───────────────────────────────────────────── */

function buildColumns(
  onRowClick?: (p: PipelineProject) => void,
): ColumnDef<PipelineProject>[] {
  return [
    {
      key: 'code',
      header: 'Code',
      width: '110px',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-[13px] font-medium text-[#64ffda] tracking-wide">
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Project Name',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-foreground leading-snug">{row.name}</span>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      render: (row) => (
        <span className="text-muted-foreground text-[13px]">{row.client}</span>
      ),
    },
    {
      key: 'phase',
      header: 'Phase',
      width: '140px',
      render: (row) => (
        <PhaseBadge
          phase={PHASE_BADGE_VARIANT[row.phase] as any}
          aria-label={`Phase: ${PHASE_LABEL[row.phase]}`}
        />
      ),
    },
    {
      key: 'gate',
      header: 'Gate',
      width: '130px',
      sortable: true,
      render: (row) => (
        <Badge
          variant="gate"
          className="whitespace-normal leading-snug"
          aria-label={`Gate G${row.gate}: ${GATE_SHORT[row.gate]}`}
        >
          G{row.gate} · {GATE_SHORT[row.gate]}
        </Badge>
      ),
    },
    {
      key: 'budgetM',
      header: 'Budget',
      width: '100px',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-mono text-[13px] tabular-nums text-foreground">
          {row.budgetM >= 1000
            ? `$${(row.budgetM / 1000).toFixed(2)}B`
            : `$${row.budgetM}M`}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row) => {
        const s = row.status as ProjectStatus
        return (
          <Badge variant={STATUS_VARIANT[s] as any} dot>
            {STATUS_LABEL[s]}
          </Badge>
        )
      },
    },
    {
      key: 'targetCod',
      header: 'Target COD',
      width: '110px',
      sortable: true,
      render: (row) => (
        <span className="text-muted-foreground text-[13px] tabular-nums">
          {row.targetCod}
        </span>
      ),
    },
    {
      key: '_actions',
      header: '',
      width: '44px',
      align: 'center',
      render: (_row) => (
        <span
          className={cn(
            'inline-flex items-center justify-center size-7 rounded-md',
            'text-muted-foreground transition-colors duration-150',
            onRowClick && 'group-hover/row:text-[#64ffda] group-hover/row:bg-[#64ffda]/10',
          )}
          aria-hidden="true"
        >
          <ArrowRight className="size-3.5" />
        </span>
      ),
    },
  ]
}

/* ─────────────────────────────────────────────────────────────
   PHASE TABS
───────────────────────────────────────────── */

interface PhaseTabsProps {
  active: PhaseFilter
  counts: Record<PhaseFilter, number>
  onChange: (tab: PhaseFilter) => void
}

function PhaseTabs({ active, counts, onChange }: PhaseTabsProps) {
  const tabsRef = React.useRef<HTMLDivElement>(null)

  // Arrow-key navigation for accessibility
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, idx: number) {
    const tabs = PHASE_TABS
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    else return
    e.preventDefault()
    onChange(tabs[next].key)
    const el = tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]
    el?.focus()
  }

  return (
    <div
      ref={tabsRef}
      role="tablist"
      aria-label="Filter by phase"
      className="flex items-center gap-0.5 overflow-x-auto scrollbar-none pb-1 -mb-px"
    >
      {PHASE_TABS.map((tab, idx) => {
        const isActive = active === tab.key
        const count = counts[tab.key] ?? 0

        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-controls="projects-table"
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap',
              'rounded-t-md border-b-2 transition-all duration-150 font-sans',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              isActive
                ? 'border-[#64ffda] text-foreground font-medium bg-[#64ffda]/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            {tab.label}
            {count > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full text-[10px] font-medium leading-none',
                  'min-w-[18px] h-[18px] px-1 tabular-nums',
                  isActive
                    ? 'bg-[#64ffda]/20 text-[#64ffda]'
                    : 'bg-muted text-muted-foreground',
                )}
                aria-label={`${count} projects`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────── */

function EmptyState({
  filtered,
  onNewProject,
  onClearFilter,
}: {
  filtered: boolean
  onNewProject?: () => void
  onClearFilter?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex items-center justify-center size-16 rounded-full bg-muted/40 text-muted-foreground">
        <FolderKanban className="size-8" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          {filtered ? 'No projects found' : 'No projects yet'}
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          {filtered
            ? 'Try adjusting your search or phase filter to find what you\'re looking for.'
            : 'Get started by creating your first renewable energy project.'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {filtered && onClearFilter && (
          <Button variant="outline" size="sm" onClick={onClearFilter}>
            Clear filters
          </Button>
        )}
        {onNewProject && (
          <Button variant="gate" size="sm" onClick={onNewProject}>
            <Plus className="size-3.5" aria-hidden="true" />
            {filtered ? 'New Project' : 'Create your first project'}
          </Button>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */

export function ProjectsListPage({
  projects = MOCK_PROJECTS,
  loading = false,
  error = null,
  onNewProject,
  onExport,
  onRowClick,
  initialPhase = 'all',
}: ProjectsListPageProps) {
  const [activePhase, setActivePhase] = React.useState<PhaseFilter>(initialPhase)
  const [notifiedRow, setNotifiedRow] = React.useState<string | null>(null)

  // Map PhaseKey filter → gate numbers
  const PHASE_GATE_MAP: Record<PhaseKey, number[]> = {
    g0: [0], g1: [1], g2: [2], g3: [3], g4: [4],
    g5: [5], g6: [6], g7: [7], g8: [8], g9: [9],
  }

  const filteredProjects = React.useMemo(() => {
    if (activePhase === 'all') return projects
    const gates = PHASE_GATE_MAP[activePhase as PhaseKey]
    return projects.filter((p) => gates.includes(p.gate))
  }, [projects, activePhase])

  // Count per tab
  const counts = React.useMemo<Record<PhaseFilter, number>>(() => {
    const result = { all: projects.length } as Record<PhaseFilter, number>
    PHASE_TABS.forEach((tab) => {
      if (tab.key === 'all') return
      const gates = PHASE_GATE_MAP[tab.key as PhaseKey]
      result[tab.key] = projects.filter((p) => gates.includes(p.gate)).length
    })
    return result
  }, [projects])

  function handleRowClick(project: PipelineProject) {
    setNotifiedRow(project.code)
    onRowClick?.(project)
    setTimeout(() => setNotifiedRow(null), 2000)
  }

  const columns = React.useMemo(
    () => buildColumns(onRowClick ?? handleRowClick),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onRowClick],
  )

  const hasFilters = activePhase !== 'all'

  return (
    <div className="space-y-5">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-sans tracking-tight">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            Manage and track all renewable energy EPC projects across the portfolio.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="size-3.5" aria-hidden="true" />
              Export
            </Button>
          )}
          <Button
            variant="gate"
            size="sm"
            onClick={onNewProject}
            aria-label="Create new project"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New Project
          </Button>
        </div>
      </div>

      {/* ── Row-click notification ───────────── */}
      {notifiedRow && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-[#64ffda]/30 bg-[#64ffda]/5 px-4 py-2 text-sm text-[#64ffda]"
        >
          Opened project <span className="font-mono font-semibold">{notifiedRow}</span>
        </div>
      )}

      {/* ── Phase Tabs ──────────────────────── */}
      <div className="border-b border-border">
        <PhaseTabs
          active={activePhase}
          counts={counts}
          onChange={(tab) => {
            setActivePhase(tab)
          }}
        />
      </div>

      {/* ── DataRegister Table ──────────────── */}
      <div id="projects-table" role="tabpanel" aria-label={`${activePhase === 'all' ? 'All' : PHASE_LABEL[activePhase as PhaseKey]} projects`}>
        <DataRegister<PipelineProject>
          title={activePhase === 'all' ? 'All Projects' : `${PHASE_LABEL[activePhase as PhaseKey]} Projects`}
          data={filteredProjects}
          columns={columns}
          searchFields={['code', 'name', 'client']}
          searchPlaceholder="Search by code, name or client…"
          rowKey="id"
          onRowClick={handleRowClick}
          pageSize={10}
          loading={loading}
          error={error}
          emptyMessage="No projects match your search."
          actions={(
            <>
              {onExport && (
                <Button variant="outline" size="sm" onClick={onExport} aria-label="Export">
                  <Download className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline ml-1">Export</span>
                </Button>
              )}
              <Button size="sm" variant="gate" onClick={onNewProject ?? (() => {})} aria-label="New Project">
                <Plus className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline ml-1">New Project</span>
              </Button>
            </>
          )}
        />

        {/* Custom empty state override when table is empty */}
        {!loading && !error && filteredProjects.length === 0 && (
          <EmptyState
            filtered={hasFilters}
            onNewProject={onNewProject}
            onClearFilter={() => setActivePhase('all')}
          />
        )}
      </div>

      {/* ── Stats footer ────────────────────── */}
      {!loading && !error && projects.length > 0 && (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-2"
          aria-label="Portfolio summary"
        >
          {[
            { label: 'Total Projects',    value: projects.length },
            { label: 'Active',            value: projects.filter((p) => p.status === 'active').length },
            { label: 'At Risk',           value: projects.filter((p) => p.status === 'at-risk').length,  alert: true },
            { label: 'Completed',         value: projects.filter((p) => p.status === 'completed').length },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn(
                'rounded-lg border border-border bg-card px-4 py-3 flex items-center justify-between',
                stat.alert && stat.value > 0 && 'border-[#ef4444]/30 bg-[#ef4444]/5',
              )}
            >
              <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              <span
                className={cn(
                  'text-lg font-bold tabular-nums font-sans',
                  stat.alert && stat.value > 0 ? 'text-[#ef4444]' : 'text-foreground',
                )}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
