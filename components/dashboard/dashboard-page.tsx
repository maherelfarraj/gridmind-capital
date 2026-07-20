'use client'

import * as React from 'react'
import {
  FolderKanban,
  Activity,
  Clock,
  AlertTriangle,
  Plus,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ApprovalInbox, type ApprovalRecord } from '@/components/approvals/approval-inbox'
import type { PhaseKey } from '@/components/app-shell/nav-config'
import type { ApprovalItem } from '@/components/dashboard/dashboard-data'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ProjectRowStatus = 'active' | 'at-risk' | 'planning' | 'completed' | 'on-hold'

export interface DashboardProject {
  id: string
  code: string
  name: string
  phase: PhaseKey
  gate: number
  gateName: string
  budgetM: number
  status: ProjectRowStatus
  client: string
}

export interface DashboardStats {
  totalProjects: number
  activeProjects: number
  pendingApprovals: number
  overdueApprovals: number
}

export interface DashboardPageProps {
  userName?: string
  stats?: DashboardStats
  projects?: DashboardProject[]
  approvals?: ApprovalItem[]
  loading?: boolean
  onNewProject?: () => void
  onProjectClick?: (project: DashboardProject) => void
  onApprovalClick?: (id: string) => void
}

// ─────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────

const MOCK_STATS: DashboardStats = {
  totalProjects: 18,
  activeProjects: 14,
  pendingApprovals: 7,
  overdueApprovals: 2,
}

const MOCK_PROJECTS: DashboardProject[] = [
  { id: 'p-sirius',  code: 'SRS-400', name: 'Sirius 400MW Solar Farm',  phase: 'g4', gate: 4, gateName: 'Construction Mob.', budgetM: 480,  status: 'active',    client: 'TotalEnergies'      },
  { id: 'p-nova',    code: 'NOV-600', name: 'Nova Offshore Wind 600MW', phase: 'g4', gate: 4, gateName: 'Construction Mob.', budgetM: 1200, status: 'at-risk',   client: 'Vattenfall'         },
  { id: 'p-atlas',   code: 'ATL-300', name: 'Atlas Solar PV 300MW',     phase: 'g5', gate: 5, gateName: 'Mech. Completion',  budgetM: 360,  status: 'active',    client: 'Masdar'             },
  { id: 'p-ceres',   code: 'CRS-150', name: 'Ceres Wind Repowering',    phase: 'g6', gate: 6, gateName: 'Commissioning',     budgetM: 195,  status: 'active',    client: 'RWE Renewables'     },
  { id: 'p-sol',     code: 'SOL-500', name: 'Sol Atacama 500MW',        phase: 'g3', gate: 3, gateName: 'Procurement Award', budgetM: 680,  status: 'active',    client: 'Enel Chile'         },
  { id: 'p-orion',   code: 'ORN-180', name: 'Orion Wind Farm',          phase: 'g1', gate: 1, gateName: 'Baseline Approved', budgetM: 290,  status: 'planning',  client: 'Clean Energy Corp'  },
  { id: 'p-vega',    code: 'VEG-400', name: 'Vega BESS Storage',        phase: 'g1', gate: 1, gateName: 'Baseline Approved', budgetM: 520,  status: 'active',    client: 'National Grid UK'   },
  { id: 'p-ares',    code: 'ARS-250', name: 'Ares Solar + Storage',     phase: 'g7', gate: 7, gateName: 'Handover & Warranty', budgetM: 415, status: 'active',   client: 'AGL Energy'         },
]

const MOCK_APPROVALS: ApprovalItem[] = [
  { id: 'a1', type: 'gate-review',     title: 'G5 Gate Review Convene',        projectCode: 'SRS-400', projectName: 'Sirius 400MW',   requestedBy: 'J. Rivera',   daysOpen: 8, isOverdue: true,  priority: 'critical' },
  { id: 'a2', type: 'budget-variance', title: '+$12.4M Cost Variance Request', projectCode: 'NOV-600', projectName: 'Nova Offshore',  requestedBy: 'T. Müller',   daysOpen: 5, isOverdue: true,  priority: 'high'     },
  { id: 'a3', type: 'change-order',    title: 'CO-041 Inverter Substitution',  projectCode: 'ATL-300', projectName: 'Atlas Solar',    requestedBy: 'M. Al-Farsi', daysOpen: 3, isOverdue: false, priority: 'high'     },
  { id: 'a4', type: 'contract',        title: 'EPC Sub-contract Award',        projectCode: 'SOL-500', projectName: 'Sol Atacama',    requestedBy: 'R. Chen',     daysOpen: 2, isOverdue: false, priority: 'medium'   },
  { id: 'a5', type: 'hse-incident',    title: 'Near-Miss Report #NM-22',       projectCode: 'CRS-150', projectName: 'Ceres Wind',     requestedBy: 'L. Schmidt',  daysOpen: 1, isOverdue: false, priority: 'medium'   },
]

