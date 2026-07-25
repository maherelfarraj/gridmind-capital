'use client'

import * as React from 'react'
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Target,
  Layers,
  GitBranch,
  MapPin,
  MessageSquare,
  FileText,
  Pencil,
  MoreVertical,
  Landmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { PHASE_META, type PhaseKey } from '@/components/app-shell/nav-config'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'active'
  | 'on-hold'
  | 'at-risk'
  | 'completed'
  | 'cancelled'
  | 'planning'
  | 'draft'

export interface ProjectData {
  id: string
  /** Full project name, e.g. "Sirius 400 MW Solar Farm" */
  name: string
  /** Short code, e.g. "SRS-400" */
  code: string
  /** Client / off-taker name */
  client: string
  status: ProjectStatus
  /** Current lifecycle phase */
  phase: PhaseKey
  /** Active gate number 0–9 */
  gate: number
  /** Descriptive gate name, e.g. "Procurement Ready" */
  gateName: string
  /** Total approved budget in USD */
  budgetUsd: number
  /** Start date (ISO string or Date) */
  startDate: string | Date
  /** Target Commercial Operation Date */
  targetCod: string | Date
  /** Location string, e.g. "Atacama Desert, Chile" */
  location: string
  /** Unread comment count (shown on Comments button) */
  commentCount?: number
  /** Document count (shown on Documents button) */
  documentCount?: number
  /** ISO 4217 currency code, e.g. "USD" */
  currency?: string
}

/**
 * Raw DB-row shape from the spec / API response.
 * Use `adaptProjectRaw` to convert to `ProjectData` for this component.
 */
export interface ProjectRaw {
  id: string
  code: string
  name: string
  description: string | null
  client_name: string | null
  phase: string
  gate: string
  status: string
  budget_amount: number | null
  currency: string
  start_date: string | null
  target_cod: string | null
  actual_cod: string | null
  location: string | null
  capacity_mw: number | null
  technology_type: string | null
  epc_contractor: string | null
  owner_engineer: string | null
}

/** Convert a raw API/DB row to the internal ProjectData shape. */
export function adaptProjectRaw(raw: ProjectRaw): ProjectData {
  // Gate string "G2" → number 2; fallback to 0
  const gateNum = parseInt(raw.gate.replace(/\D/g, ''), 10) || 0
  // Phase string "engineering" → PhaseKey "g3" via reverse lookup; fallback to "g0"
  const PHASE_STRING_TO_KEY: Record<string, string> = {
    intake: 'g0', development: 'g1', commercial: 'g2',
    engineering: 'g3', procurement: 'g4', construction: 'g5',
    commissioning: 'g6', om: 'g6', finance: 'g6', 'ai-analytics': 'g6',
  }
  const phaseKey = (PHASE_STRING_TO_KEY[raw.phase.toLowerCase()] ?? 'g0') as PhaseKey

  const GATE_NAMES: Record<number, string> = {
    0: 'Investment Intake', 1: 'Development Approval', 2: 'Engineering IFC',
    3: 'Procurement Ready', 4: 'Construction Mobilization', 5: 'Mechanical Completion',
    6: 'Handover, Operations & Closeout',
  }

  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    client: raw.client_name ?? 'Unknown Client',
    status: (raw.status as ProjectStatus) ?? 'active',
    phase: phaseKey,
    gate: gateNum,
    gateName: GATE_NAMES[gateNum] ?? `Gate ${gateNum}`,
    budgetUsd: raw.budget_amount ?? 0,
    startDate: raw.start_date ?? new Date().toISOString(),
    targetCod: raw.target_cod ?? new Date().toISOString(),
    location: raw.location ?? 'Location TBD',
  }
}

