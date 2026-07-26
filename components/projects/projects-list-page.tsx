'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  FolderKanban, Plus, Download, Search, X, SlidersHorizontal,
  ArrowUpDown, ChevronLeft, ChevronRight, MoreVertical,
  FileText, ShoppingCart, Zap, HardHat, CheckCircle,
  Wrench, BarChart3, TrendingUp, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, PhaseBadge } from '@/components/ui/badge'
import { NOT_SET_LABEL } from '@/lib/format-nullable'
import { NotSet } from '@/components/ui/not-set'

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */

export type ProjectStatus = 'draft' | 'active' | 'on-hold' | 'completed' | 'cancelled' | 'planning'
export type ProjectPhase =
  | 'intake' | 'commercial' | 'engineering' | 'procurement'
  | 'construction' | 'commissioning' | 'om' | 'finance' | 'ai-analytics'

export interface Project {
  id: string
  code: string
  name: string
  client_name: string
  phase: ProjectPhase | string
  gate: string   // e.g. "G2"
  /** Raw `projects.current_phase` — the value `gate` is derived from. */
  current_phase?: number
  /** Full dollars. NULL = not recorded yet — renders "Not set", never "$0". */
  budget_amount: number | null
  status: ProjectStatus | string
  target_cod: string     // ISO date
  country?: string
  location?: string
  technology?: string
  /** NULL = not recorded yet. A real 0 is valid (substation/grid projects). */
  capacity_mw?: number | null
  health?: string
}

export interface ProjectFilters {
  status: string | null
  budgetRange: string | null
  technology: string | null
}

export interface ProjectsListProps {
  projects?: Project[]
  totalCount?: number
  currentPage?: number
  pageSize?: number
  activePhase?: string | null
  searchQuery?: string
  filters?: ProjectFilters
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onPhaseChange?: (phase: string | null) => void
  onSearchChange?: (query: string) => void
  onFilterChange?: (filters: ProjectFilters) => void
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  onRowClick?: (project: Project) => void
  onNewProject?: () => void
  onExport?: () => void
  isLoading?: boolean
  error?: string | null
}

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

const PHASE_TABS = [
  { key: 'all',         label: 'All',          icon: null },
  { key: 'intake',      label: 'Intake',        icon: FileText },
  { key: 'commercial',  label: 'Commercial',    icon: ShoppingCart },
  { key: 'engineering', label: 'Engineering',   icon: Zap },
  { key: 'procurement', label: 'Procurement',   icon: ShoppingCart },
  { key: 'construction',label: 'Construction',  icon: HardHat },
  { key: 'commissioning',label:'Commissioning', icon: CheckCircle },
  { key: 'om',          label: 'O&M',           icon: Wrench },
  { key: 'finance',     label: 'Finance',       icon: BarChart3 },
  { key: 'ai-analytics',label: 'AI Analytics',  icon: TrendingUp },
] as const

const PHASE_BADGE: Record<string, string> = {
  intake: 'intake', commercial: 'commercial', engineering: 'engineering',
  procurement: 'procurement', construction: 'construction',
  commissioning: 'commissioning', om: 'om', finance: 'finance', 'ai-analytics': 'ai-analytics',
}

const PHASE_LABEL: Record<string, string> = {
  intake: 'Intake', commercial: 'Commercial', engineering: 'Engineering',
  procurement: 'Procurement', construction: 'Construction',
  commissioning: 'Commissioning', om: 'O&M', finance: 'Finance', 'ai-analytics': 'AI Analytics',
}

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'on-hold': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  planning:  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
}