// ─────────────────────────────────────────────────────────────
// Phase badge map — maps PhaseKey to Badge variant
// ─────────────────────────────────────────────────────────────

const PHASE_VARIANT: Record<PhaseKey, string> = {
  g0: 'intake',
  g1: 'intake',
  g2: 'commercial',
  g3: 'engineering',
  g4: 'procurement',
  g5: 'construction',
  g6: 'commissioning',
  g7: 'om',
  g8: 'finance',
  g9: 'ai-analytics',
}

const PHASE_LABEL: Record<PhaseKey, string> = {
  g0: 'Intake',
  g1: 'Development',
  g2: 'Commercial',
  g3: 'Engineering',
  g4: 'Procurement',
  g5: 'Construction',
  g6: 'Commissioning',
  g7: 'O&M',
  g8: 'Finance',
  g9: 'AI & Analytics',
}

// ─────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────

const STATUS_META: Record<ProjectRowStatus, { label: string; variant: string; dot?: boolean }> = {
  active:    { label: 'Active',     variant: 'approved',    dot: true },
  'at-risk': { label: 'At Risk',    variant: 'critical',    dot: true },
  planning:  { label: 'Planning',   variant: 'submitted',   dot: true },
  completed: { label: 'Completed',  variant: 'approved',    dot: true },
  'on-hold': { label: 'On Hold',    variant: 'draft',       dot: true },
}

// ─────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  loading?: boolean
  alert?: boolean
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, loading = false, alert = false }: StatCardProps) {
  return (
    <article
      className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
      aria-label={`${label}: ${value}`}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
        aria-hidden="true"
      >
        <Icon className="size-5" style={{ color: iconColor }} />
      </span>
      <div className="min-w-0">
        {loading ? (
          <div className="space-y-1.5 animate-pulse">
            <div className="h-7 w-14 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        ) : (
          <>
            <p
              className={cn(
                'text-3xl font-bold leading-none tabular-nums',
                alert ? 'text-[#ef4444]' : 'text-foreground',
              )}
            >
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground truncate">{label}</p>
          </>
        )}
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────
// Recent projects table
// ─────────────────────────────────────────────────────────────

function formatBudget(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(2)}B`
  return `$${m}M`
}

interface RecentProjectsProps {
  projects: DashboardProject[]
  onRowClick?: (p: DashboardProject) => void
  loading?: boolean
}

function ProjectRowSkeleton() {
  return (
    <tr className="animate-pulse">
      {[40, 44, 32, 28, 24, 24].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-3 rounded bg-muted`} style={{ width: `${w * 2}px` }} />
        </td>
      ))}
    </tr>
  )
}

