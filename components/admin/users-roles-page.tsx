'use client'

import * as React from 'react'
import {
  UserPlus, Users, UserCheck, Shield, Mail,
  User, Send, CheckCircle2, X, Search,
  SlidersHorizontal, Filter, ArrowUpDown,
  MoreVertical, CheckCircle, XCircle, Trash2,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */

export type UserRole =
  | 'super_admin' | 'tenant_admin' | 'executive_sponsor' | 'pmo_director'
  | 'project_manager' | 'engineering_manager' | 'procurement_manager'
  | 'construction_manager' | 'hse_manager' | 'qaqc_manager'
  | 'commissioning_manager' | 'om_manager' | 'finance_controller'
  | 'client_pmc' | 'viewer'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  status: 'active' | 'inactive'
  lastActive: string   // human-readable e.g. "2 hours ago"
  joinedAt: string     // ISO date string
}

export interface UsersRolesProps {
  users?: UserProfile[]
  totalCount?: number
  currentPage?: number
  pageSize?: number
  onInvite?: (data: { email: string; full_name: string; role: UserRole; department?: string }) => Promise<void>
  onUpdateRole?: (userId: string, role: UserRole) => Promise<void>
  onToggleStatus?: (userId: string, isActive: boolean) => Promise<void>
  onDelete?: (userId: string) => Promise<void>
  isLoading?: boolean
}

/* ─────────────────────────────────────────────
   ROLE META — 15 roles with spec-exact colors
───────────────────────────────────────────── */

interface RoleMeta {
  label: string
  badge: string    // bg + text + border
  avatar: string   // bg + text
  description: string
  permissions: string[]
}