export interface ProjectCommandCenterProps {
  project?: ProjectData | null
  /** Show loading skeleton instead of content */
  loading?: boolean
  /** Called when back arrow is clicked */
  onBack?: () => void
  /** Called when Comments button is clicked */
  onComments?: () => void
  /** Called when Documents button is clicked */
  onDocuments?: () => void
  /** Called when Edit button is clicked */
  onEdit?: () => void
  /** Called when Actions (⋯) dropdown is clicked */
  onActions?: () => void
  /** When provided, renders a "Lender Report" header button (role-gated by the caller) */
  onLenderReport?: () => void
  className?: string
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const STATUS_META: Record<
  ProjectStatus,
  { label: string; variant: BadgeProps['variant']; dot: boolean }
> = {
  active:    { label: 'Active',     variant: 'approved',      dot: true  },
  'on-hold': { label: 'On Hold',    variant: 'submitted',     dot: true  },
  'at-risk': { label: 'At Risk',    variant: 'escalated',     dot: true  },
  completed: { label: 'Completed',  variant: 'approved',      dot: false },
  cancelled: { label: 'Cancelled',  variant: 'rejected',      dot: false },
  planning:  { label: 'Planning',   variant: 'under-review',  dot: true  },
  draft:     { label: 'Draft',      variant: 'under-review',  dot: true  },
}

const STATUS_META_FALLBACK: { label: string; variant: BadgeProps['variant']; dot: boolean } = {
  label: '', variant: 'under-review', dot: true,
}

const PHASE_BADGE_VARIANT: Record<PhaseKey, BadgeProps['variant']> = {
  g0: 'intake',
  g1: 'commercial',
  g2: 'commercial',
  g3: 'engineering',
  g4: 'procurement',
  g5: 'construction',
  g6: 'commissioning',
}

const PHASE_LABEL: Record<PhaseKey, string> = {
  g0: 'G0 · Intake',
  g1: 'G1 · Development',
  g2: 'G2 · Commercial',
  g3: 'G3 · Engineering',
  g4: 'G4 · Procurement',
  g5: 'G5 · Construction',
  g6: 'G6 · Handover & O&M',
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  // Guard against non-ISO strings like "Q4 2025" or "Dec 2024"
  if (isNaN(d.getTime())) return typeof value === 'string' ? value : '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

// ─────────────────────────────────────────────────────────────
// Skeleton atoms
// ─────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block animate-pulse rounded-md bg-muted',
        className,
      )}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// Stat tile
// ─────────────────────────────────────────────────────────────

interface StatTileProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  /** Optional inline colour for the icon wrapper */
  iconColor?: string
  loading?: boolean
}