/** Capitalise an arbitrary status string for fallback badge display. */
function formatStatusLabel(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const STATUS_OPTIONS = ['All', 'Draft', 'Planning', 'Active', 'On-Hold', 'Completed', 'Cancelled']
const BUDGET_OPTIONS = ['All', '<$100M', '$100M–$1B', '>$1B']
const TECH_OPTIONS   = ['All', 'Solar PV', 'Offshore Wind', 'Hydro', 'Onshore Wind', 'CSP', 'Battery']
const SORT_OPTIONS   = [
  { value: 'newest',       label: 'Newest First' },
  { value: 'oldest',       label: 'Oldest First' },
  { value: 'name-asc',     label: 'Name A–Z' },
  { value: 'name-desc',    label: 'Name Z–A' },
  { value: 'budget-desc',  label: 'Budget High–Low' },
  { value: 'budget-asc',   label: 'Budget Low–High' },
  { value: 'cod-asc',      label: 'COD Soonest' },
]

/* ─────────────────────────────────────────────────────────────
   MOCK DATA — 10 spec projects
───────────────────────────────────────────── */

export const PROJECTS_MOCK: Project[] = [
  { id: '1', code: 'SOL-2026-001', name: 'Al Dhafra Solar PV - Phase 1',                    client_name: 'Emirates Water and Electricity Company', phase: 'engineering',   gate: 'G2', budget_amount: 1_200_000_000,  status: 'active',    target_cod: '2028-06-30' },
  { id: '2', code: 'WND-2026-002', name: 'Dogger Bank Wind Farm - Phase A',                 client_name: 'Equinor Renewables',                    phase: 'procurement',   gate: 'G3', budget_amount:   850_000_000,  status: 'active',    target_cod: '2029-12-31' },
  { id: '3', code: 'HYD-2026-003', name: 'Grand Inga Hydroelectric - Phase 1',              client_name: 'African Development Bank',               phase: 'intake',        gate: 'G0', budget_amount: 14_000_000_000, status: 'active',    target_cod: '2032-06-30' },
  { id: '4', code: 'SOL-2026-004', name: 'Noor Ouarzazate IV',                              client_name: 'MASEN',                                  phase: 'construction',  gate: 'G4', budget_amount:   500_000_000,  status: 'active',    target_cod: '2027-03-15' },
  { id: '5', code: 'WND-2026-005', name: 'Hornsea Project Four',                            client_name: 'Orsted',                                 phase: 'commercial',    gate: 'G1', budget_amount: 2_100_000_000,  status: 'on-hold',   target_cod: '2030-09-30' },
  { id: '6', code: 'BAT-2026-006', name: 'Victorian Big Battery',                           client_name: 'Neoen Australia',                        phase: 'commissioning', gate: 'G6', budget_amount:   180_000_000,  status: 'active',    target_cod: '2026-11-30' },
  { id: '7', code: 'CSP-2026-007', name: 'Noor III CSP Tower',                              client_name: 'MASEN',                                  phase: 'om',            gate: 'G6', budget_amount:   750_000_000,  status: 'active',    target_cod: '2028-01-31' },
  { id: '8', code: 'WIN-2026-008', name: 'Fosen Vind Onshore Wind',                         client_name: 'Fosen Vind',                             phase: 'commissioning', gate: 'G6', budget_amount: 1_100_000_000,  status: 'completed', target_cod: '2025-08-31' },
  { id: '9', code: 'SOL-2026-009', name: 'Mohammed bin Rashid Al Maktoum Solar Park Phase V', client_name: 'DEWA',                                 phase: 'commissioning', gate: 'G6', budget_amount:   320_000_000,  status: 'active',    target_cod: '2027-12-31' },
  { id:'10', code: 'HYD-2026-010', name: 'Ituango Hydroelectric',                           client_name: 'EPM',                                    phase: 'engineering',   gate: 'G2', budget_amount: 2_800_000_000,  status: 'draft',     target_cod: '2029-03-31' },
]

/* ───────────────────────────────────────────────────────��─────
   HELPERS
───────────────────────────────────────────── */

/** NULL budget renders as "Not set" — never as "$0M", which would look real. */
function formatBudget(dollars: number | null | undefined): string {
  if (dollars == null) return NOT_SET_LABEL
  const b = dollars / 1e9
  if (b >= 1) return `$${b % 1 === 0 ? b.toFixed(1) : b.toFixed(1)}B`
  const m = dollars / 1e6
  return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(0)}M`
}

function formatCod(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function applyBudgetFilter(amount: number | null | undefined, range: string | null): boolean {
  if (!range || range === 'All') return true
  // An unset budget has no known magnitude, so it cannot satisfy a range filter.
  // (Previously NULL was coerced to 0 upstream and wrongly matched "<$100M".)
  if (amount == null) return false
  if (range === '<$100M') return amount < 100_000_000
  if (range === '$100M–$1B') return amount >= 100_000_000 && amount <= 1_000_000_000
  if (range === '>$1B') return amount > 1_000_000_000
  return true
}

/* ─────────────────────────────────────────────────────────────
   PHASE TABS
───────────────────────────────────────────── */

function PhaseTabs({
  active, counts, onChange,
}: {
  active: string
  counts: Record<string, number>
  onChange: (key: string) => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, idx: number) {
    const len = PHASE_TABS.length
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % len
    else if (e.key === 'ArrowLeft') next = (idx - 1 + len) % len
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = len - 1
    else return
    e.preventDefault()
    onChange(PHASE_TABS[next].key)
    const btns = ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    btns?.[next]?.focus()
  }

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Filter projects by phase"
      className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-3 snap-x"
    >
      {PHASE_TABS.map((tab, idx) => {
        const isActive = active === tab.key
        const count = counts[tab.key] ?? 0
        const Icon = tab.icon

        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'snap-start flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50',
              isActive
                ? 'bg-[#0a192f] text-white shadow-sm dark:bg-[#64ffda] dark:text-[#0a192f]'
                : 'bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent hover:border-slate-300',
            )}
          >
            {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
            {tab.label}
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-full text-[10px] font-semibold leading-none',
                'min-w-[18px] h-[18px] px-1.5 tabular-nums',
                isActive
                  ? 'bg-white/20 text-white dark:bg-[#0a192f]/20 dark:text-[#0a192f]'
                  : 'bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground',
              )}
              aria-label={`${count} projects`}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   FILTER DROPDOWN
───────────────────────────────────────────── */

function FilterDropdown({
  filters, onChange,
}: {
  filters: ProjectFilters
  onChange: (f: ProjectFilters) => void
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const activeCount = [filters.status, filters.budgetRange, filters.technology]
    .filter(v => v && v !== 'All').length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
          'border-slate-200 dark:border-border bg-white dark:bg-card text-slate-600 dark:text-muted-foreground',
          'hover:bg-slate-50 dark:hover:bg-accent hover:border-slate-300',
          activeCount > 0 && 'border-sky-300 text-sky-700 dark:border-sky-600 dark:text-sky-400',
        )}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filters
        {activeCount > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-sky-600 text-[10px] text-white font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-60 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-xl p-4 space-y-4">
          {/* Status */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange({ ...filters, status: opt === 'All' ? null : opt.toLowerCase().replace(' ', '-') })}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    (filters.status ?? 'All') === (opt === 'All' ? 'All' : opt.toLowerCase().replace(' ', '-')) || (!filters.status && opt === 'All')
                      ? 'bg-[#0a192f] text-white border-transparent dark:bg-[#64ffda] dark:text-[#0a192f]'
                      : 'border-slate-200 dark:border-border text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          {/* Budget */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Budget Range</p>
            <div className="flex flex-wrap gap-1.5">
              {BUDGET_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange({ ...filters, budgetRange: opt === 'All' ? null : opt })}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    (filters.budgetRange ?? 'All') === opt || (!filters.budgetRange && opt === 'All')
                      ? 'bg-[#0a192f] text-white border-transparent dark:bg-[#64ffda] dark:text-[#0a192f]'
                      : 'border-slate-200 dark:border-border text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          {/* Technology */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Technology</p>
            <div className="flex flex-wrap gap-1.5">
              {TECH_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange({ ...filters, technology: opt === 'All' ? null : opt })}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    (filters.technology ?? 'All') === opt || (!filters.technology && opt === 'All')
                      ? 'bg-[#0a192f] text-white border-transparent dark:bg-[#64ffda] dark:text-[#0a192f]'
                      : 'border-slate-200 dark:border-border text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { onChange({ status: null, budgetRange: null, technology: null }); setOpen(false) }}
            className="w-full text-xs text-center text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground underline underline-offset-2"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   SORT DROPDOWN
───────────────────────────────────────────── */

function SortDropdown({
  sortBy, sortOrder, onChange,
}: {
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onChange: (sortBy: string, order: 'asc' | 'desc') => void
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const current = SORT_OPTIONS.find(o => {
    if (sortBy === 'name') return o.value === (sortOrder === 'asc' ? 'name-asc' : 'name-desc')
    if (sortBy === 'budget_amount') return o.value === (sortOrder === 'desc' ? 'budget-desc' : 'budget-asc')
    if (sortBy === 'target_cod') return o.value === 'cod-asc'
    if (sortBy === 'id') return o.value === (sortOrder === 'asc' ? 'oldest' : 'newest')
    return false
  }) ?? SORT_OPTIONS[0]

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function select(val: string) {
    const map: Record<string, [string, 'asc' | 'desc']> = {
      newest: ['id', 'desc'], oldest: ['id', 'asc'],
      'name-asc': ['name', 'asc'], 'name-desc': ['name', 'desc'],
      'budget-desc': ['budget_amount', 'desc'], 'budget-asc': ['budget_amount', 'asc'],
      'cod-asc': ['target_cod', 'asc'],
    }
    const [by, order] = map[val] ?? ['id', 'desc']
    onChange(by, order)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-border bg-white dark:bg-card text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent hover:border-slate-300 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <ArrowUpDown className="size-4" aria-hidden="true" />
        Sort
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-52 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-xl overflow-hidden">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              className={cn(
                'w-full text-left px-4 py-2.5 text-sm transition-colors',
                opt.value === current.value
                  ? 'bg-slate-50 dark:bg-accent font-medium text-foreground'
                  : 'text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   ROW ACTIONS DROPDOWN
───────────────────────────────────────────── */

function RowActions({
  project,
  onView, onDelete,
}: {
  project: Project
  onView: () => void
  onDelete?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Actions for ${project.name}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center justify-center size-7 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-accent hover:text-slate-600 dark:hover:text-foreground transition-colors"
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 w-40 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card shadow-xl overflow-hidden">
          {[
            { label: 'View',      action: () => { onView(); setOpen(false) } },
            { label: 'Edit',      action: () => setOpen(false) },
            { label: 'Duplicate', action: () => setOpen(false) },
          ].map(item => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent transition-colors"
            >
              {item.label}
            </button>
          ))}
          <div className="border-t border-slate-100 dark:border-border" />
          <button
            type="button"
            onClick={() => { onDelete?.(); setOpen(false) }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   LOADING SKELETON
───────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading projects" role="status">
      {/* Tab skeletons */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-slate-200 dark:bg-muted" style={{ width: `${60 + i * 10}px` }} />
        ))}
      </div>
      {/* Search bar skeleton */}
      <div className="flex gap-3">
        <div className="h-10 flex-1 rounded-lg bg-slate-200 dark:bg-muted max-w-md" />
        <div className="h-10 w-24 rounded-lg bg-slate-200 dark:bg-muted" />
        <div className="h-10 w-20 rounded-lg bg-slate-200 dark:bg-muted" />
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl border border-slate-200 dark:border-border overflow-hidden">
        <div className="bg-slate-50 dark:bg-muted/40 h-11 border-b border-slate-200 dark:border-border flex items-center gap-4 px-4">
          {[80, 200, 140, 90, 80, 90, 80, 100].map((w, i) => (
            <div key={i} className="h-3 rounded bg-slate-200 dark:bg-muted" style={{ width: `${w}px` }} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 h-14 border-b border-slate-100 dark:border-border/50">
            <div className="size-4 rounded bg-slate-200 dark:bg-muted" />
            {[80, 200, 140, 90, 80, 90, 80, 100].map((w, j) => (
              <div key={j} className="h-3.5 rounded bg-slate-200 dark:bg-muted" style={{ width: `${w}px` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────���──────────────────────
   EMPTY STATE
───────────────────────────────────────────── */

function EmptyState({
  hasFilters,
  onNewProject,
  onClearFilters,
}: {
  hasFilters: boolean
  onNewProject?: () => void
  onClearFilters?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <FolderKanban className="size-16 text-slate-300 dark:text-muted-foreground/30" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-xl font-semibold text-slate-700 dark:text-foreground">No projects found</p>
        <p className="text-sm text-slate-500 dark:text-muted-foreground">
          {hasFilters ? 'Try adjusting your search or filters.' : 'Get started by creating your first project.'}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}
            className="border-slate-200 hover:bg-slate-50 dark:border-border dark:hover:bg-accent">
            Clear Filters
          </Button>
        )}
        <Button size="sm" onClick={onNewProject}
          className="bg-[#0a192f] hover:bg-slate-800 text-white dark:bg-[#64ffda] dark:text-[#0a192f] dark:hover:bg-[#4fd1b5]">
          <Plus className="size-3.5" aria-hidden="true" />
          Create Project
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   PAGINATION
───────────────────────────────────────────── */

function Pagination({
  totalCount, currentPage, pageSize, onPageChange, onPageSizeChange,
}: {
  totalCount: number
  currentPage: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalCount)

  function pages(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages]
    if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-border">
      <p className="text-sm text-slate-500 dark:text-muted-foreground order-2 sm:order-1">
        Showing {start}–{end} of {totalCount} results
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm border border-slate-200 dark:border-border bg-white dark:bg-card text-slate-600 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        {pages().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 py-1 text-sm text-slate-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                p === currentPage
                  ? 'bg-[#0a192f] text-white border-transparent dark:bg-[#64ffda] dark:text-[#0a192f]'
                  : 'bg-white dark:bg-card text-slate-600 dark:text-muted-foreground border-slate-200 dark:border-border hover:bg-slate-100 dark:hover:bg-accent',
              )}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm border border-slate-200 dark:border-border bg-white dark:bg-card text-slate-600 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center gap-2 order-3">
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="border border-slate-200 dark:border-border rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-card text-slate-600 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          aria-label="Rows per page"
        >
          {[10, 25, 50, 100].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500 dark:text-muted-foreground">per page</span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
────────────��──────────────────────────────── */

export function ProjectsListPage({
  projects: externalProjects,
  totalCount: externalTotal,
  currentPage: externalPage,
  pageSize: externalPageSize,
  activePhase: externalPhase,
  searchQuery: externalSearch,
  filters: externalFilters,
  sortBy: externalSortBy,
  sortOrder: externalSortOrder,
  onPhaseChange,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  onNewProject,
  onExport,
  isLoading = false,
  error = null,
}: ProjectsListProps) {
  // Internal state (uncontrolled mode — used when no external props)
  const [intPhase,      setIntPhase]      = React.useState<string>('all')
  const [intSearch,     setIntSearch]     = React.useState('')
  const [intFilters,    setIntFilters]    = React.useState<ProjectFilters>({ status: null, budgetRange: null, technology: null })
  const [intSortBy,     setIntSortBy]     = React.useState('id')
  const [intSortOrder,  setIntSortOrder]  = React.useState<'asc' | 'desc'>('desc')
  const [intPage,       setIntPage]       = React.useState(1)
  const [intPageSize,   setIntPageSize]   = React.useState(10)
  const [selectedIds,   setSelectedIds]   = React.useState<Set<string>>(new Set())
  const [deleteTarget,  setDeleteTarget]  = React.useState<string | null>(null)

  // Resolve controlled vs uncontrolled
  const activePhase  = externalPhase  ?? intPhase
  const searchQuery  = externalSearch ?? intSearch
  const filters      = externalFilters  ?? intFilters
  const sortBy       = externalSortBy   ?? intSortBy
  const sortOrder    = externalSortOrder ?? intSortOrder
  const currentPage  = externalPage     ?? intPage
  const pageSize     = externalPageSize ?? intPageSize
  const allProjects  = externalProjects ?? PROJECTS_MOCK

  function setPhase(p: string) {
    onPhaseChange ? onPhaseChange(p === 'all' ? null : p) : setIntPhase(p)
    setIntPage(1)
  }
  function setSearch(q: string) {
    onSearchChange ? onSearchChange(q) : setIntSearch(q)
    setIntPage(1)
  }
  function setFilters(f: ProjectFilters) {
    onFilterChange ? onFilterChange(f) : setIntFilters(f)
    setIntPage(1)
  }
  function setSort(by: string, order: 'asc' | 'desc') {
    onSortChange ? onSortChange(by, order) : (setIntSortBy(by), setIntSortOrder(order))
  }
  function setPage(p: number) {
    onPageChange ? onPageChange(p) : setIntPage(p)
  }
  function setPageSize(s: number) {
    onPageSizeChange ? onPageSizeChange(s) : setIntPageSize(s)
    setIntPage(1)
  }

  // Phase counts (always based on full set)
  const counts = React.useMemo(() => {
    const result: Record<string, number> = { all: allProjects.length }
    PHASE_TABS.forEach(t => {
      if (t.key === 'all') return
      result[t.key] = allProjects.filter(p => p.phase === t.key).length
    })
    return result
  }, [allProjects])

  // Filtered + sorted + paginated
  const processed = React.useMemo(() => {
    let list = [...allProjects]

    // Phase filter
    if (activePhase && activePhase !== 'all') {
      list = list.filter(p => p.phase === activePhase)
    }
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q),
      )
    }
    // Status filter
    if (filters.status) {
      list = list.filter(p => p.status === filters.status)
    }
    // Budget filter
    if (filters.budgetRange) {
      list = list.filter(p => applyBudgetFilter(p.budget_amount, filters.budgetRange))
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name')          cmp = a.name.localeCompare(b.name)
      // Unset budgets sort last in BOTH directions. Subtracting nulls would give
      // NaN, which makes the comparator inconsistent and the order arbitrary.
      else if (sortBy === 'budget_amount') {
        const av = a.budget_amount, bv = b.budget_amount
        if (av == null && bv == null) cmp = 0
        else if (av == null) return 1
        else if (bv == null) return -1
        else cmp = av - bv
      }
      else if (sortBy === 'target_cod')    cmp = a.target_cod.localeCompare(b.target_cod)
      else                             cmp = a.id.localeCompare(b.id)
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const total = list.length
    const start = (currentPage - 1) * pageSize
    return { total, page: list.slice(start, start + pageSize) }
  }, [allProjects, activePhase, searchQuery, filters, sortBy, sortOrder, currentPage, pageSize])

  const hasFilters = activePhase !== 'all' || searchQuery !== '' ||
    !!(filters.status || filters.budgetRange || filters.technology)

  // Bulk selection helpers
  const allPageSelected = processed.page.length > 0 && processed.page.every(p => selectedIds.has(p.id))
  function toggleSelectAll() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) processed.page.forEach(p => next.delete(p.id))
      else processed.page.forEach(p => next.add(p.id))
      return next
    })
  }
  function toggleRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="space-y-6 p-6 bg-slate-50 dark:bg-background min-h-screen">
      {/* ── Header ───────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground font-sans">Projects</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-muted-foreground">
            Manage and track all your EPC projects across the 10-phase gate system
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-accent"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Export
          </Button>
          <Button
            size="sm"
            onClick={onNewProject}
            className="bg-[#0a192f] hover:bg-slate-800 text-white dark:bg-[#64ffda] dark:text-[#0a192f] dark:hover:bg-[#4fd1b5]"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New Project
          </Button>
        </div>
      </div>

      {/* ── Error state ──────────────────────── */}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Phase Tabs ───────────────────────── */}
      <div className="border-b border-slate-200 dark:border-border">
        <PhaseTabs active={activePhase} counts={counts} onChange={setPhase} />
      </div>

      {/* ── Search + Filter + Sort ───────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-[500px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by project code, name, or client..."
            className={cn(
              'w-full pl-9 pr-9 py-2.5 rounded-lg border text-sm bg-white dark:bg-card',
              'border-slate-200 dark:border-border text-slate-900 dark:text-foreground',
              'placeholder:text-slate-400 dark:placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400',
            )}
            aria-label="Search projects"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <FilterDropdown filters={filters} onChange={setFilters} />
        <SortDropdown sortBy={sortBy} sortOrder={sortOrder} onChange={setSort} />
      </div>

      {/* ── Bulk Actions Bar ─────────────────── */}
      {selectedIds.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex items-center justify-between gap-3 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 px-4 py-3"
        >
          <span className="text-sm font-medium text-sky-900 dark:text-sky-300">
            {selectedIds.size} project{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"
              className="border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30">
              <Download className="size-3.5" aria-hidden="true" />
              Export Selected
            </Button>
            <Button variant="outline" size="sm"
              className="border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </Button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 text-xs text-sky-600 dark:text-sky-400 underline underline-offset-2 hover:text-sky-800"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Projects Table ───────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm overflow-hidden">
        {processed.page.length === 0 ? (
          <EmptyState
            hasFilters={hasFilters}
            onNewProject={onNewProject}
            onClearFilters={() => {
              setPhase('all')
              setSearch('')
              setFilters({ status: null, budgetRange: null, technology: null })
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" id="projects-table" aria-label="Projects register">
              <thead>
                <tr className="bg-slate-50 dark:bg-muted/40 border-b border-slate-200 dark:border-border">
                  <th scope="col" className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all projects on this page"
                      className="size-4 rounded border-slate-300 dark:border-border accent-[#0a192f] dark:accent-[#64ffda]"
                    />
                  </th>
                  {[
                    { key: 'code',          label: 'Code',       w: '120px' },
                    { key: 'name',          label: 'Project Name' },
                    { key: 'client_name',   label: 'Client',     w: '180px' },
                    { key: 'phase',         label: 'Phase',      w: '130px' },
                    { key: 'gate',          label: 'Gate',       w: '90px' },
                    { key: 'budget_amount', label: 'Budget',     w: '150px', right: true },
                    { key: 'status',        label: 'Status',     w: '120px' },
                    { key: 'target_cod',    label: 'Target COD', w: '130px' },
                    { key: 'actions',       label: '',           w: '60px',  center: true },
                  ].map(col => (
                    <th
                      key={col.key}
                      scope="col"
                      style={{ width: col.w }}
                      className={cn(
                        'px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase tracking-wider',
                        col.right && 'text-right',
                        col.center && 'text-center',
                      )}
                    >
                      {col.key !== 'actions' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (sortBy === col.key) setSort(col.key, sortOrder === 'asc' ? 'desc' : 'asc')
                            else setSort(col.key, 'asc')
                          }}
                          className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-foreground transition-colors"
                          aria-sort={sortBy === col.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          {col.label}
                          {sortBy === col.key
                            ? <span aria-hidden="true">{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
                            : null}
                        </button>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processed.page.map(project => (
                  <tr
                    key={project.id}
                    onClick={() => onRowClick?.(project)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick?.(project) } }}
                    tabIndex={0}
                    role="row"
                    aria-label={`Project ${project.name}`}
                    className="border-b border-slate-100 dark:border-border/50 hover:bg-slate-50 dark:hover:bg-accent/50 transition-colors cursor-pointer group"
                  >
                    {/* Checkbox */}
                    <td className="w-10 px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(project.id)}
                        onChange={() => toggleRow(project.id)}
                        aria-label={`Select ${project.name}`}
                        className="size-4 rounded border-slate-300 dark:border-border accent-[#0a192f] dark:accent-[#64ffda]"
                      />
                    </td>
                    {/* Code */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-sm font-medium text-sky-600 dark:text-sky-400 group-hover:underline">
                        {project.code}
                      </span>
                    </td>
                    {/* Name */}
                    <td className="px-4 py-3.5 max-w-[250px]">
                      <span
                        className="text-sm font-medium text-slate-900 dark:text-foreground block truncate"
                        title={project.name}
                      >
                        {project.name}
                      </span>
                    </td>
                    {/* Client */}
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-slate-600 dark:text-muted-foreground truncate block max-w-[180px]" title={project.client_name}>
                        {project.client_name}
                      </span>
                    </td>
                    {/* Phase */}
                    <td className="px-4 py-3.5">
                      <PhaseBadge phase={PHASE_BADGE[project.phase] as any} aria-label={`Phase: ${PHASE_LABEL[project.phase] ?? project.phase}`} />
                    </td>
                    {/* Gate */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                        {project.gate}
                      </span>
                    </td>
                    {/* Budget */}
                    <td className="px-4 py-3.5 text-right">
                      {project.budget_amount == null ? (
                        <NotSet className="text-sm" />
                      ) : (
                        <span className="text-sm text-slate-700 dark:text-foreground font-mono tabular-nums">
                          {formatBudget(project.budget_amount)}
                        </span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        STATUS_STYLE[project.status] ?? STATUS_STYLE.draft,
                      )}>
                        {formatStatusLabel(project.status)}
                      </span>
                    </td>
                    {/* COD */}
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-slate-500 dark:text-muted-foreground tabular-nums">
                        {formatCod(project.target_cod)}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                      <RowActions
                        project={project}
                        onView={() => onRowClick?.(project)}
                        onDelete={() => setDeleteTarget(project.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {processed.page.length > 0 && (
          <Pagination
            totalCount={externalTotal ?? processed.total}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-card border border-slate-200 dark:border-border shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-foreground">
              Delete project?
            </h2>
            <p className="text-sm text-slate-500 dark:text-muted-foreground">
              This action cannot be undone. The project and all its data will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setDeleteTarget(null)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
