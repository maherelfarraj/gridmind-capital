'use client'

import * as React from 'react'
import {
  UserPlus,
  Users,
  ToggleLeft,
  ToggleRight,
  X,
  Mail,
  User,
  Shield,
  Send,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DataRegister } from '@/components/ui/data-register'
import { useToast } from '@/components/ui/toast'

/* ─────────────────────────────────────────────
   ROLE DEFINITIONS — 15 roles with unique colors
───────────────────────────────────────────── */

export type RoleKey =
  | 'super_admin' | 'tenant_admin' | 'executive_sponsor' | 'pmo_director'
  | 'project_manager' | 'engineering_manager' | 'procurement_manager'
  | 'construction_manager' | 'hse_manager' | 'qaqc_manager'
  | 'commissioning_manager' | 'om_manager' | 'finance_controller'
  | 'client_pmc' | 'viewer'

interface RoleMeta {
  label: string
  color: string   // Tailwind bg + text classes (inline so tree-shaking keeps them)
  border: string
}

const ROLE_META: Record<RoleKey, RoleMeta> = {
  super_admin:           { label: 'Super Admin',           color: 'bg-purple-500/15 text-purple-400',  border: 'border-purple-500/25' },
  tenant_admin:          { label: 'Tenant Admin',          color: 'bg-blue-500/15 text-blue-400',      border: 'border-blue-500/25' },
  executive_sponsor:     { label: 'Executive Sponsor',     color: 'bg-emerald-500/15 text-emerald-400', border: 'border-emerald-500/25' },
  pmo_director:          { label: 'PMO Director',          color: 'bg-indigo-500/15 text-indigo-400',   border: 'border-indigo-500/25' },
  project_manager:       { label: 'Project Manager',       color: 'bg-cyan-500/15 text-cyan-400',       border: 'border-cyan-500/25' },
  engineering_manager:   { label: 'Engineering Manager',   color: 'bg-orange-500/15 text-orange-400',   border: 'border-orange-500/25' },
  procurement_manager:   { label: 'Procurement Manager',   color: 'bg-pink-500/15 text-pink-400',       border: 'border-pink-500/25' },
  construction_manager:  { label: 'Construction Manager',  color: 'bg-amber-500/15 text-amber-400',     border: 'border-amber-500/25' },
  hse_manager:           { label: 'HSE Manager',           color: 'bg-red-500/15 text-red-400',         border: 'border-red-500/25' },
  qaqc_manager:          { label: 'QA/QC Manager',         color: 'bg-teal-500/15 text-teal-400',       border: 'border-teal-500/25' },
  commissioning_manager: { label: 'Commissioning Manager', color: 'bg-lime-500/15 text-lime-400',       border: 'border-lime-500/25' },
  om_manager:            { label: 'O&M Manager',           color: 'bg-green-500/15 text-green-400',     border: 'border-green-500/25' },
  finance_controller:    { label: 'Finance Controller',    color: 'bg-violet-500/15 text-violet-400',   border: 'border-violet-500/25' },
  client_pmc:            { label: 'Client / PMC',          color: 'bg-sky-500/15 text-sky-400',         border: 'border-sky-500/25' },
  viewer:                { label: 'Viewer',                color: 'bg-slate-500/15 text-slate-400',     border: 'border-slate-500/25' },
}

function RoleBadge({ role }: { role: RoleKey }) {
  const meta = ROLE_META[role]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5',
        'font-sans text-xs font-medium leading-none whitespace-nowrap border',
        meta.color, meta.border,
      )}
    >
      {meta.label}
    </span>
  )
}

/* ─────────────────────────────────────────────
   USER DATA
───────────────────────────────────────────── */