function RecentProjects({ projects, onRowClick, loading = false }: RecentProjectsProps) {
  return (
    <section
      className="flex flex-col rounded-xl border border-border bg-card overflow-hidden"
      aria-label="Recent Projects"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Recent Projects</h2>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          aria-label="View all projects"
        >
          View all
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm" role="table">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[90px]">Code</th>
              <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Project Name</th>
              <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[130px]">Phase</th>
              <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[160px]">Gate</th>
              <th scope="col" className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[90px]">Budget</th>
              <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[110px]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <ProjectRowSkeleton key={i} />)
              : projects.map((p, idx) => {
                  const statusMeta = STATUS_META[p.status]
                  const phaseVariant = PHASE_VARIANT[p.phase] as Parameters<typeof Badge>[0]['variant']
                  const isClickable = !!onRowClick

                  return (
                    <tr
                      key={p.id}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      onClick={() => onRowClick?.(p)}
                      onKeyDown={(e) => {
                        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          onRowClick?.(p)
                        }
                      }}
                      className={cn(
                        'transition-colors duration-100',
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/20',
                        isClickable && 'cursor-pointer hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      )}
                      aria-label={isClickable ? `Open project: ${p.name}` : undefined}
                    >
                      {/* Code */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs tracking-wider text-muted-foreground">
                          {p.code}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-sm leading-snug line-clamp-1">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 truncate">{p.client}</p>
                      </td>

                      {/* Phase */}
                      <td className="px-4 py-3">
                        <Badge variant={phaseVariant}>
                          {PHASE_LABEL[p.phase]}
                        </Badge>
                      </td>

                      {/* Gate */}
                      <td className="px-4 py-3">
                        <Badge variant="gate">
                          G{p.gate} · {p.gateName}
                        </Badge>
                      </td>

                      {/* Budget */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {formatBudget(p.budgetM)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge variant={statusMeta.variant as Parameters<typeof Badge>[0]['variant']} dot={statusMeta.dot}>
                          {statusMeta.label}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {!loading && (
        <div className="border-t border-border px-5 py-2.5">
          <p className="text-[11px] text-muted-foreground">
            Showing {projects.length} most recent projects
          </p>
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// Adapter: ApprovalItem (dashboard shape) → ApprovalRecord (inbox shape)
// ─────────────────────────────────────────────────────────────

function toApprovalRecord(item: ApprovalItem): ApprovalRecord {
  const PRIORITY_HOURS: Record<string, number> = {
    critical: 4,
    high: 24,
    medium: 72,
    low: 168,
  }
  const hoursUntilDue = PRIORITY_HOURS[item.priority] ?? 48
  const dueDate = new Date(Date.now() + hoursUntilDue * 3_600_000).toISOString()
  const createdAt = new Date(Date.now() - item.daysOpen * 86_400_000).toISOString()
  return {
    id: item.id,
    object_type: item.type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    object_code: item.projectCode,
    status: item.isOverdue ? 'escalated' : 'pending',
    level: item.priority === 'critical' ? 3 : item.priority === 'high' ? 2 : 1,
    approver_role: 'Project Director',
    requested_by_name: item.requestedBy,
    due_date: dueDate,
    created_at: createdAt,
    decided_at: null,
    decision_reason: null,
  }
}

// ─────────────────────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────────────────────

export function DashboardPage({
  userName = 'Alex Carter',
  stats = MOCK_STATS,
  projects = MOCK_PROJECTS,
  approvals = MOCK_APPROVALS,
  loading = false,
  onNewProject,
  onProjectClick,
  onApprovalClick,
}: DashboardPageProps) {

  // Convert ApprovalItems to ApprovalRecords for the inbox widget
  const pendingApprovals = React.useMemo(
    () => approvals.map(toApprovalRecord),
    [approvals],
  )

  // Greeting based on time of day
  const greeting = React.useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const firstName = userName.split(' ')[0]

  return (
    <div className="space-y-6 animate-[fade-in_0.2s_ease-out]">

      {/* ── Welcome section ── */}
      <section
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        aria-label="Welcome section"
      >
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight text-balance">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s your portfolio snapshot for today.
            {stats.overdueApprovals > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-[#f59e0b] font-medium">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                {stats.overdueApprovals} approval{stats.overdueApprovals !== 1 ? 's' : ''} overdue.
              </span>
            )}
          </p>
        </div>

        <Button
          variant="gate"
          size="default"
          onClick={onNewProject}
          aria-label="Create a new project"
          className="shrink-0 self-start sm:self-auto"
        >
          <Plus className="size-4" aria-hidden="true" />
          New Project
        </Button>
      </section>

      {/* ── Stats strip (2 cols mobile → 4 cols desktop) ── */}
      <section
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        aria-label="Portfolio statistics"
      >
        <StatCard
          label="Total Projects"
          value={loading ? '—' : stats.totalProjects}
          icon={FolderKanban}
          iconBg="rgba(100,255,218,0.12)"
          iconColor="#64ffda"
          loading={loading}
        />
        <StatCard
          label="Active Projects"
          value={loading ? '—' : stats.activeProjects}
          icon={TrendingUp}
          iconBg="rgba(59,130,246,0.12)"
          iconColor="#3b82f6"
          loading={loading}
        />
        <StatCard
          label="Pending Approvals"
          value={loading ? '—' : stats.pendingApprovals}
          icon={Clock}
          iconBg="rgba(245,158,11,0.12)"
          iconColor="#f59e0b"
          loading={loading}
          alert={stats.pendingApprovals > 0 && stats.overdueApprovals > 0}
        />
        <StatCard
          label="Overdue Approvals"
          value={loading ? '—' : stats.overdueApprovals}
          icon={AlertTriangle}
          iconBg="rgba(239,68,68,0.12)"
          iconColor="#ef4444"
          loading={loading}
          alert={stats.overdueApprovals > 0}
        />
      </section>

      {/* ── 2/3 + 1/3 grid ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* Left: Recent Projects (2/3 width) */}
        <div className="xl:col-span-2">
          <RecentProjects
            projects={projects}
            onRowClick={onProjectClick}
            loading={loading}
          />
        </div>

        {/* Right: Approval Inbox compact widget (1/3 width) */}
        <div className="xl:col-span-1">
          <ApprovalInbox
            approvals={pendingApprovals}
            filter="pending"
            onApprovalClick={onApprovalClick}
            showFilters={false}
          />
        </div>

      </div>

    </div>
  )
}
