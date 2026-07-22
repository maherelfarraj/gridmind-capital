'use client'

import * as React from 'react'
import {
  Send, CheckCircle, XCircle, ArrowUpCircle, RefreshCw, Users,
  FolderPlus, Pencil, Trash2, MessageSquare, FileUp, UserPlus,
  Building2, Settings, FileBarChart, Download, AlertTriangle,
  AlertCircle, DollarSign, TrendingUp, Brain, Lightbulb, Store,
  ShoppingCart, Activity, ArrowRight, ChevronDown,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */

export type WorkflowAction =
  | 'workflow.submit' | 'workflow.approve' | 'workflow.reject'
  | 'workflow.escalate' | 'workflow.request_change' | 'workflow.delegate'
  | 'project.create' | 'project.update' | 'project.delete'
  | 'approval.approve' | 'approval.reject' | 'approval.delegate' | 'approval.escalate'
  | 'comment.create'
  | 'document.upload'
  | 'user.invite' | 'user.update'
  | 'tenant.update'
  | 'setting.update'
  | 'report.generate'
  | 'audit.export'
  | 'hse.incident' | 'hse.near_miss'
  | 'finance.budget_update' | 'finance.forecast_update'
  | 'ai.analyze' | 'ai.recommend'
  | 'marketplace.list' | 'marketplace.purchase'

export type FilterOption = 'all' | 'approvals' | 'projects' | 'comments' | 'documents'

/** Flat log shape — matches server action / DB output */
export interface WorkflowLogEntry {
  id: string
  action: string
  object_type: string
  object_id: string
  object_code: string | null
  actor_name: string | null
  actor_role: string | null
  before_state: string | null
  after_state: string | null
  decision_reason: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface WorkflowTimelineProps {
  logs: WorkflowLogEntry[]
  showActor?: boolean
  maxItems?: number
  filter?: FilterOption
  className?: string
  loading?: boolean
}

/* ─────────────────────────────────────────────────────────────
   DOT + ACTION CONFIG
───────────────────────────────────────────── */

interface ActionConfig {
  dot: string        // bg-* class
  ring: string       // ring-*/30 class
  icon: React.ReactNode
  label: string
  filter: FilterOption
}

const ICON_CLS = 'size-3 text-white'

const ACTION_CONFIG: Record<string, ActionConfig> = {
  'workflow.submit':          { dot: 'bg-amber-500',   ring: 'ring-amber-500/30',   icon: <Send className={ICON_CLS} />,           label: 'Submitted for approval',   filter: 'approvals' },
  'workflow.approve':         { dot: 'bg-green-500',   ring: 'ring-green-500/30',   icon: <CheckCircle className={ICON_CLS} />,    label: 'Approved',                 filter: 'approvals' },
  'workflow.reject':          { dot: 'bg-red-500',     ring: 'ring-red-500/30',     icon: <XCircle className={ICON_CLS} />,        label: 'Rejected',                 filter: 'approvals' },
  'workflow.escalate':        { dot: 'bg-pink-500',    ring: 'ring-pink-500/30',    icon: <ArrowUpCircle className={ICON_CLS} />,  label: 'Escalated',                filter: 'approvals' },
  'workflow.request_change':  { dot: 'bg-blue-500',    ring: 'ring-blue-500/30',    icon: <RefreshCw className={ICON_CLS} />,      label: 'Changes requested',        filter: 'approvals' },
  'workflow.delegate':        { dot: 'bg-purple-500',  ring: 'ring-purple-500/30',  icon: <Users className={ICON_CLS} />,          label: 'Delegated',                filter: 'approvals' },
  'project.create':           { dot: 'bg-blue-500',    ring: 'ring-blue-500/30',    icon: <FolderPlus className={ICON_CLS} />,     label: 'Project created',          filter: 'projects'  },
  'project.update':           { dot: 'bg-slate-500',   ring: 'ring-slate-500/30',   icon: <Pencil className={ICON_CLS} />,         label: 'Project updated',          filter: 'projects'  },
  'project.delete':           { dot: 'bg-red-500',     ring: 'ring-red-500/30',     icon: <Trash2 className={ICON_CLS} />,         label: 'Project deleted',          filter: 'projects'  },
  'approval.approve':         { dot: 'bg-green-500',   ring: 'ring-green-500/30',   icon: <CheckCircle className={ICON_CLS} />,    label: 'Approved',                 filter: 'approvals' },
  'approval.reject':          { dot: 'bg-red-500',     ring: 'ring-red-500/30',     icon: <XCircle className={ICON_CLS} />,        label: 'Rejected',                 filter: 'approvals' },
  'approval.delegate':        { dot: 'bg-purple-500',  ring: 'ring-purple-500/30',  icon: <Users className={ICON_CLS} />,          label: 'Delegated',                filter: 'approvals' },
  'approval.escalate':        { dot: 'bg-pink-500',    ring: 'ring-pink-500/30',    icon: <ArrowUpCircle className={ICON_CLS} />,  label: 'Escalated',                filter: 'approvals' },
  'comment.create':           { dot: 'bg-slate-500',   ring: 'ring-slate-500/30',   icon: <MessageSquare className={ICON_CLS} />,  label: 'Comment added',            filter: 'comments'  },
  'document.upload':          { dot: 'bg-indigo-500',  ring: 'ring-indigo-500/30',  icon: <FileUp className={ICON_CLS} />,         label: 'Document uploaded',        filter: 'documents' },
  'user.invite':              { dot: 'bg-teal-500',    ring: 'ring-teal-500/30',    icon: <UserPlus className={ICON_CLS} />,       label: 'User invited',             filter: 'all'       },
  'user.update':              { dot: 'bg-slate-500',   ring: 'ring-slate-500/30',   icon: <Pencil className={ICON_CLS} />,         label: 'User updated',             filter: 'all'       },
  'tenant.update':            { dot: 'bg-slate-800',   ring: 'ring-slate-800/30',   icon: <Building2 className={ICON_CLS} />,      label: 'Tenant updated',           filter: 'all'       },
  'setting.update':           { dot: 'bg-gray-500',    ring: 'ring-gray-500/30',    icon: <Settings className={ICON_CLS} />,       label: 'Settings updated',         filter: 'all'       },
  'report.generate':          { dot: 'bg-cyan-500',    ring: 'ring-cyan-500/30',    icon: <FileBarChart className={ICON_CLS} />,   label: 'Report generated',         filter: 'documents' },
  'audit.export':             { dot: 'bg-gray-500',    ring: 'ring-gray-500/30',    icon: <Download className={ICON_CLS} />,       label: 'Audit exported',           filter: 'documents' },
  'hse.incident':             { dot: 'bg-orange-500',  ring: 'ring-orange-500/30',  icon: <AlertTriangle className={ICON_CLS} />,  label: 'HSE incident logged',      filter: 'all'       },
  'hse.near_miss':            { dot: 'bg-yellow-500',  ring: 'ring-yellow-500/30',  icon: <AlertCircle className={ICON_CLS} />,    label: 'Near miss reported',       filter: 'all'       },
  'finance.budget_update':    { dot: 'bg-emerald-500', ring: 'ring-emerald-500/30', icon: <DollarSign className={ICON_CLS} />,     label: 'Budget updated',           filter: 'all'       },
  'finance.forecast_update':  { dot: 'bg-emerald-500', ring: 'ring-emerald-500/30', icon: <TrendingUp className={ICON_CLS} />,     label: 'Forecast updated',         filter: 'all'       },
  'ai.analyze':               { dot: 'bg-violet-500',  ring: 'ring-violet-500/30',  icon: <Brain className={ICON_CLS} />,          label: 'AI analysis run',          filter: 'all'       },
  'ai.recommend':             { dot: 'bg-violet-500',  ring: 'ring-violet-500/30',  icon: <Lightbulb className={ICON_CLS} />,      label: 'AI recommendation',        filter: 'all'       },
  'marketplace.list':         { dot: 'bg-sky-500',     ring: 'ring-sky-500/30',     icon: <Store className={ICON_CLS} />,          label: 'Listed on marketplace',    filter: 'all'       },
  'marketplace.purchase':     { dot: 'bg-sky-500',     ring: 'ring-sky-500/30',     icon: <ShoppingCart className={ICON_CLS} />,   label: 'Marketplace purchase',     filter: 'all'       },
}

const FALLBACK_CONFIG: ActionConfig = {
  dot: 'bg-slate-400', ring: 'ring-slate-400/30',
  icon: <Activity className={ICON_CLS} />,
  label: 'Activity', filter: 'all',
}

function getConfig(action: string): ActionConfig {
  return ACTION_CONFIG[action] ?? FALLBACK_CONFIG
}

/* ─────────────────────────────────────────────────────────────
   OBJECT TYPE BADGES
───────────────────────────────────────────── */

const OBJECT_BADGE: Record<string, string> = {
  project:             'bg-blue-100    text-blue-700    dark:bg-blue-500/15    dark:text-blue-300',
  approval:            'bg-amber-100   text-amber-700   dark:bg-amber-500/15   dark:text-amber-300',
  'purchase order':    'bg-purple-100  text-purple-700  dark:bg-purple-500/15  dark:text-purple-300',
  'purchase_order':    'bg-purple-100  text-purple-700  dark:bg-purple-500/15  dark:text-purple-300',
  'engineering package':'bg-indigo-100 text-indigo-700  dark:bg-indigo-500/15  dark:text-indigo-300',
  comment:             'bg-slate-100   text-slate-600   dark:bg-slate-500/15   dark:text-slate-300',
  document:            'bg-gray-100    text-gray-700    dark:bg-gray-500/15    dark:text-gray-300',
  user:                'bg-teal-100    text-teal-700    dark:bg-teal-500/15    dark:text-teal-300',
  tenant:              'bg-slate-100   text-slate-700   dark:bg-slate-500/15   dark:text-slate-300',
  hse:                 'bg-orange-100  text-orange-700  dark:bg-orange-500/15  dark:text-orange-300',
  finance:             'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ai:                  'bg-violet-100  text-violet-700  dark:bg-violet-500/15  dark:text-violet-300',
  'ai report':         'bg-violet-100  text-violet-700  dark:bg-violet-500/15  dark:text-violet-300',
  marketplace:         'bg-sky-100     text-sky-700     dark:bg-sky-500/15     dark:text-sky-300',
}

function objectBadgeClass(type: string): string {
  const key = type.toLowerCase().replace(/_/g, ' ')
  // prefix match for compound types like "engineering_package_v2"
  const found = Object.keys(OBJECT_BADGE).find((k) => key.startsWith(k))
  return found ? OBJECT_BADGE[found] : 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300'
}

/* ─────────────────────────────────────────────────────────────
   STATE BADGE MAP
───────────────────────────────────────────── */

const STATE_BADGE: Record<string, string> = {
  draft:             'bg-slate-100    text-slate-700   dark:bg-slate-500/15  dark:text-slate-300',
  submitted:         'bg-amber-100    text-amber-700   dark:bg-amber-500/15  dark:text-amber-300',
  'under-review':    'bg-blue-100     text-blue-700    dark:bg-blue-500/15   dark:text-blue-300',
  'under_review':    'bg-blue-100     text-blue-700    dark:bg-blue-500/15   dark:text-blue-300',
  'pending':         'bg-amber-100    text-amber-700   dark:bg-amber-500/15  dark:text-amber-300',
  approved:          'bg-green-100    text-green-700   dark:bg-green-500/15  dark:text-green-300',
  rejected:          'bg-red-100      text-red-700     dark:bg-red-500/15    dark:text-red-300',
  escalated:         'bg-pink-100     text-pink-700    dark:bg-pink-500/15   dark:text-pink-300',
  changes_requested: 'bg-blue-100     text-blue-700    dark:bg-blue-500/15   dark:text-blue-300',
  completed:         'bg-green-100    text-green-700   dark:bg-green-500/15  dark:text-green-300',
}

function stateBadgeClass(state: string): string {
  const key = state.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  const normalised = key.replace(/_/g, '-')
  return STATE_BADGE[key] ?? STATE_BADGE[normalised] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300'
}

/* ─────────────────────────────────────────────────────────────
   TIMESTAMP FORMATTER
───────────────────────────────────────────── */

function formatTimestamp(iso: string): { relative: string; absolute: string } {
  const date = new Date(iso)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr  = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)
  const diffWk  = Math.floor(diffDay / 7)

  let relative: string
  if (diffMin < 1)        relative = 'Just now'
  else if (diffMin < 60)  relative = `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  else if (diffHr < 24)   relative = `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  else if (diffDay === 1) relative = 'Yesterday'
  else if (diffDay < 7)   relative = `${diffDay} days ago`
  else if (diffWk < 4)    relative = `${diffWk} week${diffWk !== 1 ? 's' : ''} ago`
  else                    relative = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const absolute = date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return { relative, absolute }
}

/* ─────────────────────────────────────────────────────────────
   ACTOR AVATAR
───────────────────────────────────────────── */

function ActorAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold ring-1 ring-primary/20"
      title={name}
    >
      {initials}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
   LOADING SKELETON
───────────────────────────────────────────── */

function TimelineSkeleton() {
  return (
    <div className="pl-8 space-y-5" aria-busy="true" aria-label="Loading timeline">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="relative flex gap-4 animate-pulse">
          <div className="absolute -left-[29px] mt-1 size-[22px] rounded-full bg-muted ring-4 ring-background" />
          <div className="flex-1 rounded-xl border border-border bg-card p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-36 rounded bg-muted" />
              <div className="h-5 w-20 rounded-full bg-muted" />
              <div className="h-3 w-14 rounded bg-muted ml-auto" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-5 rounded-full bg-muted" />
              <div className="h-3 w-28 rounded bg-muted" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 rounded-full bg-muted" />
              <div className="size-3 rounded bg-muted" />
              <div className="h-5 w-20 rounded-full bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Activity className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-base font-medium text-foreground">No activity yet</p>
      <p className="mt-1 text-sm text-muted-foreground">Actions and state changes will appear here</p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TIMELINE ENTRY
───────────────────────────────────────────── */

interface TimelineEntryProps {
  entry: WorkflowLogEntry
  showActor: boolean
  isLast: boolean
  index: number
}

function TimelineEntry({ entry, showActor, isLast, index }: TimelineEntryProps) {
  const cfg = getConfig(entry.action)
  const { relative, absolute } = formatTimestamp(entry.created_at)
  const displayCode = entry.object_code ?? entry.object_id
  const actorName = entry.actor_name ?? 'System'
  const tags = (entry.metadata?.tags as string[] | undefined) ?? []
  const detail = entry.metadata?.detail as string | undefined
  const signature = entry.metadata?.signature as
    | { imageUrl?: string; signerName?: string; signerRole?: string; signedAt?: string; ip?: string }
    | undefined

  return (
    <motion.li
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.05 }}
      className="relative flex gap-4"
      aria-label={`${cfg.label} — ${displayCode}`}
    >
      {/* Connector line to next item */}
      {!isLast && (
        <div
          className="absolute left-[9px] top-[26px] bottom-0 w-px bg-border"
          aria-hidden="true"
        />
      )}

      {/* Dot */}
      <div className="relative mt-1 shrink-0" aria-hidden="true">
        <div
          className={cn(
            'flex size-[22px] items-center justify-center rounded-full',
            'ring-4 ring-background shadow-sm',
            cfg.dot,
          )}
        >
          {cfg.icon}
        </div>
      </div>

      {/* Card */}
      <div
        className={cn(
          'group flex-1 min-w-0 rounded-xl border border-border bg-card',
          'px-4 py-3 mb-1',
          'shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.2)]',
          'transition-shadow duration-150',
          'hover:shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.3)]',
          'hover:border-border/60',
        )}
      >
        {/* Row 1: Label + timestamp */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-foreground leading-tight">
            {cfg.label}
          </span>

          {/* Object type badge */}
          <span
            className={cn(
              'inline-flex items-center rounded-md px-1.5 py-0.5',
              'text-[11px] font-semibold uppercase tracking-wider leading-none whitespace-nowrap',
              objectBadgeClass(entry.object_type),
            )}
          >
            {entry.object_type.replace(/_/g, ' ')}
          </span>

          {/* Timestamp — suppressHydrationWarning because relative time differs between SSR and client */}
          <time
            dateTime={new Date(entry.created_at).toISOString()}
            title={absolute}
            className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums"
            suppressHydrationWarning
          >
            {relative}
          </time>
        </div>

        {/* Row 2: Object code + actor */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-mono text-muted-foreground">{displayCode}</span>
          {showActor && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ActorAvatar name={actorName} />
              <span>
                by{' '}
                <span className="font-medium text-foreground/80">{actorName}</span>
                {entry.actor_role && (
                  <span className="text-muted-foreground"> · {entry.actor_role}</span>
                )}
              </span>
            </span>
          )}
        </div>

        {/* Row 3: State transition */}
        {(entry.before_state || entry.after_state) && (
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5"
            aria-label="State change"
          >
            {entry.before_state && (
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                  stateBadgeClass(entry.before_state),
                )}
              >
                {entry.before_state.replace(/_/g, ' ')}
              </span>
            )}
            {entry.before_state && entry.after_state && (
              <ArrowRight className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            )}
            {entry.after_state && (
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                  stateBadgeClass(entry.after_state),
                )}
              >
                {entry.after_state.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        )}

        {/* Row 4: Decision reason */}
        {entry.decision_reason && (
          <p className="mt-2 text-xs italic text-muted-foreground leading-relaxed border-l-2 border-border pl-2.5">
            &ldquo;{entry.decision_reason}&rdquo;
          </p>
        )}

        {/* Row 4b: Electronic signature */}
        {signature?.imageUrl && (
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2">
            <span className="flex h-10 items-center justify-center rounded-md bg-white px-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signature.imageUrl || '/placeholder.svg'}
                alt={`Signature of ${signature.signerName ?? 'signer'}`}
                crossOrigin="anonymous"
                className="h-8 object-contain"
              />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Signed by {signature.signerName ?? 'Authorized signer'}
                {signature.signerRole ? <span className="font-normal text-muted-foreground"> · {signature.signerRole}</span> : null}
              </p>
              {signature.signedAt && (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {new Date(signature.signedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  {signature.ip ? ` · IP ${signature.ip}` : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Row 5: Detail (from metadata) */}
        {detail && (
          <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
            {detail}
          </p>
        )}

        {/* Row 6: Metadata tags */}
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
            {tags.map((tag) => {
              const isAI      = tag.toLowerCase().includes('ai')
              const isAuto    = tag.toLowerCase().includes('auto')
              const isSLA     = tag.toLowerCase().startsWith('sla')
              const isLevel   = tag.toLowerCase().startsWith('level')
              const tagClass = isAI
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                : isAuto
                ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                : isSLA
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                : isLevel
                ? 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300'
              return (
                <span
                  key={tag}
                  className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium', tagClass)}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </motion.li>
  )
}

/* ─────────────────────────────────────────────────────────────
   FILTER DROPDOWN
───────────────────────────────────────────── */

const FILTERS: { value: FilterOption; label: string }[] = [
  { value: 'all',       label: 'All'       },
  { value: 'approvals', label: 'Approvals' },
  { value: 'projects',  label: 'Projects'  },
  { value: 'comments',  label: 'Comments'  },
  { value: 'documents', label: 'Documents' },
]

/* ─────────────────────────────────────────────────────────────
   MOCK DATA (8 items per spec)
───────────────────────────────────────────── */

const T = (daysAgo: number, hoursOffset = 0) =>
  new Date(Date.now() - daysAgo * 86_400_000 - hoursOffset * 3_600_000).toISOString()

export const MOCK_WORKFLOW_LOGS: WorkflowLogEntry[] = [
  {
    id: 'wl-1',
    action: 'workflow.submit',
    object_type: 'Project',
    object_id: 'sol-2026-001',
    object_code: 'SOL-2026-001',
    actor_name: 'Sarah Chen',
    actor_role: 'Project Director',
    before_state: 'draft',
    after_state: 'submitted',
    decision_reason: null,
    metadata: null,
    created_at: T(0, 0.03),           // ~2 min ago
  },
  {
    id: 'wl-2',
    action: 'workflow.approve',
    object_type: 'Approval',
    object_id: 'po-2026-001',
    object_code: 'PO-2026-001',
    actor_name: 'Mike Ross',
    actor_role: 'PMO Director',
    before_state: 'under_review',
    after_state: 'approved',
    decision_reason: 'All procurement criteria met',
    metadata: null,
    created_at: T(0, 1),
  },
  {
    id: 'wl-3',
    action: 'project.create',
    object_type: 'Project',
    object_id: 'wnd-2026-002',
    object_code: 'WND-2026-002',
    actor_name: 'John Doe',
    actor_role: 'Portfolio Manager',
    before_state: null,
    after_state: 'draft',
    decision_reason: null,
    metadata: null,
    created_at: T(1, 0),
  },
  {
    id: 'wl-4',
    action: 'workflow.escalate',
    object_type: 'Approval',
    object_id: 'eng-2026-003',
    object_code: 'ENG-2026-003',
    actor_name: 'Lisa Wang',
    actor_role: 'Engineering Manager',
    before_state: 'under_review',
    after_state: 'escalated',
    decision_reason: null,
    metadata: { tags: ['Level 2', 'SLA: 48h'] },
    created_at: T(2, 0),
  },
  {
    id: 'wl-5',
    action: 'comment.create',
    object_type: 'Comment',
    object_id: 'prj-2026-005',
    object_code: 'PRJ-2026-005',
    actor_name: 'Tom Baker',
    actor_role: 'Project Engineer',
    before_state: null,
    after_state: null,
    decision_reason: null,
    metadata: { detail: 'Updated milestone schedule to reflect weather delays' },
    created_at: T(3, 0),
  },
  {
    id: 'wl-6',
    action: 'document.upload',
    object_type: 'Document',
    object_id: 'sol-2026-001-doc-02',
    object_code: 'SOL-2026-001',
    actor_name: 'Sarah Chen',
    actor_role: 'Project Director',
    before_state: null,
    after_state: null,
    decision_reason: null,
    metadata: { detail: 'IFC Drawings v2.1 uploaded' },
    created_at: T(4, 0),
  },
  {
    id: 'wl-7',
    action: 'workflow.reject',
    object_type: 'Approval',
    object_id: 'rfq-2026-004',
    object_code: 'RFQ-2026-004',
    actor_name: 'Mike Ross',
    actor_role: 'PMO Director',
    before_state: 'submitted',
    after_state: 'rejected',
    decision_reason: 'Vendor qualification incomplete',
    metadata: null,
    created_at: T(5, 0),
  },
  {
    id: 'wl-8',
    action: 'ai.analyze',
    object_type: 'AI Report',
    object_id: 'sol-2026-001-ai-01',
    object_code: 'SOL-2026-001',
    actor_name: 'System',
    actor_role: 'AI Engine',
    before_state: null,
    after_state: null,
    decision_reason: null,
    metadata: { detail: 'Risk assessment updated with 3 new identified risks', tags: ['AI-assisted'] },
    created_at: T(7, 0),
  },
]

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */

export function WorkflowTimeline({
  logs = MOCK_WORKFLOW_LOGS,
  showActor = true,
  maxItems = 50,
  filter: filterProp,
  className,
  loading = false,
}: WorkflowTimelineProps) {
  const [activeFilter, setActiveFilter] = React.useState<FilterOption>(filterProp ?? 'all')
  const [filterOpen, setFilterOpen] = React.useState(false)
  const filterRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = React.useMemo(() => {
    const base = activeFilter === 'all'
      ? logs
      : logs.filter((l) => {
          const cfg = getConfig(l.action)
          return cfg.filter === activeFilter
        })
    return base.slice(0, maxItems)
  }, [logs, activeFilter, maxItems])

  const activeLabel = FILTERS.find((f) => f.value === activeFilter)?.label ?? 'All'

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm',
        'flex flex-col',
        'max-h-[600px]',
        className,
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-foreground leading-tight">
              Activity Timeline
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recent actions and state changes
            </p>
          </div>
        </div>

        {/* Filter dropdown */}
        <div className="relative shrink-0" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
            aria-label="Filter timeline"
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-border bg-background',
              'px-3 py-1.5 text-xs font-medium text-foreground',
              'hover:bg-muted transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {activeLabel}
            <ChevronDown
              className={cn('size-3.5 text-muted-foreground transition-transform duration-200', filterOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          <AnimatePresence>
            {filterOpen && (
              <motion.ul
                role="listbox"
                aria-label="Filter options"
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className={cn(
                  'absolute right-0 z-50 mt-1 min-w-[120px]',
                  'rounded-lg border border-border bg-popover shadow-lg',
                  'py-1 text-xs text-foreground',
                )}
              >
                {FILTERS.map((f) => (
                  <li key={f.value} role="option" aria-selected={activeFilter === f.value}>
                    <button
                      type="button"
                      onClick={() => { setActiveFilter(f.value); setFilterOpen(false) }}
                      className={cn(
                        'w-full px-3 py-1.5 text-left transition-colors duration-100',
                        'hover:bg-muted',
                        activeFilter === f.value && 'font-semibold text-primary',
                      )}
                    >
                      {f.label}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Body (scrollable) ── */}
      <div
        className={cn(
          'flex-1 overflow-y-auto px-6 py-4',
          // Custom thin scrollbar
          '[&::-webkit-scrollbar]:w-1.5',
          '[&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full',
          '[&::-webkit-scrollbar-thumb]:bg-border',
          'scrollbar-thin scrollbar-thumb-border',
        )}
      >
        {loading ? (
          <TimelineSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <ol
            className="relative pl-8 space-y-1"
            role="list"
            aria-label="Workflow event timeline"
          >
            {/* Background connector line */}
            <div
              className="pointer-events-none absolute left-[9px] top-1 bottom-0 w-px bg-border"
              aria-hidden="true"
            />

            {filtered.map((entry, idx) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                showActor={showActor}
                isLast={idx === filtered.length - 1}
                index={idx}
              />
            ))}
          </ol>
        )}
      </div>

      {/* ── Footer count ── */}
      {!loading && filtered.length > 0 && (
        <div className="border-t border-border px-6 py-2 shrink-0">
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Showing {filtered.length} of {logs.length} event{logs.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

export default WorkflowTimeline