export interface UserRow {
  id: string
  name: string
  email: string
  role: RoleKey
  department: string
  status: 'active' | 'inactive'
  joinedAt: string   // ISO date string
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* Avatar initials circle */
function UserAvatar({ name, email }: { name: string; email: string }) {
  const initials = getInitials(name)
  // Deterministic color from first char code
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
  ]
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 size-8 items-center justify-center rounded-full',
          'font-sans text-xs font-semibold text-white select-none',
          color,
        )}
      >
        {initials}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
    </div>
  )
}

/* Status badge */
function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <Badge
      variant={status === 'active' ? 'approved' : 'draft'}
      dot
    >
      {status === 'active' ? 'Active' : 'Inactive'}
    </Badge>
  )
}

/* ─────────────────────────────────────────────
   MOCK DATA — 20 users across all 15 roles
───────────────────────────────────────────── */

const MOCK_USERS: UserRow[] = [
  { id: 'u01', name: 'Alex Carter',       email: 'alex.carter@gridmind.com',       role: 'super_admin',           department: 'Platform',       status: 'active',   joinedAt: '2022-01-10' },
  { id: 'u02', name: 'Priya Nair',        email: 'priya.nair@gridmind.com',        role: 'tenant_admin',          department: 'Operations',     status: 'active',   joinedAt: '2022-03-22' },
  { id: 'u03', name: 'James Whitfield',   email: 'j.whitfield@gridmind.com',       role: 'executive_sponsor',     department: 'Executive',      status: 'active',   joinedAt: '2022-02-14' },
  { id: 'u04', name: 'Fatima Al-Rashid',  email: 'f.alrashid@gridmind.com',        role: 'pmo_director',          department: 'PMO',            status: 'active',   joinedAt: '2022-04-05' },
  { id: 'u05', name: 'Liang Chen',        email: 'liang.chen@gridmind.com',        role: 'project_manager',       department: 'Projects',       status: 'active',   joinedAt: '2022-06-18' },
  { id: 'u06', name: 'Omar Suleiman',     email: 'omar.suleiman@gridmind.com',     role: 'project_manager',       department: 'Projects',       status: 'active',   joinedAt: '2022-07-01' },
  { id: 'u07', name: 'Elena Vasquez',     email: 'elena.vasquez@gridmind.com',     role: 'engineering_manager',   department: 'Engineering',    status: 'active',   joinedAt: '2022-05-30' },
  { id: 'u08', name: 'Kwame Asante',      email: 'kwame.asante@gridmind.com',      role: 'procurement_manager',   department: 'Procurement',    status: 'active',   joinedAt: '2022-08-11' },
  { id: 'u09', name: 'Hana Tanaka',       email: 'hana.tanaka@gridmind.com',       role: 'construction_manager',  department: 'Construction',   status: 'active',   joinedAt: '2022-09-15' },
  { id: 'u10', name: 'Reza Ahmadi',       email: 'reza.ahmadi@gridmind.com',       role: 'hse_manager',           department: 'HSE',            status: 'active',   joinedAt: '2022-10-03' },
  { id: 'u11', name: 'Sophie Martin',     email: 'sophie.martin@gridmind.com',     role: 'qaqc_manager',          department: 'Quality',        status: 'active',   joinedAt: '2022-11-20' },
  { id: 'u12', name: 'Amir Khalil',       email: 'amir.khalil@gridmind.com',       role: 'commissioning_manager', department: 'Commissioning',  status: 'inactive', joinedAt: '2023-01-08' },
  { id: 'u13', name: 'Yuki Nakamura',     email: 'yuki.nakamura@gridmind.com',     role: 'om_manager',            department: 'O&M',            status: 'active',   joinedAt: '2023-02-14' },
  { id: 'u14', name: 'Isabella Romano',   email: 'i.romano@gridmind.com',          role: 'finance_controller',    department: 'Finance',        status: 'active',   joinedAt: '2023-03-19' },
  { id: 'u15', name: 'Carlos Mendez',     email: 'carlos.mendez@gridmind.com',     role: 'client_pmc',            department: 'Client',         status: 'active',   joinedAt: '2023-04-02' },
  { id: 'u16', name: 'Amara Diallo',      email: 'amara.diallo@gridmind.com',      role: 'viewer',                department: 'External',       status: 'inactive', joinedAt: '2023-05-17' },
  { id: 'u17', name: 'David Park',        email: 'david.park@gridmind.com',        role: 'project_manager',       department: 'Projects',       status: 'active',   joinedAt: '2023-06-22' },
  { id: 'u18', name: 'Nadia El-Amin',     email: 'nadia.elamin@gridmind.com',      role: 'engineering_manager',   department: 'Engineering',    status: 'active',   joinedAt: '2023-07-30' },
  { id: 'u19', name: 'Thomas Reeves',     email: 't.reeves@gridmind.com',          role: 'viewer',                department: 'External',       status: 'active',   joinedAt: '2023-08-05' },
  { id: 'u20', name: 'Mei Lin',           email: 'mei.lin@gridmind.com',           role: 'finance_controller',    department: 'Finance',        status: 'inactive', joinedAt: '2023-09-12' },
]

