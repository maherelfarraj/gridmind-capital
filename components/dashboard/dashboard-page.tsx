'use client'

import * as React from 'react'
import {
  FolderKanban,
  Clock,
  AlertTriangle,
  Plus,
  ChevronRight,
  TrendingUp,
  Zap,
  ClipboardCheck,
  AlertCircle,
  Flame,
  ArrowUpCircle,
  Calendar,
  ArrowRight,
  Users,
  Settings,
  PlusCircle,
  Briefcase,
  RefreshCw,
  BarChart3,
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
  /** Internal PhaseKey (g0–g9) OR raw phase string from API (e.g. "engineering") */
  phase: PhaseKey | string
  gate: number
  gateName: string
  /** Budget in USD millions */
  budgetM: number
  /** Raw budget in full dollars (optional — normalised to budgetM when provided) */
  budget_amount?: number
  currency?: string
  status: ProjectRowStatus
  client: string
  targetCod?: string
  /** Raw ISO date string from API (normalised to targetCod display) */
  target_cod?: string
}

export interface DashboardStats {
  totalProjects: number
  activeProjects: number
  pendingApprovals: number
  overdueApprovals: number
  totalProjectsTrend?: string
  activeProjectsTrend?: string
  pendingApprovalsTrend?: string
  overdueApprovalsTrend?: string
}

