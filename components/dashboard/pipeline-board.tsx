'use client'

import * as React from 'react'
import { MapPin, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { GateLane, PipelineProject } from './dashboard-data'
import { NOT_SET_LABEL } from '@/lib/format-nullable'

// ─────────────────────────────────────────────────────────────
// RAG helpers
// ─────────────────────────────────────────────────────────────

const RAG_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  green: { label: 'On Track',  color: '#22c55e', Icon: CheckCircle2 },
  amber: { label: 'At Risk',   color: '#f59e0b', Icon: AlertTriangle },
  red:   { label: 'Off Track', color: '#ef4444', Icon: AlertTriangle },
}
const RAG_FALLBACK = { label: 'Unknown', color: '#94a3b8', Icon: AlertTriangle }

// ─────────────────────────────────────────────────────────────
// Project mini-card
// ─────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: PipelineProject
  laneColor: string
  onSelect: (p: PipelineProject) => void
}

function ProjectCard({ project, laneColor, onSelect }: ProjectCardProps) {
  const rag = RAG_META[project.healthRag] ?? RAG_FALLBACK

  return (
    <button
      type="button"
      onClick={() => onSelect(project)}
      className={cn(
        'w-full text-left group rounded-lg border border-border bg-background',
        'px-3 py-2.5 transition-all duration-150',
        'hover:border-[var(--lane-color)] hover:shadow-sm focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring',
        'dark:bg-card/60 dark:hover:bg-card',
      )}
      style={{ '--lane-color': laneColor } as React.CSSProperties}
      aria-label={`${project.name} — ${rag.label}`}
    >
      {/* Top row: code + RAG */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
          {project.code}
        </span>
        <span
          className="flex items-center gap-0.5 text-[10px] font-medium"
          style={{ color: rag.color }}
          aria-label={rag.label}
        >
          <rag.Icon className="size-3" aria-hidden="true" />
        </span>
      </div>

      {/* Project name */}
      <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2 mb-2">
        {project.name}
      </p>

      {/* MW + budget */}
      <div className="flex items-center gap-2 mb-2">
        {project.mw > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Zap className="size-3 shrink-0" aria-hidden="true" />
            {project.mw} MW
          </span>
        )}
        {/* Unguarded interpolation would render a literal "$nullM". */}
        <span className={cn('text-[10px] text-muted-foreground', project.budgetM == null && 'italic')}>
          {project.budgetM != null ? `$${project.budgetM}M` : NOT_SET_LABEL}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-border overflow-hidden" role="progressbar" aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${project.progress}%`, backgroundColor: laneColor }}
        />
      </div>
      <p className="mt-0.5 text-[9px] text-muted-foreground tabular-nums">{project.progress}% complete</p>

      {/* Location */}
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground truncate">
        <MapPin className="size-2.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{project.location}</span>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Gate lane column
// ─────────────────────────────────────────────────────────────

interface LaneColumnProps {
  lane: GateLane
  onSelect: (p: PipelineProject) => void
}

function LaneColumn({ lane, onSelect }: LaneColumnProps) {
  const isEmpty = lane.projects.length === 0
  return (
    <div className="flex flex-col min-w-[160px] w-[160px] shrink-0">
      {/* Lane header */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block size-2 rounded-full shrink-0"
            style={{ backgroundColor: lane.color }}
            aria-hidden="true"
          />
          <span className="text-[11px] font-semibold text-foreground tracking-wide whitespace-nowrap">
            G{lane.gate}
          </span>
          <span className="text-[10px] text-muted-foreground truncate">
            {lane.shortName}
          </span>
        </div>
        {lane.projects.length > 0 && (
          <span
            className="ms-1 inline-flex items-center justify-center size-4 rounded-full text-[9px] font-bold"
            style={{ backgroundColor: `${lane.color}20`, color: lane.color }}
          >
            {lane.projects.length}
          </span>
        )}
      </div>

      {/* Divider line styled with lane colour */}
      <div
        className="h-px w-full mb-2 rounded-full"
        style={{ backgroundColor: `${lane.color}40` }}
        aria-hidden="true"
      />

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {isEmpty ? (
          <div className="flex items-center justify-center h-16 rounded-lg border border-dashed border-border">
            <span className="text-[10px] text-muted-foreground/50">No projects</span>
          </div>
        ) : (
          lane.projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              laneColor={lane.color}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Selected project detail flyout
// ─────────────────────────────────────────────────────────────

interface ProjectFlyoutProps {
  project: PipelineProject | null
  lanes: GateLane[]
  onClose: () => void
}

function ProjectFlyout({ project, lanes, onClose }: ProjectFlyoutProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!project) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project, onClose])

  if (!project) return null

  const lane = lanes.find((l) => l.gate === project.gate)
  const rag = RAG_META[project.healthRag] ?? RAG_FALLBACK

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name} detail`}
        className={cn(
          'fixed end-0 top-0 bottom-0 z-40 w-full max-w-sm bg-card border-s border-border shadow-2xl',
          'flex flex-col overflow-y-auto',
          'animate-[slide-in-right_0.22s_cubic-bezier(0.16,1,0.3,1)]',
        )}
        style={
          {
            '--tw-translate-x': '0',
          } as React.CSSProperties
        }
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card/95 backdrop-blur-sm px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-muted-foreground tracking-wider mb-0.5">{project.code}</p>
            <h2 className="text-base font-bold text-foreground leading-snug">{project.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 mt-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close project detail"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-5">
          {/* Status row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={project.status === 'at-risk' ? 'high' : project.status === 'completed' ? 'approved' : project.status === 'on-hold' ? 'draft' : 'under-review'}
              dot
            >
              {project.status.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </Badge>
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: rag.color }}>
              <rag.Icon className="size-3" aria-hidden="true" />
              {rag.label}
            </span>
          </div>

          {/* Gate + phase */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Current Gate', value: `G${project.gate} — ${lane?.shortName ?? ''}` },
              { label: 'Client',       value: project.client },
              { label: 'Budget',       value: project.budgetM != null ? `$${project.budgetM}M` : NOT_SET_LABEL },
              { label: 'Capacity',     value: project.mw > 0 ? `${project.mw} MW` : 'N/A' },
              { label: 'Target COD',   value: project.targetCod },
              { label: 'Location',     value: project.location },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/50 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
                <p className="text-xs font-semibold text-foreground leading-snug">{value}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-foreground">Overall Progress</p>
              <span className="text-xs font-bold tabular-nums" style={{ color: lane?.color }}>
                {project.progress}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-border overflow-hidden" role="progressbar" aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${project.progress}%`, backgroundColor: lane?.color }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Pipeline Board
// ─────────────────────────────────────────────────────────────

interface PipelineBoardProps {
  lanes: GateLane[]
  loading?: boolean
}

export function PipelineBoard({ lanes, loading = false }: PipelineBoardProps) {
  const [selected, setSelected] = React.useState<PipelineProject | null>(null)
  const totalProjects = lanes.reduce((sum, l) => sum + l.projects.length, 0)

  return (
    <section aria-label="Project Pipeline by Gate">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Project Pipeline</h2>
          <p className="text-xs text-muted-foreground">{totalProjects} projects across G1–G8</p>
        </div>
        <Badge variant="gate" className="font-mono">
          G1 → G8
        </Badge>
      </div>

      {/* Horizontal scroll container */}
      <div
        className={cn(
          'overflow-x-auto pb-3',
          'scrollbar-thin',
          // Snap scrolling on mobile
          '[scroll-snap-type:x_mandatory]',
          '[&>*]:snap-start',
        )}
        role="list"
        aria-label="Gate swimlanes"
      >
        <div className="flex gap-3 w-max">
          {loading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col min-w-[160px] w-[160px] shrink-0 gap-2 animate-pulse"
                >
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-px w-full bg-border" />
                  <div className="h-20 rounded-lg bg-muted" />
                </div>
              ))
            : lanes.map((lane) => (
                <LaneColumn key={lane.gate} lane={lane} onSelect={setSelected} />
              ))}
        </div>
      </div>

      {/* Selected project flyout */}
      <ProjectFlyout
        project={selected}
        lanes={lanes}
        onClose={() => setSelected(null)}
      />
    </section>
  )
}