const ROLE_META: Record<string, RoleMeta> = {
  super_admin:           { label: 'Super Admin',           badge: 'bg-purple-100 text-purple-700 border-purple-200',    avatar: 'bg-purple-200 text-purple-800',    description: 'Full platform access with all administrative privileges.', permissions: ['All modules', 'Tenant management', 'User management', 'System configuration', 'Audit logs', 'Billing'] },
  tenant_admin:          { label: 'Tenant Admin',          badge: 'bg-blue-100 text-blue-700 border-blue-200',          avatar: 'bg-blue-200 text-blue-800',         description: 'Organisation-level admin managing users and settings.',     permissions: ['User management', 'Settings', 'All modules', 'Reports', 'Integrations'] },
  executive_sponsor:     { label: 'Executive Sponsor',     badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', avatar: 'bg-emerald-200 text-emerald-800',   description: 'Executive oversight with read access across all projects.',  permissions: ['Portfolio view', 'Executive dashboard', 'Reports', 'Stage gates'] },
  pmo_director:          { label: 'PMO Director',          badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',    avatar: 'bg-indigo-200 text-indigo-800',     description: 'Directs the PMO with full project management rights.',       permissions: ['Project management', 'Resource planning', 'Reports', 'Stage gates', 'Risk'] },
  project_manager:       { label: 'Project Manager',       badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',          avatar: 'bg-cyan-200 text-cyan-800',          description: 'Manages individual projects end-to-end.',                    permissions: ['Project management', 'Schedule', 'Cost', 'Documents', 'Risk', 'HSE'] },
  engineering_manager:   { label: 'Engineering Manager',   badge: 'bg-orange-100 text-orange-700 border-orange-200',    avatar: 'bg-orange-200 text-orange-800',      description: 'Leads engineering deliverables and technical review.',       permissions: ['Engineering module', 'Documents', 'BIM', 'RFIs', 'Submittals'] },
  procurement_manager:   { label: 'Procurement Manager',   badge: 'bg-pink-100 text-pink-700 border-pink-200',          avatar: 'bg-pink-200 text-pink-800',          description: 'Manages procurement, contracts, and supply chain.',          permissions: ['Procurement', 'Contracts', 'Variations', 'Vendor management'] },
  construction_manager:  { label: 'Construction Manager',  badge: 'bg-amber-100 text-amber-700 border-amber-200',       avatar: 'bg-amber-200 text-amber-800',        description: 'Oversees field construction activities and safety.',         permissions: ['Construction', 'HSE', 'Toolbox talks', 'Inspections', 'Progress'] },
  hse_manager:           { label: 'HSE Manager',           badge: 'bg-red-100 text-red-700 border-red-200',             avatar: 'bg-red-200 text-red-800',             description: 'Manages health, safety, and environmental compliance.',       permissions: ['HSE module', 'Incidents', 'Observations', 'Audits', 'Permits'] },
  qaqc_manager:          { label: 'QA/QC Manager',         badge: 'bg-teal-100 text-teal-700 border-teal-200',          avatar: 'bg-teal-200 text-teal-800',          description: 'Oversees quality assurance and quality control processes.',   permissions: ['QAQC module', 'Test packs', 'Punch lists', 'NCRs', 'Inspections'] },
  commissioning_manager: { label: 'Commissioning Mgr',     badge: 'bg-lime-100 text-lime-700 border-lime-200',          avatar: 'bg-lime-200 text-lime-800',          description: 'Leads system commissioning and handover activities.',        permissions: ['Commissioning', 'Test packs', 'Dossiers', 'Punch lists'] },
  om_manager:            { label: 'O&M Manager',           badge: 'bg-green-100 text-green-700 border-green-200',       avatar: 'bg-green-200 text-green-800',        description: 'Manages operations and maintenance post-handover.',          permissions: ['O&M module', 'Assets', 'Work orders', 'Maintenance', 'Warranties'] },
  finance_controller:    { label: 'Finance Controller',    badge: 'bg-violet-100 text-violet-700 border-violet-200',    avatar: 'bg-violet-200 text-violet-800',      description: 'Controls financial reporting, budgets, and cost tracking.',  permissions: ['Finance module', 'Cost control', 'Actuals', 'Forecasts', 'Invoices'] },
  client_pmc:            { label: 'Client / PMC',          badge: 'bg-sky-100 text-sky-700 border-sky-200',             avatar: 'bg-sky-200 text-sky-800',             description: 'Client or PMC representative with view access.',             permissions: ['Client portal', 'Progress reports', 'Documents (view)', 'Meetings'] },
  viewer:                { label: 'Viewer',                badge: 'bg-slate-100 text-slate-700 border-slate-200',       avatar: 'bg-slate-200 text-slate-800',        description: 'Read-only access to assigned projects.',                     permissions: ['Project view', 'Reports (read)', 'Documents (read)'] },
}
function roleMeta(role: string): RoleMeta {
  return ROLE_META[role] ?? {
    label: role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown',
    badge:  'bg-slate-100 text-slate-600 border-slate-200',
    avatar: 'bg-slate-200 text-slate-700',
    description: 'Unrecognised role.',
    permissions: [],
  }
}

/* ─────────────────────────────────────────────
   MOCK DATA — spec-exact 10 rows
───────────────────────────────────────────── */

const MOCK_USERS: UserProfile[] = [
  { id: 'u01', name: 'John Doe',      email: 'admin@gridmind.capital',   role: 'super_admin',           department: 'Engineering',   status: 'active',   lastActive: 'Just now',     joinedAt: '2023-01-10' },
  { id: 'u02', name: 'Sarah Chen',    email: 'sarah@gridmind.capital',   role: 'project_manager',       department: 'Operations',    status: 'active',   lastActive: '2 hours ago',  joinedAt: '2023-03-15' },
  { id: 'u03', name: 'Mike Ross',     email: 'mike@gridmind.capital',    role: 'engineering_manager',   department: 'Engineering',   status: 'active',   lastActive: 'Yesterday',    joinedAt: '2023-04-20' },
  { id: 'u04', name: 'Lisa Wang',     email: 'lisa@gridmind.capital',    role: 'pmo_director',          department: 'Management',    status: 'active',   lastActive: '3 days ago',   joinedAt: '2023-02-08' },
  { id: 'u05', name: 'Tom Baker',     email: 'tom@gridmind.capital',     role: 'construction_manager',  department: 'Field Ops',     status: 'active',   lastActive: '1 week ago',   joinedAt: '2023-05-11' },
  { id: 'u06', name: 'Emma Davis',    email: 'emma@gridmind.capital',    role: 'finance_controller',    department: 'Finance',       status: 'active',   lastActive: '2 weeks ago',  joinedAt: '2023-06-01' },
  { id: 'u07', name: 'Alex Kim',      email: 'alex@gridmind.capital',    role: 'procurement_manager',   department: 'Supply Chain',  status: 'inactive', lastActive: '1 month ago',  joinedAt: '2023-07-22' },
  { id: 'u08', name: 'Rachel Green',  email: 'rachel@gridmind.capital',  role: 'hse_manager',           department: 'Safety',        status: 'active',   lastActive: '5 hours ago',  joinedAt: '2023-08-14' },
  { id: 'u09', name: 'David Lee',     email: 'david@gridmind.capital',   role: 'commissioning_manager', department: 'Operations',    status: 'active',   lastActive: '1 day ago',    joinedAt: '2023-09-03' },
  { id: 'u10', name: 'Guest User',    email: 'guest@gridmind.capital',   role: 'viewer',                department: '—',             status: 'inactive', lastActive: '3 months ago', joinedAt: '2023-10-30' },
]

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/* ─────────────────────────────────────────────
   ROLE BADGE
───────────────────────────────────────────── */

function RoleBadge({ role, onClick }: { role: string; onClick?: () => void }) {
  const meta = roleMeta(role)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 border',
        'font-sans text-xs font-medium leading-none whitespace-nowrap',
        'transition-opacity hover:opacity-80',
        onClick ? 'cursor-pointer' : 'cursor-default',
        meta.badge,
      )}
    >
      {meta.label}
    </button>
  )
}