/* ─────────────────────────────────────────────
   INVITE MODAL
───────────────────────────────────────────── */

const ROLE_OPTIONS = (Object.keys(ROLE_META) as RoleKey[]).map(key => ({
  value: key,
  label: ROLE_META[key].label,
}))

interface InviteModalProps {
  open: boolean
  onClose: () => void
  onInvite: (email: string, name: string, role: RoleKey) => void
}

function InviteModal({ open, onClose, onInvite }: InviteModalProps) {
  const [email, setEmail]       = React.useState('')
  const [name, setName]         = React.useState('')
  const [role, setRole]         = React.useState<string>('')
  const [errors, setErrors]     = React.useState<Record<string, string>>({})
  const [loading, setLoading]   = React.useState(false)
  const [sent, setSent]         = React.useState(false)

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setEmail(''); setName(''); setRole('')
      setErrors({}); setLoading(false); setSent(false)
    }
  }, [open])

  // Escape key close
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function validate() {
    const errs: Record<string, string> = {}
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address'
    if (!name.trim()) errs.name = 'Full name is required'
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (!role) errs.role = 'Please select a role'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1400))
    setLoading(false)
    setSent(true)
    await new Promise(r => setTimeout(r, 900))
    onInvite(email.trim(), name.trim(), role as RoleKey)
    onClose()
  }

  if (!open) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center size-9 rounded-full bg-primary/10 text-primary">
              <UserPlus className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="invite-modal-title" className="font-semibold text-foreground text-base">
                Invite User
              </h2>
              <p className="text-xs text-muted-foreground">Send an invitation to a new team member</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close invite dialog"
            className={cn(
              'flex items-center justify-center size-8 rounded-lg',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-4 px-6 py-5">
            <Input
              label="Email address"
              type="email"
              placeholder="user@company.com"
              value={email}
              onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })) }}
              error={errors.email}
              leadingIcon={<Mail />}
              required
              fullWidth
              autoFocus
              autoComplete="off"
            />
            <Input
              label="Full name"
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: '' })) }}
              error={errors.name}
              leadingIcon={<User />}
              required
              fullWidth
            />
            <Select
              label="Role"
              placeholder="Select a role…"
              options={ROLE_OPTIONS}
              value={role}
              onValueChange={v => { setRole(v ?? ''); if (errors.role) setErrors(p => ({ ...p, role: '' })) }}
              error={errors.role}
              required
              fullWidth
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              loading={loading}
              disabled={loading || sent}
              className="min-w-[120px]"
            >
              {sent ? (
                <>
                  <CheckCircle2 className="size-4 text-[#64ffda]" />
                  Sent!
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Send Invite
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   STATS STRIP
───────────────────────────────────────────── */

function StatsStrip({ users }: { users: UserRow[] }) {
  const total    = users.length
  const active   = users.filter(u => u.status === 'active').length
  const inactive = users.filter(u => u.status === 'inactive').length
  const roles    = new Set(users.map(u => u.role)).size

  const stats = [
    { label: 'Total Users',    value: total,    color: 'text-foreground' },
    { label: 'Active',         value: active,   color: 'text-[#22c55e]' },
    { label: 'Inactive',       value: inactive, color: 'text-[#94a3b8]' },
    { label: 'Roles in Use',   value: roles,    color: 'text-[#64ffda]' },
  ]

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(s => (
        <div
          key={s.label}
          className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-0.5"
        >
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {s.label}
          </dt>
          <dd className={cn('text-2xl font-bold font-sans tabular-nums', s.color)}>
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ─────────────────────────────────────────────
   TOGGLE ACTION CELL
───────────────────────────────────────────── */

function ToggleAction({
  user,
  onToggle,
}: {
  user: UserRow
  onToggle: (id: string) => void
}) {
  const isActive = user.status === 'active'
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(user.id) }}
      aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${user.name}`}
      aria-pressed={isActive}
      title={isActive ? 'Deactivate user' : 'Activate user'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
        'border transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        isActive
          ? 'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20'
          : 'border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20',
      )}
    >
      {isActive
        ? <><ToggleRight className="size-3.5" />Deactivate</>
        : <><ToggleLeft  className="size-3.5" />Activate</>
      }
    </button>
  )
}

/* ─────────────────────────────────────────────
   ROLE FILTER TABS
───────────────────────────────────────────── */

type RoleFilter = 'all' | RoleKey

function RoleFilterTabs({
  users,
  active,
  onChange,
}: {
  users: UserRow[]
  active: RoleFilter
  onChange: (f: RoleFilter) => void
}) {
  const counts = React.useMemo(() => {
    const map: Record<string, number> = { all: users.length }
    for (const u of users) {
      map[u.role] = (map[u.role] ?? 0) + 1
    }
    return map
  }, [users])

  // Only show tabs for roles that have at least one user
  const populated = (Object.keys(ROLE_META) as RoleKey[]).filter(r => (counts[r] ?? 0) > 0)

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div
        role="tablist"
        aria-label="Filter by role"
        className="flex items-center gap-1 min-w-max pb-1"
      >
        {/* All tab */}
        <button
          role="tab"
          aria-selected={active === 'all'}
          onClick={() => onChange('all')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
            'transition-colors duration-150 whitespace-nowrap',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            active === 'all'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Users className="size-3" />
          All
          <span className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
            active === 'all' ? 'bg-white/20' : 'bg-muted-foreground/20',
          )}>
            {counts.all}
          </span>
        </button>

        {/* Per-role tabs */}
        {populated.map(role => {
          const meta = ROLE_META[role]
          const isActive = active === role
          return (
            <button
              key={role}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(role)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
                'transition-colors duration-150 whitespace-nowrap',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                isActive
                  ? cn(meta.color, meta.border, 'border shadow-sm')
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent',
              )}
            >
              <Shield className="size-3" aria-hidden="true" />
              {meta.label}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                isActive ? 'bg-current/20' : 'bg-muted-foreground/20',
              )}>
                {counts[role] ?? 0}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */

export interface UsersRolesPageProps {
  initialUsers?: UserRow[]
}

export function UsersRolesPage({ initialUsers = MOCK_USERS }: UsersRolesPageProps) {
  const [users,       setUsers]       = React.useState<UserRow[]>(initialUsers)
  const [roleFilter,  setRoleFilter]  = React.useState<RoleFilter>('all')
  const [modalOpen,   setModalOpen]   = React.useState(false)
  const [loading,     setLoading]     = React.useState(false)
  const { toast } = useToast()

  /* Simulate initial load */
  React.useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  /* ── Filtered data for table ── */
  const tableData = React.useMemo(
    () => roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter),
    [users, roleFilter],
  )

  /* ── Toggle user status ── */
  function handleToggle(id: string) {
    setUsers(prev => prev.map(u => {
      if (u.id !== id) return u
      const next = { ...u, status: u.status === 'active' ? 'inactive' as const : 'active' as const }
      toast({
        variant: next.status === 'active' ? 'success' : 'warning',
        title: next.status === 'active' ? 'User Activated' : 'User Deactivated',
        description: `${next.name} has been ${next.status === 'active' ? 'activated' : 'deactivated'}.`,
        duration: 3500,
      })
      return next
    }))
  }

  /* ── Invite user ── */
  function handleInvite(email: string, name: string, role: RoleKey) {
    const newUser: UserRow = {
      id: `u${Date.now()}`,
      name,
      email,
      role,
      department: ROLE_META[role].label.split(' ')[0],
      status: 'active',
      joinedAt: new Date().toISOString().split('T')[0],
    }
    setUsers(prev => [newUser, ...prev])
    toast({
      variant: 'gate',
      title: 'Invitation Sent',
      description: `${name} (${email}) has been invited as ${ROLE_META[role].label}.`,
      duration: 4500,
    })
  }

  /* ── Column definitions ── */
  const columns = React.useMemo(() => [
    {
      key: 'name',
      header: 'User',
      width: '260px',
      sortable: true,
      render: (row: UserRow) => <UserAvatar name={row.name} email={row.email} />,
    },
    {
      key: 'role',
      header: 'Role',
      width: '180px',
      sortable: true,
      render: (row: UserRow) => <RoleBadge role={row.role} />,
    },
    {
      key: 'department',
      header: 'Department',
      width: '140px',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      sortable: true,
      render: (row: UserRow) => <StatusBadge status={row.status} />,
    },
    {
      key: 'joinedAt',
      header: 'Joined',
      width: '120px',
      sortable: true,
      render: (row: UserRow) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatDate(row.joinedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '130px',
      align: 'right' as const,
      render: (row: UserRow) => (
        <div className="flex justify-end">
          <ToggleAction user={row} onToggle={handleToggle} />
        </div>
      ),
    },
  ], [users]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* ── Page header ── */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground font-sans">Users &amp; Roles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage team members, roles, and access permissions across your organisation.
            </p>
          </div>
          <Button
            variant="gate"
            size="default"
            onClick={() => setModalOpen(true)}
            className="shrink-0 mt-2 sm:mt-0"
            aria-label="Invite a new user"
          >
            <UserPlus className="size-4" />
            Invite User
          </Button>
        </div>

        {/* ── Stats strip ── */}
        <StatsStrip users={users} />

        {/* ── Role filter tabs ── */}
        <RoleFilterTabs
          users={users}
          active={roleFilter}
          onChange={f => { setRoleFilter(f); }}
        />

        {/* ── Table ── */}
        <DataRegister<UserRow>
          title={
            roleFilter === 'all'
              ? 'All Users'
              : `${ROLE_META[roleFilter as RoleKey].label} Users`
          }
          data={tableData}
          columns={columns}
          searchFields={['name', 'email', 'department']}
          searchPlaceholder="Search by name, email or dept…"
          rowKey="id"
          pageSize={10}
          loading={loading}
          emptyMessage={
            roleFilter !== 'all'
              ? `No ${ROLE_META[roleFilter as RoleKey].label} users found.`
              : 'No users found. Try adjusting your search.'
          }
          actions={[
            {
              label: 'Export',
              icon: (
                <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3M8 2v8M5 9l3 3 3-3" />
                </svg>
              ),
              onClick: () => toast({ variant: 'info', title: 'Export started', description: 'User list CSV download will begin shortly.', duration: 3000 }),
              variant: 'outline',
            },
          ]}
        />
      </div>

      {/* ── Invite modal ── */}
      <InviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onInvite={handleInvite}
      />
    </>
  )
}