function StatTile({ icon, label, value, iconColor, loading }: StatTileProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5',
        'transition-colors duration-150 hover:border-[#64ffda]/30 hover:bg-card/80',
      )}
    >
      {/* Icon */}
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
          'bg-muted text-muted-foreground',
        )}
        style={iconColor ? { color: iconColor, backgroundColor: `${iconColor}18` } : undefined}
      >
        {icon}
      </span>

      {/* Text */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </p>
        {loading ? (
          <Skeleton className="h-5 w-24" />
        ) : (
          <div className="text-sm font-semibold text-foreground leading-tight break-words">
            {value}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Header skeleton
// ─────────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading project details"
      className="border-b border-border bg-card px-4 py-4 sm:px-6"
    >
      {/* Back + actions row */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>
      {/* Title row */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-6 w-20" />
      </div>
      {/* Subtitle row */}
      <Skeleton className="mt-2 h-4 w-48" />
      {/* Stats grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-4 py-3.5">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-0.5 size-8 shrink-0 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="mb-2 h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ProjectCommandCenter
// ─────────────────────────────────────────────────────────────

export const ProjectCommandCenter = React.memo(function ProjectCommandCenter({
  project,
  loading = false,
  onBack,
  onComments,
  onDocuments,
  onEdit,
  onActions,
  onLenderReport,
  className,
}: ProjectCommandCenterProps) {
  // ── Loading state ──
  if (loading || !project) {
    return <HeaderSkeleton />
  }

  // Defensive lookups: unknown status/phase values must never throw during render.
  const rawStatus = project.status as string
  const statusMeta: typeof STATUS_META_FALLBACK =
    STATUS_META[rawStatus as ProjectStatus] ??
    { label: rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1) : 'Unknown', variant: 'under-review', dot: true }
  const phaseMeta   = PHASE_META[project.phase]   ?? PHASE_META['g0']
  const phaseBadgeVariant = PHASE_BADGE_VARIANT[project.phase] ?? PHASE_BADGE_VARIANT['g0']
  const phaseLabel  = PHASE_LABEL[project.phase]   ?? project.phase ?? 'Unknown Phase'
  const gateColor   = phaseMeta.color

  return (
    <header
      aria-label={`Project: ${project.name}`}
      className={cn(
        'border-b border-border bg-card',
        className,
      )}
    >
      {/* ── Inner padding container ── */}
      <div className="px-4 py-4 sm:px-6">

        {/* ── Row 1: Back + Action Buttons ── */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">

          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            aria-label="Back to projects list"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>Projects</span>
          </Button>

          {/* Action buttons */}
          <div className="flex items-center gap-2" role="group" aria-label="Project actions">
            {/* Comments */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onComments}
              aria-label={project.commentCount ? `Comments — ${project.commentCount} unread` : 'Comments'}
              className="gap-1.5"
            >
              <MessageSquare className="size-3.5" aria-hidden="true" />
              <span>Comments</span>
              {!!project.commentCount && (
                <span
                  className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#64ffda] px-1 text-[9px] font-bold text-[#0a192f]"
                  aria-hidden="true"
                >
                  {project.commentCount > 99 ? '99+' : project.commentCount}
                </span>
              )}
            </Button>

            {/* Documents */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDocuments}
              aria-label={project.documentCount ? `Documents — ${project.documentCount} files` : 'Documents'}
              className="gap-1.5"
            >
              <FileText className="size-3.5" aria-hidden="true" />
              <span>Documents</span>
              {!!project.documentCount && (
                <span
                  className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-bold text-muted-foreground"
                  aria-hidden="true"
                >
                  {project.documentCount > 99 ? '99+' : project.documentCount}
                </span>
              )}
            </Button>

            {/* Lender Report — only rendered when the caller passes a handler (role-gated) */}
            {onLenderReport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLenderReport}
                aria-label="Open lender progress report"
                className="gap-1.5"
              >
                <Landmark className="size-3.5" aria-hidden="true" />
                <span>Lender Report</span>
              </Button>
            )}

            {/* Edit */}
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              aria-label="Edit project"
              className="gap-1.5"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              <span>Edit</span>
            </Button>

            {/* Actions ⋯ */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onActions}
              aria-label="More actions"
              aria-haspopup="menu"
              className="px-2"
            >
              <MoreVertical className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* ── Row 2: Title + Status badge ── */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <h1 className="font-sans text-xl font-bold tracking-tight text-foreground sm:text-2xl text-balance">
            {project.name}
          </h1>
          <Badge
            variant={statusMeta.variant}
            dot={statusMeta.dot}
            aria-label={`Status: ${statusMeta.label}`}
          >
            {statusMeta.label}
          </Badge>
        </div>

        {/* ── Row 3: Subtitle (code + client) ── */}
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono text-xs font-semibold tracking-widest text-muted-foreground/80">
            {project.code}
          </span>
          <span className="mx-2 select-none text-border" aria-hidden="true">·</span>
          <span>{project.client}</span>
        </p>

        {/* ── Row 4: Stats bar ─��� */}
        <div
          role="list"
          aria-label="Project statistics"
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >

          {/* 1. Budget — emerald per spec */}
          <div role="listitem">
            <StatTile
              icon={<TrendingUp className="size-4" aria-hidden="true" />}
              label="Budget"
              iconColor="#10b981"
              value={
                <span className="inline-flex items-baseline gap-1.5">
                  <span
                    className="font-mono text-sm font-bold tracking-tight"
                    aria-label={`Budget: ${formatCurrency(project.budgetUsd)} ${project.currency ?? 'USD'}`}
                  >
                    {formatCurrency(project.budgetUsd)}
                  </span>
                  <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {project.currency ?? 'USD'}
                  </span>
                </span>
              }
            />
          </div>

          {/* 2. Start Date — blue per spec */}
          <div role="listitem">
            <StatTile
              icon={<Calendar className="size-4" aria-hidden="true" />}
              label="Start Date"
              iconColor="#3b82f6"
              value={formatDate(project.startDate)}
            />
          </div>

          {/* 3. Target COD — purple per spec */}
          <div role="listitem">
            <StatTile
              icon={<Target className="size-4" aria-hidden="true" />}
              label="Target COD"
              iconColor="#8b5cf6"
              value={formatDate(project.targetCod)}
            />
          </div>

          {/* 4. Phase */}
          <div role="listitem">
            <StatTile
              icon={<Layers className="size-4" aria-hidden="true" />}
              label="Phase"
              iconColor={phaseMeta.color}
              value={
                <Badge
                  variant={phaseBadgeVariant}
                  className="mt-0.5 whitespace-normal leading-snug"
                  aria-label={`Phase: ${phaseLabel}`}
                >
                  {phaseLabel}
                </Badge>
              }
            />
          </div>

          {/* 5. Current Gate */}
          <div role="listitem">
            <StatTile
              icon={<GitBranch className="size-4" aria-hidden="true" />}
              label="Current Gate"
              iconColor={gateColor}
              value={
                <Badge
                  variant="gate"
                  className="mt-0.5 whitespace-normal leading-snug"
                  aria-label={`Gate: G${project.gate} — ${project.gateName}`}
                >
                  G{project.gate} · {project.gateName}
                </Badge>
              }
            />
          </div>

          {/* 6. Location — red per spec */}
          <div role="listitem">
            <StatTile
              icon={<MapPin className="size-4" aria-hidden="true" />}
              label="Location"
              iconColor="#ef4444"
              value={
                <span className="block truncate leading-snug" title={project.location}>
                  {project.location}
                </span>
              }
            />
          </div>
        </div>
      </div>
    </header>
  )
})