export interface DashboardPageProps {
  userName?: string
  stats?: DashboardStats
  projects?: DashboardProject[]
  approvals?: ApprovalItem[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onNewProject?: () => void
  onProjectClick?: (project: DashboardProject) => void
  onApprovalClick?: (id: string) => void
}

// ─────────────────────────────────────────────────────────────
// Mock data — spec-exact 5 projects
// ─────────────────────────────────────────────────────────────

const MOCK_STATS: DashboardStats = {
  totalProjects: 12,
  activeProjects: 8,
  pendingApprovals: 5,
  overdueApprovals: 2,
  totalProjectsTrend: '+2 this month',
  activeProjectsTrend: '3 nearing COD',
  pendingApprovalsTrend: '2 urgent (<24h)',
  overdueApprovalsTrend: 'Escalated to CEO',
}

const MOCK_PROJECTS: DashboardProject[] = [
  { id: '1', code: 'SOL-2026-001', name: 'Al Dhafra Solar PV - Phase 1',        phase: 'engineering',  gate: 2, gateName: 'G2', budgetM: 1200,  budget_amount: 1_200_000_000, currency: 'USD', status: 'active',   client: 'EWEC',    targetCod: 'Jun 2028', target_cod: '2028-06-30' },
  { id: '2', code: 'WND-2026-002', name: 'Dogger Bank Wind Farm - Phase A',     phase: 'procurement',  gate: 3, gateName: 'G3', budgetM: 850,   budget_amount:   850_000_000, currency: 'USD', status: 'active',   client: 'Equinor', targetCod: 'Dec 2029', target_cod: '2029-12-31' },
  { id: '3', code: 'HYD-2026-003', name: 'Grand Inga Hydroelectric - Phase 1',  phase: 'intake',       gate: 0, gateName: 'G0', budgetM: 14000, budget_amount: 14_000_000_000, currency: 'USD', status: 'active',   client: 'AfDB',    targetCod: 'Jun 2032', target_cod: '2032-06-30' },
  { id: '4', code: 'SOL-2026-004', name: 'Noor Ouarzazate IV',                  phase: 'construction', gate: 4, gateName: 'G4', budgetM: 500,   budget_amount:   500_000_000, currency: 'USD', status: 'active',   client: 'MASEN',   targetCod: 'Mar 2027', target_cod: '2027-03-15' },
  { id: '5', code: 'WND-2026-005', name: 'Hornsea Project Four',                phase: 'commercial',   gate: 1, gateName: 'G1', budgetM: 2100,  budget_amount: 2_100_000_000, currency: 'USD', status: 'on-hold',  client: 'Orsted',  targetCod: 'Sep 2030', target_cod: '2030-09-30' },
]

const MOCK_APPROVALS: ApprovalItem[] = [
  { id: 'a1', type: 'gate-review',     title: 'G5 Gate Review Convene',        projectCode: 'SRS-400', projectName: 'Sirius 400MW',   requestedBy: 'J. Rivera',   daysOpen: 8, isOverdue: true,  priority: 'critical' },
  { id: 'a2', type: 'budget-variance', title: '+$12.4M Cost Variance Request', projectCode: 'NOV-600', projectName: 'Nova Offshore',  requestedBy: 'T. Müller',   daysOpen: 5, isOverdue: true,  priority: 'high'     },
  { id: 'a3', type: 'change-order',    title: 'CO-041 Inverter Substitution',  projectCode: 'ATL-300', projectName: 'Atlas Solar',    requestedBy: 'M. Al-Farsi', daysOpen: 3, isOverdue: false, priority: 'high'     },
  { id: 'a4', type: 'contract',        title: 'EPC Sub-contract Award',        projectCode: 'SOL-500', projectName: 'Sol Atacama',    requestedBy: 'R. Chen',     daysOpen: 2, isOverdue: false, priority: 'medium'   },
  { id: 'a5', type: 'hse-incident',    title: 'Near-Miss Report #NM-22',       projectCode: 'CRS-150', projectName: 'Ceres Wind',     requestedBy: 'L. Schmidt',  daysOpen: 1, isOverdue: false, priority: 'medium'   },
]

// ─────────────────────────────────────────────────────────────
// Phase / status maps
// ─────────────────────────────────────────────────────────────

const PHASE_VARIANT: Record<string, string> = {
  // PhaseKey (g0–g9)
  g0: 'intake', g1: 'intake', g2: 'commercial', g3: 'engineering',
  g4: 'procurement', g5: 'construction', g6: 'commissioning',
  // Raw API phase strings (spec)
  intake: 'intake', commercial: 'commercial', engineering: 'engineering',
  procurement: 'procurement', construction: 'construction',
  commissioning: 'commissioning', om: 'commissioning', finance: 'commissioning',
}

const PHASE_LABEL: Record<string, string> = {
  // PhaseKey (g0–g6)
  g0: 'Intake', g1: 'Commercial', g2: 'Engineering', g3: 'Engineering',
  g4: 'Procurement', g5: 'Construction', g6: 'Handover & O&M',
  // Raw API phase strings (spec)
  intake: 'Intake', commercial: 'Commercial', engineering: 'Engineering',
  procurement: 'Procurement', construction: 'Construction',
  commissioning: 'Commissioning', om: 'Handover & O&M', finance: 'Handover & O&M',
}

const STATUS_META: Record<string, { label: string; variant: string; dot?: boolean }> = {
  active:    { label: 'Active',    variant: 'approved',  dot: true },
  'at-risk': { label: 'At Risk',   variant: 'critical',  dot: true },
  planning:  { label: 'Planning',  variant: 'submitted', dot: true },
  completed: { label: 'Completed', variant: 'approved',  dot: true },
  'on-hold': { label: 'On Hold',   variant: 'draft',     dot: true },
  draft:     { label: 'Draft',     variant: 'draft',     dot: true },
  cancelled: { label: 'Cancelled', variant: 'rejected',  dot: false },
}

function cap(s: string) { return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }
const STATUS_META_FALLBACK = (raw: string): { label: string; variant: string; dot?: boolean } =>
  ({ label: cap(raw) || 'Unknown', variant: 'draft', dot: true })

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatBudget(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}B`
  return `$${m}M`
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
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
  trendText?: string
  TrendIcon?: React.ElementType
  trendColor?: string
  trendPulse?: boolean
  loading?: boolean
  alert?: boolean
}

function StatCard({
  label, value, icon: Icon, iconBg, iconColor,
  trendText, TrendIcon, trendColor = 'text-muted-foreground',
  trendPulse = false, loading = false, alert = false,
}: StatCardProps) {
  return (
    <article
      className="flex flex-col rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card px-5 py-5 shadow-sm hover:shadow-md transition-shadow duration-200"
      aria-label={`${label}: ${value}`}
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
        aria-hidden="true"
      >
        <Icon className="size-6" style={{ color: iconColor }} />
      </div>

      {loading ? (
        <div className="mt-3 space-y-2 animate-pulse">
          <div className="h-8 w-12 rounded bg-slate-200 dark:bg-muted" />
          <div className="h-3 w-28 rounded bg-slate-200 dark:bg-muted" />
          <div className="h-3 w-20 rounded bg-slate-200 dark:bg-muted" />
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
            {label}
          </p>
          <p className={cn(
            'mt-1 text-3xl font-bold leading-none tabular-nums text-slate-900 dark:text-foreground',
            alert && 'text-[#ef4444]',
          )}>
            {value}
          </p>
          {trendText && TrendIcon && (
            <p className={cn('mt-2 flex items-center gap-1 text-xs font-medium', trendColor)}>
              <TrendIcon className={cn('size-3.5 shrink-0', trendPulse && 'animate-pulse')} aria-hidden="true" />
              {trendText}
            </p>
          )}
        </>
      )}
    </article>
  )
}

// ─────────────────────────────────────────────────────────────
// Recent projects table
// ─────────────────────────────────────────────────────────────

function ProjectRowSkeleton() {
  return (
    <tr className="animate-pulse">
      {[56, 120, 80, 56, 48, 60, 56].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 rounded bg-slate-200 dark:bg-muted" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

interface RecentProjectsProps {
  projects: DashboardProject[]
  onRowClick?: (p: DashboardProject) => void
  onViewAll?: () => void
  loading?: boolean
}

function RecentProjects({ projects, onRowClick, onViewAll, loading = false }: RecentProjectsProps) {
  return (
    <section
      className="flex flex-col rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm overflow-hidden"
      aria-label="Recent Projects"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-border">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-foreground">
          <Briefcase className="size-5 text-slate-500 dark:text-muted-foreground" aria-hidden="true" />
          Recent Projects
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded transition-colors"
          aria-label="View all projects"
        >
          View All
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3 px-6">
          <FolderKanban className="size-12 text-slate-300 dark:text-muted-foreground/30" aria-hidden="true" />
          <p className="text-lg font-medium text-slate-700 dark:text-foreground">No projects yet</p>
          <p className="text-sm text-slate-500 dark:text-muted-foreground">Create your first project to get started</p>
        </div>
      )}

      {/* Table */}
      {(loading || projects.length > 0) && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm" role="table">
            <thead>
              <tr className="border-b border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/40">
                {['Code', 'Project Name', 'Phase', 'Gate', 'Budget', 'Status', 'Target COD'].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className={cn(
                      'px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-muted-foreground',
                      col === 'Budget' ? 'text-right' : 'text-left',
                    )}
                  >
                    {col}
                  </th>
                ))}
                <th scope="col" className="w-8 px-2 py-3" aria-hidden="true" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-border/60">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <ProjectRowSkeleton key={i} />)
                : projects.map((p) => {
                    const statusMeta = STATUS_META[p.status] ?? STATUS_META_FALLBACK(p.status)
                    const phaseVariant = (PHASE_VARIANT[p.phase] ?? 'intake') as Parameters<typeof Badge>[0]['variant']
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
                          isClickable && 'cursor-pointer hover:bg-sky-50 dark:hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300',
                        )}
                        aria-label={isClickable ? `Open project ${p.name}` : undefined}
                      >
                        <td className="px-4 py-3">
                          <a
                            href={`/projects/${p.id}`}
                            onClick={(e) => { e.preventDefault(); onRowClick?.(p) }}
                            className="font-mono text-xs tracking-wider text-sky-600 hover:underline focus-visible:outline-none"
                          >
                            {p.code}
                          </a>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-sm font-medium text-slate-900 dark:text-foreground truncate">{p.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-muted-foreground/70">{p.client}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={phaseVariant}>{PHASE_LABEL[p.phase]}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                            {p.gateName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-foreground">
                            {formatBudget(p.budgetM)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={statusMeta.variant as Parameters<typeof Badge>[0]['variant']}
                            dot={statusMeta.dot}
                          >
                            {statusMeta.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-500 dark:text-muted-foreground whitespace-nowrap">
                            {p.targetCod ?? '—'}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <ChevronRight className="size-4 text-slate-400 dark:text-muted-foreground" aria-hidden="true" />
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// Quick actions bar
// ─────────────────────────────────────────────────────────────

interface QuickAction {
  icon: React.ElementType
  iconColor: string
  label: string
  desc: string
  href: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: PlusCircle, iconColor: '#0a192f', label: 'Create Project',   desc: 'Start a new EPC project',          href: '/projects/new'  },
  { icon: Users,      iconColor: '#2563eb', label: 'Team Management',  desc: 'Manage users and roles',           href: '/admin/users'   },
  { icon: Settings,   iconColor: '#64748b', label: 'System Settings',  desc: 'Configure platform settings',      href: '/settings'      },
  { icon: BarChart3,  iconColor: '#0ea5e9', label: 'Reports Center',   desc: 'Generate and export project reports', href: '/reports'    },
]

function QuickActions({ onNavigate }: { onNavigate?: (href: string) => void }) {
  return (
    <section
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      aria-label="Quick actions"
    >
      {QUICK_ACTIONS.map(({ icon: Icon, iconColor, label, desc, href }) => (
        <button
          key={href}
          type="button"
          onClick={() => onNavigate?.(href)}
          className="flex flex-col items-start rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card px-5 py-5 shadow-sm text-left cursor-pointer hover:shadow-md hover:border-sky-200 dark:hover:border-sky-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition-all duration-150"
          aria-label={label}
        >
          <Icon className="size-6" style={{ color: iconColor }} aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-muted-foreground">{desc}</p>
        </button>
      ))}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// Error state
// ─────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 px-5 py-5"
    >
      <AlertTriangle className="size-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-lg font-semibold text-red-800 dark:text-red-300">Failed to load dashboard data</p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message || 'Please refresh the page or contact support.'}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-3 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <RefreshCw className="size-3.5 me-1.5" aria-hidden="true" />
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Adapter: ApprovalItem → ApprovalRecord
// ─────────────────────────────────────────────────────────────

function toApprovalRecord(item: ApprovalItem): ApprovalRecord {
  const PRIORITY_HOURS: Record<string, number> = { critical: 4, high: 24, medium: 72, low: 168 }
  const hoursUntilDue = PRIORITY_HOURS[item.priority] ?? 48
  return {
    id: item.id,
    object_type: item.type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    object_code: item.projectCode,
    status: item.isOverdue ? 'escalated' : 'pending',
    level: item.priority === 'critical' ? 3 : item.priority === 'high' ? 2 : 1,
    approver_role: 'Project Director',
    requested_by_name: item.requestedBy,
    due_date: new Date(Date.now() + hoursUntilDue * 3_600_000).toISOString(),
    created_at: new Date(Date.now() - item.daysOpen * 86_400_000).toISOString(),
    decided_at: null,
    decision_reason: null,
  }
}

// ─────────────────────────────────────────────────────────────
// Main DashboardPage
// ─────────────────────────────────────────────────────────────

export function DashboardPage({
  userName = 'Alex Carter',
  stats = MOCK_STATS,
  projects = MOCK_PROJECTS,
  approvals = MOCK_APPROVALS,
  loading = false,
  error = null,
  onRetry,
  onNewProject,
  onProjectClick,
  onApprovalClick,
}: DashboardPageProps) {
  const pendingApprovals = React.useMemo(() => approvals.map(toApprovalRecord), [approvals])
  const firstName = userName.split(' ')[0]
  // Defer date to client-only to avoid SSR/client hydration mismatch
  const [today, setToday] = React.useState<string>('')
  React.useEffect(() => { setToday(formatDate(new Date())) }, [])

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">

      {/* ── Welcome section ── */}
      <section
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        aria-label="Welcome section"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground leading-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-muted-foreground">
            Here&apos;s what&apos;s happening across your projects
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {today && (
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500 dark:text-muted-foreground">
              <Calendar className="size-4 shrink-0" aria-hidden="true" />
              {today}
            </span>
          )}
          <Button
            onClick={onNewProject}
            className="bg-[#0a192f] hover:bg-slate-800 text-white text-sm"
            aria-label="Create a new project"
          >
            <Plus className="size-4" aria-hidden="true" />
            New Project
          </Button>
        </div>
      </section>

      {/* ── Error state ── */}
      {error && <ErrorState message={error} onRetry={onRetry} />}

      {/* ── Stats strip ── */}
      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Portfolio statistics"
      >
        <StatCard
          label="Total Projects"
          value={loading ? '—' : stats.totalProjects}
          icon={FolderKanban}
          iconBg="rgba(10,25,47,0.08)"
          iconColor="#0a192f"
          trendText={stats.totalProjectsTrend ?? '+2 this month'}
          TrendIcon={TrendingUp}
          trendColor="text-green-600 dark:text-green-400"
          loading={loading}
        />
        <StatCard
          label="Active Projects"
          value={loading ? '—' : stats.activeProjects}
          icon={Zap}
          iconBg="rgba(16,185,129,0.10)"
          iconColor="#10b981"
          trendText={stats.activeProjectsTrend ?? '3 nearing COD'}
          TrendIcon={AlertCircle}
          trendColor="text-amber-600 dark:text-amber-400"
          loading={loading}
        />
        <StatCard
          label="Pending Approvals"
          value={loading ? '—' : stats.pendingApprovals}
          icon={ClipboardCheck}
          iconBg="rgba(245,158,11,0.10)"
          iconColor="#f59e0b"
          trendText={stats.pendingApprovalsTrend ?? '2 urgent (<24h)'}
          TrendIcon={Flame}
          trendColor="text-red-600 dark:text-red-400"
          trendPulse
          loading={loading}
          alert={stats.pendingApprovals > 0 && stats.overdueApprovals > 0}
        />
        <StatCard
          label="Overdue Approvals"
          value={loading ? '—' : stats.overdueApprovals}
          icon={AlertTriangle}
          iconBg="rgba(239,68,68,0.10)"
          iconColor="#ef4444"
          trendText={stats.overdueApprovalsTrend ?? 'Escalated to CEO'}
          TrendIcon={ArrowUpCircle}
          trendColor="text-pink-600 dark:text-pink-400"
          loading={loading}
          alert={stats.overdueApprovals > 0}
        />
      </section>

      {/* ── 2/3 + 1/3 grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Left: Recent Projects */}
        <div className="lg:col-span-2">
          <RecentProjects
            projects={projects}
            onRowClick={onProjectClick}
            loading={loading}
          />
        </div>

        {/* Right: Approval Inbox widget */}
        <div className="lg:col-span-1 flex flex-col rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm overflow-hidden">
          {/* Widget header */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-border">
            <Clock className="size-5 text-slate-500 dark:text-muted-foreground shrink-0" aria-hidden="true" />
            <h2 className="flex-1 text-lg font-semibold text-slate-900 dark:text-foreground">Pending Approvals</h2>
            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {loading ? '—' : stats.pendingApprovals}
            </span>
          </div>
          {/* Inbox (filter hidden in compact mode) */}
          <div className="flex-1 overflow-hidden">
            <ApprovalInbox
              approvals={loading ? [] : pendingApprovals}
              filter="pending"
              onApprovalClick={onApprovalClick}
              showFilters={false}
            />
          </div>
          {/* Footer */}
          <div className="border-t border-slate-100 dark:border-border px-5 py-3 text-center">
            <a
              href="/approvals"
              className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded transition-colors"
            >
              View All Approvals
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <QuickActions onNavigate={(href) => {
        if (typeof window !== 'undefined') window.location.href = href
      }} />

    </div>
  )
}