/* ─────────────────────────────────────────────
   USER AVATAR
───────────────────────────────────────────── */

function UserAvatar({ user }: { user: UserProfile }) {
  const meta = roleMeta(user.role)
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 size-9 items-center justify-center rounded-full',
          'font-sans text-xs font-semibold select-none',
          meta.avatar,
        )}
      >
        {getInitials(user.name)}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
        <p className="text-xs text-slate-500 truncate">{user.email}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   STATS BAR — 4 cards with icons
───────────────────────────────────────────── */

function StatsBar({ users }: { users: UserProfile[] }) {
  const total    = users.length
  const active   = users.filter(u => u.status === 'active').length
  const inactive = users.filter(u => u.status === 'inactive').length
  const admins   = users.filter(u => ['super_admin', 'tenant_admin', 'pmo_director'].includes(u.role)).length
  const pending  = 2 // mock pending invites

  const cards = [
    {
      label: 'Total Users',
      value: total,
      trend: '+2 this month',
      trendColor: 'text-green-600',
      icon: <Users className="size-5" aria-hidden="true" />,
      iconBg: 'bg-[#0a192f]/10 text-[#0a192f]',
    },
    {
      label: 'Active Users',
      value: active,
      trend: `${inactive} inactive`,
      trendColor: 'text-slate-500',
      icon: <UserCheck className="size-5" aria-hidden="true" />,
      iconBg: 'bg-green-100 text-green-600',
    },
    {
      label: 'Administrators',
      value: admins,
      trend: 'Tenant + 2 PMO',
      trendColor: 'text-slate-500',
      icon: <Shield className="size-5" aria-hidden="true" />,
      iconBg: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Pending Invites',
      value: pending,
      trend: 'Expires in 7 days',
      trendColor: 'text-amber-600',
      icon: <Mail className="size-5" aria-hidden="true" />,
      iconBg: 'bg-amber-100 text-amber-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div
          key={c.label}
          className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-4 hover:shadow-md transition-shadow flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{c.label}</p>
            <span className={cn('flex items-center justify-center size-9 rounded-full', c.iconBg)}>
              {c.icon}
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{c.value}</p>
          <p className={cn('text-xs', c.trendColor)}>{c.trend}</p>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────
   FILTER BAR
───────────────────────────────────────────── */

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  ...(Object.keys(ROLE_META) as UserRole[]).map(r => ({ value: r, label: ROLE_META[r].label })),
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'name_az', label: 'Name A–Z' },
  { value: 'name_za', label: 'Name Z–A' },
  { value: 'role', label: 'Role' },
]

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  roleFilter: string
  onRoleChange: (v: string) => void
  statusFilter: string
  onStatusChange: (v: string) => void
  sort: string
  onSortChange: (v: string) => void
}

function FilterBar({
  search, onSearchChange,
  roleFilter, onRoleChange,
  statusFilter, onStatusChange,
  sort, onSortChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[280px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search by name, email, or role..."
          className={cn(
            'w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 py-2 text-sm text-slate-900',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-[#0a192f]/30 focus:border-[#0a192f]',
            'transition-colors',
          )}
          aria-label="Search users"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Role filter */}
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 min-w-[160px]">
        <SlidersHorizontal className="size-4 text-slate-400 shrink-0" aria-hidden="true" />
        <select
          value={roleFilter}
          onChange={e => onRoleChange(e.target.value)}
          className="flex-1 bg-transparent text-sm focus:outline-none cursor-pointer"
          aria-label="Filter by role"
        >
          {ROLE_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 min-w-[140px]">
        <Filter className="size-4 text-slate-400 shrink-0" aria-hidden="true" />
        <select
          value={statusFilter}
          onChange={e => onStatusChange(e.target.value)}
          className="flex-1 bg-transparent text-sm focus:outline-none cursor-pointer"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 min-w-[150px]">
        <ArrowUpDown className="size-4 text-slate-400 shrink-0" aria-hidden="true" />
        <select
          value={sort}
          onChange={e => onSortChange(e.target.value)}
          className="flex-1 bg-transparent text-sm focus:outline-none cursor-pointer"
          aria-label="Sort users"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   ROW ACTIONS DROPDOWN
───────────────────────────────────────────── */

interface RowActionsProps {
  user: UserProfile
  onToggleStatus: (user: UserProfile) => void
  onDelete: (user: UserProfile) => void
  onEditRole: (user: UserProfile) => void
}

function RowActions({ user, onToggleStatus, onDelete, onEditRole }: RowActionsProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative flex justify-center">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        aria-label={`Actions for ${user.name}`}
        aria-expanded={open}
        className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <MoreVertical className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-30 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1 text-sm">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={() => { setOpen(false) }}
          >
            <User className="size-3.5 text-slate-400" />
            View Profile
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={() => { onEditRole(user); setOpen(false) }}
          >
            <Shield className="size-3.5 text-slate-400" />
            Edit Role
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={() => { setOpen(false) }}
          >
            <Mail className="size-3.5 text-slate-400" />
            Reset Password
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 transition-colors',
              user.status === 'active'
                ? 'text-amber-600 hover:bg-amber-50'
                : 'text-green-600 hover:bg-green-50',
            )}
            onClick={() => { onToggleStatus(user); setOpen(false) }}
          >
            {user.status === 'active'
              ? <XCircle className="size-3.5" />
              : <CheckCircle className="size-3.5" />
            }
            {user.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => { onDelete(user); setOpen(false) }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   LOADING SKELETON
───────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-4 py-3 w-10"><div className="size-4 rounded bg-slate-200 animate-pulse" /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-slate-200 animate-pulse shrink-0" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3.5 w-28 rounded bg-slate-200 animate-pulse" />
            <div className="h-2.5 w-36 rounded bg-slate-200 animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><div className="h-5 w-28 rounded-md bg-slate-200 animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-20 rounded bg-slate-200 animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-slate-200 animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-20 rounded bg-slate-200 animate-pulse" /></td>
      <td className="px-4 py-3 w-16"><div className="h-6 w-6 rounded-full bg-slate-200 animate-pulse mx-auto" /></td>
    </tr>
  )
}

/* ─────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────── */

function EmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <tr>
      <td colSpan={7}>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Users className="size-12 text-slate-300" aria-hidden="true" />
          <p className="text-lg font-medium text-slate-700">No users found</p>
          <p className="text-sm text-slate-500">Try adjusting your search or filters</p>
          <button
            type="button"
            onClick={onInvite}
            className="mt-1 flex items-center gap-2 rounded-lg bg-[#0a192f] px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            <UserPlus className="size-4" />
            Invite User
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ─────────────────────────────────────────────
   BULK ACTIONS BAR
───────────────────────────────────────────── */

interface BulkActionsBarProps {
  count: number
  onChangeRole: () => void
  onActivate: () => void
  onDeactivate: () => void
  onDelete: () => void
  onClear: () => void
}

function BulkActionsBar({ count, onChangeRole, onActivate, onDeactivate, onDelete, onClear }: BulkActionsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
      <span className="text-sm font-medium text-sky-900 mr-2">{count} user{count !== 1 ? 's' : ''} selected</span>
      <button
        type="button"
        onClick={onChangeRole}
        className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-50 transition-colors"
      >
        Change Role
      </button>
      <button
        type="button"
        onClick={onActivate}
        className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 transition-colors"
      >
        Activate
      </button>
      <button
        type="button"
        onClick={onDeactivate}
        className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
      >
        Deactivate
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="size-3.5" />
        Delete
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-sky-100 hover:text-slate-600 transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────
   PAGINATION
───────────────────────────────────────────── */

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}

function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  const from = Math.min((page - 1) * pageSize + 1, total)
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
      {/* Showing */}
      <div className="flex items-center gap-2">
        <span>Showing {from} to {to} of {total} results</span>
        <select
          value={pageSize}
          onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1) }}
          className="ml-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0a192f]"
          aria-label="Rows per page"
        >
          {[10, 25, 50].map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="flex items-center justify-center size-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'flex items-center justify-center size-8 rounded-lg border text-sm transition-colors',
              p === page
                ? 'border-[#0a192f] bg-[#0a192f] text-white font-medium'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="flex items-center justify-center size-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   INVITE MODAL
───────────────────────────────────────────── */

const ROLE_OPTIONS = (Object.keys(ROLE_META) as UserRole[]).map(key => ({
  value: key,
  label: ROLE_META[key].label,
}))

interface InviteModalProps {
  open: boolean
  onClose: () => void
  onInvite: (data: { email: string; full_name: string; role: UserRole; department?: string }) => Promise<void>
}

function InviteModal({ open, onClose, onInvite }: InviteModalProps) {
  const [email,   setEmail]   = React.useState('')
  const [name,    setName]    = React.useState('')
  const [role,    setRole]    = React.useState('')
  const [dept,    setDept]    = React.useState('')
  const [message, setMessage] = React.useState('')
  const [errors,  setErrors]  = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(false)
  const [sent,    setSent]    = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setEmail(''); setName(''); setRole(''); setDept(''); setMessage('')
      setErrors({}); setLoading(false); setSent(false)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open, onClose])

  function validate() {
    const errs: Record<string, string> = {}
    if (!email.trim())                        errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email'
    if (!name.trim())                         errs.name = 'Full name is required'
    else if (name.trim().length < 2)          errs.name = 'Name must be at least 2 characters'
    if (!role)                                errs.role = 'Please select a role'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await onInvite({ email: email.trim(), full_name: name.trim(), role: role as UserRole, department: dept.trim() || undefined })
      setSent(true)
      await new Promise(r => setTimeout(r, 900))
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 id="invite-modal-title" className="text-xl font-bold text-slate-900">Invite User</h2>
            <p className="text-sm text-slate-500 mt-0.5">Send an invite to a new team member</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Input
              label="Email address"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })) }}
              error={errors.email}
              leadingIcon={<Mail />}
              required fullWidth autoFocus autoComplete="off"
            />
            <Input
              label="Full name"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: '' })) }}
              error={errors.name}
              leadingIcon={<User />}
              required fullWidth
            />
            <Select
              label="Role"
              placeholder="Select a role…"
              options={ROLE_OPTIONS}
              value={role}
              onValueChange={v => { setRole(v ?? ''); if (errors.role) setErrors(p => ({ ...p, role: '' })) }}
              error={errors.role}
              required fullWidth
            />
            <Input
              label="Department"
              type="text"
              placeholder="e.g., Engineering"
              value={dept}
              onChange={e => setDept(e.target.value)}
              fullWidth
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Message <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Personal invitation message..."
                rows={3}
                className={cn(
                  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm',
                  'text-slate-900 placeholder:text-slate-400',
                  'focus:outline-none focus:ring-2 focus:ring-[#0a192f]/30 focus:border-[#0a192f]',
                  'resize-none transition-colors',
                )}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <button
              type="submit"
              disabled={loading || sent}
              className={cn(
                'flex items-center gap-2 rounded-lg bg-[#0a192f] px-4 py-2 text-sm font-medium text-white',
                'hover:bg-slate-800 transition-colors',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a192f]/50',
              )}
            >
              {loading ? (
                <><span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Sending...</>
              ) : sent ? (
                <><CheckCircle2 className="size-4" />Sent!</>
              ) : (
                <><Send className="size-4" />Send Invite</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   ROLE DETAIL PANEL (slide-in from right)
───────────────────────────────────────────── */

interface RoleDetailPanelProps {
  role: UserRole | null
  users: UserProfile[]
  onClose: () => void
}

function RoleDetailPanel({ role, users, onClose }: RoleDetailPanelProps) {
  const open = !!role
  const meta = role ? ROLE_META[role] : null
  const roleUsers = role ? users.filter(u => u.role === role) : []

  React.useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open, onClose])

  return (
    <>
      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      )}
      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-[400px] max-w-full bg-white shadow-2xl border-l border-slate-200',
          'flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        role="complementary"
        aria-label={meta ? `${meta.label} role details` : 'Role details'}
      >
        {meta && role && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className={cn('inline-flex items-center rounded-md px-2.5 py-1 border text-sm font-semibold', meta.badge)}>
                  {meta.label}
                </span>
              </div>
              <button onClick={onClose} aria-label="Close panel" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="size-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {/* Description */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description</h3>
                <p className="text-sm text-slate-700">{meta.description}</p>
              </div>

              {/* Permissions */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Permissions</h3>
                <ul className="flex flex-col gap-1.5">
                  {meta.permissions.map(p => (
                    <li key={p} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle className="size-3.5 text-green-500 shrink-0" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Users in role */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {roleUsers.length} user{roleUsers.length !== 1 ? 's' : ''} assigned
                </h3>
                {roleUsers.length === 0 ? (
                  <p className="text-sm text-slate-400">No users assigned to this role.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {roleUsers.map(u => (
                      <li key={u.id} className="flex items-center gap-2.5">
                        <span className={cn('inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold shrink-0', meta.avatar)}>
                          {getInitials(u.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                          <p className="text-xs text-slate-500 truncate">{u.email}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */

export function UsersRolesPage({
  users: externalUsers,
  totalCount: externalTotal,
  currentPage: externalPage,
  pageSize: externalPageSize,
  onInvite,
  onUpdateRole,
  onToggleStatus,
  onDelete,
  isLoading: externalLoading = false,
}: UsersRolesProps = {}) {
  const [users, setUsers]           = React.useState<UserProfile[]>(externalUsers ?? MOCK_USERS)
  const [loading, setLoading]       = React.useState(true)
  const [modalOpen, setModalOpen]   = React.useState(false)
  const [search, setSearch]         = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [sort, setSort]             = React.useState('newest')
  const [selected, setSelected]     = React.useState<Set<string>>(new Set())
  const [page, setPage]             = React.useState(externalPage ?? 1)
  const [pageSize, setPageSize]     = React.useState(externalPageSize ?? 10)
  const [detailRole, setDetailRole] = React.useState<UserRole | null>(null)

  const { toast } = useToast()

  /* Simulate load */
  React.useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 700)
    return () => clearTimeout(t)
  }, [])

  const isBusy = loading || externalLoading

  /* ── Filter + sort ── */
  const filtered = React.useMemo(() => {
    let list = users

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        roleMeta(u.role).label.toLowerCase().includes(q),
      )
    }
    if (roleFilter !== 'all')   list = list.filter(u => u.role === roleFilter)
    if (statusFilter !== 'all') list = list.filter(u => u.status === statusFilter)

    switch (sort) {
      case 'oldest':  list = [...list].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)); break
      case 'name_az': list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break
      case 'name_za': list = [...list].sort((a, b) => b.name.localeCompare(a.name)); break
      case 'role':    list = [...list].sort((a, b) => a.role.localeCompare(b.role)); break
      default:        list = [...list].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    }
    return list
  }, [users, search, roleFilter, statusFilter, sort])

  const total = externalTotal ?? filtered.length
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  /* ── Selection ── */
  const allOnPageSelected = paged.length > 0 && paged.every(u => selected.has(u.id))
  function toggleSelectAll() {
    if (allOnPageSelected) setSelected(s => { const n = new Set(s); paged.forEach(u => n.delete(u.id)); return n })
    else setSelected(s => { const n = new Set(s); paged.forEach(u => n.add(u.id)); return n })
  }
  function toggleRow(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  /* ── Handlers ── */
  async function handleInvite(data: { email: string; full_name: string; role: UserRole; department?: string }) {
    if (onInvite) {
      await onInvite(data)
    } else {
      const newUser: UserProfile = {
        id: `u${Date.now()}`,
        name: data.full_name,
        email: data.email,
        role: data.role,
        department: data.department ?? roleMeta(data.role).label.split(' ')[0],
        status: 'active',
        lastActive: 'Just now',
        joinedAt: new Date().toISOString().split('T')[0],
      }
      setUsers(prev => [newUser, ...prev])
    }
    toast({ variant: 'gate', title: 'Invitation Sent', description: `Invite sent to ${data.email}.`, duration: 4000 })
  }

  function handleToggleStatus(user: UserProfile) {
    const nextActive = user.status !== 'active'
    if (onToggleStatus) {
      onToggleStatus(user.id, nextActive).catch(() => {})
    }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: nextActive ? 'active' : 'inactive' } : u))
    toast({
      variant: nextActive ? 'success' : 'warning',
      title: nextActive ? 'User Activated' : 'User Deactivated',
      description: `${user.name} has been ${nextActive ? 'activated' : 'deactivated'}.`,
      duration: 3500,
    })
  }

  function handleDelete(user: UserProfile) {
    if (onDelete) onDelete(user.id).catch(() => {})
    setUsers(prev => prev.filter(u => u.id !== user.id))
    setSelected(s => { const n = new Set(s); n.delete(user.id); return n })
    toast({ variant: 'danger', title: 'User Deleted', description: `${user.name} has been removed.`, duration: 3500 })
  }

  function handleBulkActivate() {
    setUsers(prev => prev.map(u => selected.has(u.id) ? { ...u, status: 'active' } : u))
    toast({ variant: 'success', title: 'Users Activated', description: `${selected.size} user${selected.size !== 1 ? 's' : ''} activated.`, duration: 3000 })
    setSelected(new Set())
  }

  function handleBulkDeactivate() {
    setUsers(prev => prev.map(u => selected.has(u.id) ? { ...u, status: 'inactive' } : u))
    toast({ variant: 'warning', title: 'Users Deactivated', description: `${selected.size} user${selected.size !== 1 ? 's' : ''} deactivated.`, duration: 3000 })
    setSelected(new Set())
  }

  function handleBulkDelete() {
    const ids = Array.from(selected)
    setUsers(prev => prev.filter(u => !ids.includes(u.id)))
    toast({ variant: 'danger', title: 'Users Deleted', description: `${selected.size} user${selected.size !== 1 ? 's' : ''} removed.`, duration: 3000 })
    setSelected(new Set())
  }

  /* ── Sort header ── */
  function SortableHeader({ label, field }: { label: string; field: string }) {
    return (
      <button
        type="button"
        onClick={() => {
          if (sort === `${field}_az` || sort === field || sort === 'newest') setSort(`${field}_za`)
          else setSort(`${field}_az`)
        }}
        className="flex items-center gap-1 uppercase tracking-wider text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        {label}
        <ArrowUpDown className="size-3 opacity-60" />
      </button>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-6 p-6 bg-slate-50 min-h-screen">

        {/* ── Header ── */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Users &amp; Roles</h1>
            <p className="mt-1 text-sm text-slate-500">Manage team members and their access levels</p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[#0a192f] px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors mt-2 sm:mt-0 self-start sm:self-auto"
          >
            <UserPlus className="size-4" />
            Invite User
          </button>
        </div>

        {/* ── Stats bar ── */}
        <StatsBar users={users} />

        {/* ── Filter bar ── */}
        <FilterBar
          search={search} onSearchChange={v => { setSearch(v); setPage(1) }}
          roleFilter={roleFilter} onRoleChange={v => { setRoleFilter(v); setPage(1) }}
          statusFilter={statusFilter} onStatusChange={v => { setStatusFilter(v); setPage(1) }}
          sort={sort} onSortChange={v => { setSort(v); setPage(1) }}
        />

        {/* ── Bulk actions bar ── */}
        {selected.size > 0 && (
          <BulkActionsBar
            count={selected.size}
            onChangeRole={() => toast({ variant: 'info', title: 'Change Role', description: 'Role editor coming soon.', duration: 2500 })}
            onActivate={handleBulkActivate}
            onDeactivate={handleBulkDeactivate}
            onDelete={handleBulkDelete}
            onClear={() => setSelected(new Set())}
          />
        )}

        {/* ── Table ── */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" role="table" aria-label="Users and roles">
              {/* Head */}
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all users on page"
                      className="rounded border-slate-300 text-[#0a192f] focus:ring-[#0a192f]/30 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="User" field="name" /></th>
                  <th className="w-44 px-4 py-3 text-left"><SortableHeader label="Role" field="role" /></th>
                  <th className="w-36 px-4 py-3 text-left hidden md:table-cell">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Department</span>
                  </th>
                  <th className="w-28 px-4 py-3 text-left"><SortableHeader label="Status" field="status" /></th>
                  <th className="w-36 px-4 py-3 text-left hidden lg:table-cell">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Last Active</span>
                  </th>
                  <th className="w-16 px-4 py-3 text-center">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</span>
                  </th>
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {isBusy ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : paged.length === 0 ? (
                  <EmptyState onInvite={() => setModalOpen(true)} />
                ) : (
                  paged.map(user => (
                    <tr
                      key={user.id}
                      className={cn(
                        'border-b border-slate-100 cursor-pointer transition-colors',
                        selected.has(user.id) ? 'bg-sky-50' : 'hover:bg-slate-50',
                      )}
                      onClick={() => toggleRow(user.id)}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(user.id)}
                          onChange={() => toggleRow(user.id)}
                          aria-label={`Select ${user.name}`}
                          className="rounded border-slate-300 text-[#0a192f] focus:ring-[#0a192f]/30 cursor-pointer"
                        />
                      </td>

                      {/* User */}
                      <td className="px-4 py-3">
                        <UserAvatar user={user} />
                      </td>

                      {/* Role */}
                      <td className="w-44 px-4 py-3" onClick={e => e.stopPropagation()}>
                        <RoleBadge role={user.role} onClick={() => setDetailRole(user.role)} />
                      </td>

                      {/* Department */}
                      <td className="w-36 px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-slate-700">{user.department}</span>
                      </td>

                      {/* Status */}
                      <td className="w-28 px-4 py-3">
                        {user.status === 'active' ? (
                          <span className="flex items-center gap-1.5 text-sm text-green-700">
                            <CheckCircle className="size-3.5 text-green-500 shrink-0" aria-hidden="true" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm text-slate-500">
                            <XCircle className="size-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td className="w-36 px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-slate-500">{user.lastActive}</span>
                      </td>

                      {/* Actions */}
                      <td className="w-16 px-4 py-3" onClick={e => e.stopPropagation()}>
                        <RowActions
                          user={user}
                          onToggleStatus={handleToggleStatus}
                          onDelete={handleDelete}
                          onEditRole={u => setDetailRole(u.role)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isBusy && paged.length > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      </div>

      {/* ── Invite modal ── */}
      <InviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onInvite={handleInvite}
      />

      {/* ── Role detail panel ── */}
      <RoleDetailPanel
        role={detailRole}
        users={users}
        onClose={() => setDetailRole(null)}
      />
    </>
  )
}
