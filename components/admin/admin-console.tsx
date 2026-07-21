'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { UsersRolesPage } from '@/components/admin/users-roles-page'
import type { UserProfile, UserRole } from '@/components/admin/users-roles-page'
import {
  Users, Shield, UsersRound, ClipboardList, Settings2,
  ChevronDown, ChevronRight, Plus, X, Check, Search,
  Download, Calendar, RefreshCw, Lock, Unlock, Eye,
  EyeOff, Trash2, UserPlus, Globe, Database, Bell,
  Mail, Sliders, ToggleLeft, AlertTriangle, CheckCircle2,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// TAB TYPES
// ─────────────────────────────────────────────────────────────

type AdminTab = 'users' | 'roles' | 'teams' | 'audit' | 'system'

interface TabDef {
  id: AdminTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const TABS: TabDef[] = [
  { id: 'users',  label: 'Users',           icon: Users,         badge: 10 },
  { id: 'roles',  label: 'Roles',           icon: Shield         },
  { id: 'teams',  label: 'Teams',           icon: UsersRound     },
  { id: 'audit',  label: 'Audit Log',       icon: ClipboardList  },
  { id: 'system', label: 'System Settings', icon: Settings2      },
]

// ─────────────────────────────────────────────────────────────
// ROLES TAB
// ─────────────────────────────────────────────────────────────

type PermKey =
  | 'projects_create' | 'projects_edit' | 'projects_delete' | 'projects_view'
  | 'gates_approve'   | 'gates_edit'    | 'gates_view'
  | 'budget_edit'     | 'budget_view'   | 'budget_approve'
  | 'documents_upload'| 'documents_delete' | 'documents_view'
  | 'users_manage'    | 'users_invite'  | 'users_view'
  | 'reports_generate'| 'reports_export'| 'reports_view'

interface RoleDef {
  id: string
  name: string
  description: string
  userCount: number
  color: string
  permissions: Record<PermKey, boolean>
}

const PERMISSION_GROUPS: { label: string; keys: [PermKey, string][] }[] = [
  { label: 'Projects',  keys: [['projects_create','Create'],['projects_edit','Edit'],['projects_delete','Delete'],['projects_view','View']] },
  { label: 'Gates',     keys: [['gates_approve','Approve'],['gates_edit','Edit'],['gates_view','View']] },
  { label: 'Budget',    keys: [['budget_edit','Edit'],['budget_view','View'],['budget_approve','Approve']] },
  { label: 'Documents', keys: [['documents_upload','Upload'],['documents_delete','Delete'],['documents_view','View']] },
  { label: 'Users',     keys: [['users_manage','Manage'],['users_invite','Invite'],['users_view','View']] },
  { label: 'Reports',   keys: [['reports_generate','Generate'],['reports_export','Export'],['reports_view','View']] },
]

const ALL_PERMS: Record<PermKey, boolean> = {
  projects_create: true, projects_edit: true, projects_delete: true, projects_view: true,
  gates_approve: true, gates_edit: true, gates_view: true,
  budget_edit: true, budget_view: true, budget_approve: true,
  documents_upload: true, documents_delete: true, documents_view: true,
  users_manage: true, users_invite: true, users_view: true,
  reports_generate: true, reports_export: true, reports_view: true,
}

const MOCK_ROLES: RoleDef[] = [
  {
    id: 'r1', name: 'Super Admin', description: 'Full platform access with all administrative privileges.', userCount: 1, color: '#7c3aed',
    permissions: { ...ALL_PERMS },
  },
  {
    id: 'r2', name: 'Admin', description: 'Organisation-level admin managing users and project settings.', userCount: 2, color: '#2563eb',
    permissions: { ...ALL_PERMS, projects_delete: false, users_manage: false },
  },
  {
    id: 'r3', name: 'Project Manager', description: 'Manages individual projects end-to-end across all phases.', userCount: 4, color: '#0891b2',
    permissions: { ...ALL_PERMS, projects_delete: false, users_manage: false, users_invite: false, budget_approve: false, gates_approve: false },
  },
  {
    id: 'r4', name: 'Engineer', description: 'Technical contributor with access to engineering deliverables.', userCount: 12, color: '#d97706',
    permissions: { ...ALL_PERMS, projects_create: false, projects_delete: false, gates_approve: false, budget_edit: false, budget_approve: false, users_manage: false, users_invite: false, reports_generate: false, reports_export: false },
  },
  {
    id: 'r5', name: 'Contractor', description: 'External contractor with limited view access to assigned projects.', userCount: 8, color: '#059669',
    permissions: { projects_create: false, projects_edit: false, projects_delete: false, projects_view: true, gates_approve: false, gates_edit: false, gates_view: true, budget_edit: false, budget_view: false, budget_approve: false, documents_upload: true, documents_delete: false, documents_view: true, users_manage: false, users_invite: false, users_view: false, reports_generate: false, reports_export: false, reports_view: false },
  },
  {
    id: 'r6', name: 'Viewer', description: 'Read-only access to assigned projects and reports.', userCount: 5, color: '#64748b',
    permissions: { projects_create: false, projects_edit: false, projects_delete: false, projects_view: true, gates_approve: false, gates_edit: false, gates_view: true, budget_edit: false, budget_view: true, budget_approve: false, documents_upload: false, documents_delete: false, documents_view: true, users_manage: false, users_invite: false, users_view: false, reports_generate: false, reports_export: false, reports_view: true },
  },
]

function PermissionToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
        checked ? 'bg-[#0a192f]' : 'bg-slate-200',
      )}
    >
      <span className={cn('pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}

function RolesTab() {
  const [roles, setRoles] = React.useState<RoleDef[]>(MOCK_ROLES)
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [showCreate, setShowCreate] = React.useState(false)
  const [newRoleName, setNewRoleName] = React.useState('')
  const [newRoleDesc, setNewRoleDesc] = React.useState('')

  function togglePerm(roleId: string, key: PermKey, val: boolean) {
    setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: { ...r.permissions, [key]: val } } : r))
  }

  function createRole() {
    if (!newRoleName.trim()) return
    const perms: Record<PermKey, boolean> = Object.fromEntries(Object.keys(ALL_PERMS).map(k => [k, false])) as Record<PermKey, boolean>
    setRoles(prev => [...prev, { id: `r${Date.now()}`, name: newRoleName.trim(), description: newRoleDesc.trim(), userCount: 0, color: '#64748b', permissions: perms }])
    setNewRoleName(''); setNewRoleDesc(''); setShowCreate(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Roles &amp; Permissions</h2>
          <p className="text-sm text-slate-500 mt-0.5">Configure what each role can do across the platform.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-2 rounded-lg bg-[#0a192f] px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        >
          <Plus className="size-4" />
          Create Custom Role
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-indigo-900">New Custom Role</p>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Role name"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newRoleDesc}
              onChange={e => setNewRoleDesc(e.target.value)}
              className="flex-[2] min-w-[280px] rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="button"
              onClick={createRole}
              disabled={!newRoleName.trim()}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Check className="size-4" />
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="p-2 rounded-lg text-slate-400 hover:bg-indigo-100 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Role cards */}
      <div className="flex flex-col gap-3">
        {roles.map(role => {
          const isOpen = expanded === role.id
          const grantedCount = Object.values(role.permissions).filter(Boolean).length
          const totalCount   = Object.keys(role.permissions).length

          return (
            <div key={role.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Card header */}
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : role.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold" style={{ background: role.color }}>
                  {role.name.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{role.name}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{role.userCount} user{role.userCount !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-slate-400">{grantedCount}/{totalCount} permissions</span>
                  </div>
                  <p className="text-sm text-slate-500 truncate mt-0.5">{role.description}</p>
                </div>
                {/* Mini progress bar */}
                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 w-24">
                  <span className="text-[10px] text-slate-400">{Math.round((grantedCount / totalCount) * 100)}% access</span>
                  <div className="w-full h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(grantedCount / totalCount) * 100}%`, background: role.color }} />
                  </div>
                </div>
                {isOpen
                  ? <ChevronDown className="size-4 text-slate-400 shrink-0" />
                  : <ChevronRight className="size-4 text-slate-400 shrink-0" />
                }
              </button>

              {/* Expanded permission matrix */}
              {isOpen && (
                <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                    {PERMISSION_GROUPS.map(group => (
                      <div key={group.label}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">{group.label}</p>
                        <div className="flex flex-col gap-2">
                          {group.keys.map(([key, label]) => (
                            <div key={key} className="flex items-center justify-between gap-3">
                              <span className="text-sm text-slate-700">{label}</span>
                              <PermissionToggle
                                checked={role.permissions[key]}
                                onChange={v => togglePerm(role.id, key, v)}
                                label={`${label} permission for ${role.name}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TEAMS TAB
// ─────────────────────────────────────────────────────────────

interface TeamMember { id: string; name: string; role: string; initials: string; color: string }
interface Team { id: string; name: string; department: string; lead: string; memberCount: number; color: string; members: TeamMember[] }

const MOCK_TEAMS: Team[] = [
  { id: 't1', name: 'Engineering Core',  department: 'Engineering',   lead: 'Mike Ross',     memberCount: 6, color: '#2563eb', members: [
    { id: 'm1', name: 'Mike Ross',      role: 'Engineering Manager', initials: 'MR', color: '#dbeafe' },
    { id: 'm2', name: 'Yuki Tanaka',    role: 'Sr. Electrical Eng',  initials: 'YT', color: '#dbeafe' },
    { id: 'm3', name: 'Omar Al-Zaid',   role: 'Lead Civil Eng',      initials: 'OA', color: '#dbeafe' },
    { id: 'm4', name: 'Lin Wei',        role: 'Structural Eng',      initials: 'LW', color: '#dbeafe' },
    { id: 'm5', name: 'Priya Sharma',   role: 'Mechanical Eng',      initials: 'PS', color: '#dbeafe' },
    { id: 'm6', name: 'James Morgan',   role: 'PMO Director',        initials: 'JM', color: '#dbeafe' },
  ]},
  { id: 't2', name: 'PMO & Commercial', department: 'Management',    lead: 'Sarah Chen',    memberCount: 4, color: '#7c3aed', members: [
    { id: 'm7',  name: 'Sarah Chen',    role: 'Project Manager',     initials: 'SC', color: '#ede9fe' },
    { id: 'm8',  name: 'Lisa Wang',     role: 'PMO Director',        initials: 'LW', color: '#ede9fe' },
    { id: 'm9',  name: 'Emma Davis',    role: 'Finance Controller',  initials: 'ED', color: '#ede9fe' },
    { id: 'm10', name: 'Aisha Al-R',    role: 'Finance Controller',  initials: 'AA', color: '#ede9fe' },
  ]},
  { id: 't3', name: 'HSE & Quality',    department: 'Safety',        lead: 'Rachel Green',  memberCount: 3, color: '#dc2626', members: [
    { id: 'm11', name: 'Rachel Green',  role: 'HSE Manager',         initials: 'RG', color: '#fee2e2' },
    { id: 'm12', name: 'Mohammed H.',   role: 'HSE Inspector',       initials: 'MH', color: '#fee2e2' },
    { id: 'm13', name: 'Ali Hassan',    role: 'QA/QC Manager',       initials: 'AH', color: '#fee2e2' },
  ]},
  { id: 't4', name: 'Commissioning',    department: 'Operations',    lead: 'David Lee',     memberCount: 3, color: '#059669', members: [
    { id: 'm14', name: 'David Lee',     role: 'Commissioning Mgr',   initials: 'DL', color: '#d1fae5' },
    { id: 'm15', name: 'Rami Farouq',   role: 'Commissioning Eng',   initials: 'RF', color: '#d1fae5' },
    { id: 'm16', name: 'Sung Park',     role: 'Systems Integrator',  initials: 'SP', color: '#d1fae5' },
  ]},
  { id: 't5', name: 'Procurement',      department: 'Supply Chain',  lead: 'Alex Kim',      memberCount: 2, color: '#d97706', members: [
    { id: 'm17', name: 'Alex Kim',      role: 'Procurement Mgr',     initials: 'AK', color: '#fef3c7' },
    { id: 'm18', name: 'Nina Patel',    role: 'Contracts Specialist',initials: 'NP', color: '#fef3c7' },
  ]},
]

function TeamsTab() {
  const [teams, setTeams]           = React.useState<Team[]>(MOCK_TEAMS)
  const [selected, setSelected]     = React.useState<string | null>(null)
  const [showCreate, setShowCreate] = React.useState(false)
  const [newName, setNewName]       = React.useState('')
  const [newDept, setNewDept]       = React.useState('')

  const activeTeam = teams.find(t => t.id === selected)

  function createTeam() {
    if (!newName.trim()) return
    const colors = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2']
    const color = colors[teams.length % colors.length]
    setTeams(prev => [...prev, { id: `t${Date.now()}`, name: newName.trim(), department: newDept.trim() || 'General', lead: '—', memberCount: 0, color, members: [] }])
    setNewName(''); setNewDept(''); setShowCreate(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Teams &amp; Departments</h2>
          <p className="text-sm text-slate-500 mt-0.5">Organise users into teams and assign team leads.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-2 rounded-lg bg-[#0a192f] px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        >
          <Plus className="size-4" />
          Create Team
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-blue-900">New Team</p>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Team name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="text"
              placeholder="Department"
              value={newDept}
              onChange={e => setNewDept(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button type="button" onClick={createTeam} disabled={!newName.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
              <Check className="size-4" /> Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="p-2 rounded-lg text-slate-400 hover:bg-blue-100 transition-colors">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Team list */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          {teams.map(team => (
            <button
              key={team.id}
              type="button"
              onClick={() => setSelected(team.id === selected ? null : team.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                team.id === selected
                  ? 'border-[#0a192f] bg-[#0a192f]/5 ring-1 ring-[#0a192f]/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold" style={{ background: team.color }}>
                {team.name.charAt(0)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{team.name}</p>
                <p className="text-xs text-slate-500">{team.department} · {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</p>
              </div>
              <ChevronRight className="size-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>

        {/* Team detail */}
        <div className="lg:col-span-2">
          {activeTeam ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm h-full">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white font-bold" style={{ background: activeTeam.color }}>
                  {activeTeam.name.charAt(0)}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{activeTeam.name}</p>
                  <p className="text-xs text-slate-500">{activeTeam.department} · Lead: <span className="font-medium">{activeTeam.lead}</span></p>
                </div>
                <button type="button" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                  <UserPlus className="size-3.5" /> Add Member
                </button>
              </div>

              {/* Members */}
              <div className="divide-y divide-slate-100">
                {activeTeam.members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-slate-700" style={{ background: m.color }}>
                      {m.initials}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.role}</p>
                    </div>
                    {m.name === activeTeam.lead && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Lead</span>
                    )}
                    <button type="button" className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" aria-label={`Remove ${m.name}`}>
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white flex flex-col items-center justify-center h-full min-h-[240px] gap-2 text-slate-400">
              <UsersRound className="size-10" />
              <p className="text-sm">Select a team to view members</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AUDIT LOG TAB
// ─────────────────────────────────────────────────────────────

type AuditAction =
  | 'user_invited' | 'user_deleted' | 'user_suspended'
  | 'role_changed' | 'permission_modified'
  | 'project_created' | 'project_deleted'
  | 'login_success' | 'login_failed'
  | 'settings_changed'

interface AuditEntry {
  id: string
  timestamp: string
  actor: string
  actorInitials: string
  action: AuditAction
  target: string
  ip: string
  details: string
  severity: 'info' | 'warning' | 'danger'
}

const ACTION_META: Record<AuditAction, { label: string; color: string }> = {
  user_invited:       { label: 'User Invited',         color: '#2563eb' },
  user_deleted:       { label: 'User Deleted',          color: '#dc2626' },
  user_suspended:     { label: 'User Suspended',        color: '#d97706' },
  role_changed:       { label: 'Role Changed',          color: '#7c3aed' },
  permission_modified:{ label: 'Permission Modified',   color: '#0891b2' },
  project_created:    { label: 'Project Created',       color: '#059669' },
  project_deleted:    { label: 'Project Deleted',       color: '#dc2626' },
  login_success:      { label: 'Login Success',         color: '#16a34a' },
  login_failed:       { label: 'Login Failed',          color: '#dc2626' },
  settings_changed:   { label: 'Settings Changed',      color: '#64748b' },
}

const MOCK_AUDIT: AuditEntry[] = [
  { id: 'a1',  timestamp: '2026-07-21 17:42:11', actor: 'John Doe',     actorInitials: 'JD', action: 'user_invited',         target: 'omar.aziz@gridmind.capital', ip: '192.168.1.10',  details: 'Invited with role: Project Manager, Dept: Engineering',  severity: 'info'    },
  { id: 'a2',  timestamp: '2026-07-21 16:55:03', actor: 'Sarah Chen',   actorInitials: 'SC', action: 'role_changed',          target: 'alex@gridmind.capital',      ip: '10.0.0.42',     details: 'Changed role from Viewer → Procurement Manager',          severity: 'warning' },
  { id: 'a3',  timestamp: '2026-07-21 15:30:47', actor: 'John Doe',     actorInitials: 'JD', action: 'permission_modified',   target: 'Role: Engineer',             ip: '192.168.1.10',  details: 'Revoked reports_export permission from Engineer role',     severity: 'warning' },
  { id: 'a4',  timestamp: '2026-07-21 14:12:33', actor: 'Lisa Wang',    actorInitials: 'LW', action: 'project_created',       target: 'Helios Solar II',            ip: '10.0.0.88',     details: 'New 500MW project created under NEOM portfolio',          severity: 'info'    },
  { id: 'a5',  timestamp: '2026-07-21 13:05:21', actor: 'John Doe',     actorInitials: 'JD', action: 'user_suspended',        target: 'guest@gridmind.capital',     ip: '192.168.1.10',  details: 'Suspended for 30 days. Reason: Repeated policy violations',severity: 'danger'  },
  { id: 'a6',  timestamp: '2026-07-21 11:58:10', actor: 'Unknown',      actorInitials: '??', action: 'login_failed',          target: 'admin@gridmind.capital',     ip: '203.0.113.55',  details: '3 consecutive failed attempts — account temporarily locked',severity: 'danger'  },
  { id: 'a7',  timestamp: '2026-07-21 10:44:02', actor: 'Sarah Chen',   actorInitials: 'SC', action: 'login_success',         target: 'sarah@gridmind.capital',     ip: '10.0.0.42',     details: 'Logged in via email/password. Session created.',           severity: 'info'    },
  { id: 'a8',  timestamp: '2026-07-20 17:20:55', actor: 'John Doe',     actorInitials: 'JD', action: 'settings_changed',      target: 'Tenant Settings',            ip: '192.168.1.10',  details: 'Updated MFA policy: enforced for Admin roles',             severity: 'warning' },
  { id: 'a9',  timestamp: '2026-07-20 14:09:38', actor: 'Lisa Wang',    actorInitials: 'LW', action: 'user_deleted',          target: 'temp.user@gridmind.capital', ip: '10.0.0.88',     details: 'Soft deleted — recoverable for 30 days',                  severity: 'danger'  },
  { id: 'a10', timestamp: '2026-07-20 09:31:17', actor: 'Rachel Green', actorInitials: 'RG', action: 'project_created',       target: 'Vega BESS Phase 2',          ip: '10.0.0.15',     details: 'Created under NEOM portfolio, 200MWh battery storage',    severity: 'info'    },
  { id: 'a11', timestamp: '2026-07-19 16:47:50', actor: 'John Doe',     actorInitials: 'JD', action: 'role_changed',          target: 'rachel@gridmind.capital',    ip: '192.168.1.10',  details: 'Changed role from QA/QC Manager → HSE Manager',           severity: 'warning' },
  { id: 'a12', timestamp: '2026-07-19 11:22:04', actor: 'Sarah Chen',   actorInitials: 'SC', action: 'user_invited',          target: 'contractor1@external.com',   ip: '10.0.0.42',     details: 'Invited with role: Contractor, linked to Sirius 400MW',   severity: 'info'    },
]

const SEVERITY_META = {
  info:    { dot: 'bg-blue-500',  row: '' },
  warning: { dot: 'bg-amber-500', row: 'bg-amber-50/50' },
  danger:  { dot: 'bg-red-500',   row: 'bg-red-50/40' },
}

function AuditLogTab() {
  const [search, setSearch]     = React.useState('')
  const [actionFilter, setActionFilter] = React.useState('all')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo]     = React.useState('')

  const filtered = React.useMemo(() => {
    let list = MOCK_AUDIT
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e => e.actor.toLowerCase().includes(q) || e.target.toLowerCase().includes(q) || e.details.toLowerCase().includes(q))
    }
    if (actionFilter !== 'all') list = list.filter(e => e.action === actionFilter)
    if (dateFrom) list = list.filter(e => e.timestamp >= dateFrom)
    if (dateTo)   list = list.filter(e => e.timestamp <= dateTo + ' 23:59:59')
    return list
  }, [search, actionFilter, dateFrom, dateTo])

  function exportCSV() {
    const header = 'Timestamp,Actor,Action,Target,IP,Details\n'
    const rows = filtered.map(e =>
      `"${e.timestamp}","${e.actor}","${ACTION_META[e.action].label}","${e.target}","${e.ip}","${e.details}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Audit Log</h2>
          <p className="text-sm text-slate-500 mt-0.5">All admin and system actions across the platform.</p>
        </div>
        <button
          type="button"
          onClick={exportCSV}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search actor, target, details..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a192f]/30 focus:border-[#0a192f]"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 min-w-[180px]">
          <Sliders className="size-4 text-slate-400 shrink-0" />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            aria-label="Filter by action"
          >
            <option value="all">All Actions</option>
            {(Object.keys(ACTION_META) as AuditAction[]).map(a => (
              <option key={a} value={a}>{ACTION_META[a].label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Calendar className="size-4 text-slate-400 shrink-0" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-sm focus:outline-none" aria-label="From date" />
          </div>
          <span className="text-slate-400 text-sm">to</span>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Calendar className="size-4 text-slate-400 shrink-0" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-sm focus:outline-none" aria-label="To date" />
          </div>
        </div>
        {(search || actionFilter !== 'all' || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setActionFilter('all'); setDateFrom(''); setDateTo('') }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <X className="size-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-slate-500">{filtered.length} entries</p>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="Audit log">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Target</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">No matching audit entries</td></tr>
              ) : filtered.map((entry, i) => {
                const sev = SEVERITY_META[entry.severity]
                const actionMeta = ACTION_META[entry.action]
                return (
                  <tr key={entry.id} className={cn('border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors', sev.row)}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{entry.timestamp}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {entry.actorInitials}
                        </span>
                        <span className="text-slate-700 font-medium whitespace-nowrap">{entry.actor}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('size-2 rounded-full shrink-0', sev.dot)} />
                        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: actionMeta.color }}>
                          {actionMeta.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">{entry.target}</td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-slate-400 whitespace-nowrap">{entry.ip}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs max-w-[280px] truncate">{entry.details}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SYSTEM SETTINGS TAB
// ─────────────────────────────────────────────────────────────

interface SystemSetting { id: string; label: string; description: string; value: boolean; category: string; danger?: boolean }

const INITIAL_SYSTEM_SETTINGS: SystemSetting[] = [
  // Security
  { id: 'mfa_required',      label: 'Require MFA for Admins',       description: 'Force multi-factor authentication for all admin-level roles.',           value: true,  category: 'Security'       },
  { id: 'sso_enabled',       label: 'Enable SSO / SAML',             description: 'Allow users to sign in via your organisation identity provider.',         value: false, category: 'Security'       },
  { id: 'session_timeout',   label: 'Session Timeout (4h)',          description: 'Automatically log out inactive users after 4 hours.',                    value: true,  category: 'Security'       },
  { id: 'ip_allowlist',      label: 'IP Allowlist Enforcement',      description: 'Restrict platform access to pre-approved IP ranges.',                    value: false, category: 'Security'       },
  // Notifications
  { id: 'email_digest',      label: 'Daily Email Digest',            description: 'Send all users a daily summary of project activity.',                    value: true,  category: 'Notifications'  },
  { id: 'gate_alerts',       label: 'Stage-Gate Alert Emails',       description: 'Email notifications when a gate is convened or approved.',               value: true,  category: 'Notifications'  },
  { id: 'budget_alerts',     label: 'Budget Overrun Alerts',         description: 'Alert finance controllers when actual spend exceeds budget by >10%.',     value: true,  category: 'Notifications'  },
  // Platform
  { id: 'ai_features',       label: 'AI Recommendations',            description: 'Enable AI-generated insights and suggestions across modules.',           value: true,  category: 'Platform'       },
  { id: 'public_portal',     label: 'Stakeholder Portal (Public)',   description: 'Allow external stakeholders to access the public data room.',            value: false, category: 'Platform'       },
  { id: 'api_access',        label: 'External API Access',           description: 'Allow API key authentication for third-party integrations.',             value: true,  category: 'Platform'       },
  // Danger zone
  { id: 'audit_retention',   label: 'Audit Log Retention (365d)',    description: 'Retain audit logs for 365 days before auto-purge.',                      value: true,  category: 'Data'           },
  { id: 'allow_data_export',  label: 'Allow Full Data Export',       description: 'Permit super admins to export all platform data as ZIP archive.',        value: true,  category: 'Data'           },
  { id: 'dev_mode',          label: 'Developer / Debug Mode',        description: 'Expose extended error messages and internal API responses.',              value: false, category: 'Danger Zone', danger: true },
  { id: 'wipe_demo',         label: 'Wipe Demo Data on Next Login',  description: 'Remove all seeded demo data for all users on next platform login.',      value: false, category: 'Danger Zone', danger: true },
]

const SETTING_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Security:      Lock,
  Notifications: Bell,
  Platform:      Globe,
  Data:          Database,
  'Danger Zone': AlertTriangle,
}

function SystemSettingsTab() {
  const [settings, setSettings] = React.useState<SystemSetting[]>(INITIAL_SYSTEM_SETTINGS)
  const [saved, setSaved]       = React.useState(false)

  const categories = Array.from(new Set(settings.map(s => s.category)))

  function toggle(id: string) {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, value: !s.value } : s))
    setSaved(false)
  }

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">System Settings</h2>
          <p className="text-sm text-slate-500 mt-0.5">Platform-wide configuration — changes apply to all users.</p>
        </div>
        <button
          type="button"
          onClick={save}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
            saved
              ? 'bg-green-600 text-white'
              : 'bg-[#0a192f] text-white hover:bg-slate-800',
          )}
        >
          {saved ? <><CheckCircle2 className="size-4" /> Saved</> : <><RefreshCw className="size-4" /> Save Changes</>}
        </button>
      </div>

      {categories.map(cat => {
        const catSettings = settings.filter(s => s.category === cat)
        const Icon = SETTING_ICONS[cat] ?? Settings2
        const isDanger = cat === 'Danger Zone'

        return (
          <div key={cat} className={cn('rounded-xl border shadow-sm overflow-hidden', isDanger ? 'border-red-200' : 'border-slate-200')}>
            {/* Category header */}
            <div className={cn('flex items-center gap-3 px-5 py-3.5 border-b', isDanger ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100')}>
              <Icon className={cn('size-4', isDanger ? 'text-red-500' : 'text-slate-500')} />
              <p className={cn('text-sm font-semibold', isDanger ? 'text-red-700' : 'text-slate-700')}>{cat}</p>
              {isDanger && <span className="ml-auto text-xs text-red-500 font-medium">Changes here are irreversible</span>}
            </div>

            {/* Settings */}
            <div className="bg-white divide-y divide-slate-100">
              {catSettings.map(s => (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center justify-between gap-4 px-5 py-4',
                    s.danger && s.value && 'bg-red-50/60',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', s.danger ? 'text-red-700' : 'text-slate-900')}>{s.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.value}
                    aria-label={s.label}
                    onClick={() => toggle(s.id)}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                      s.value
                        ? s.danger ? 'bg-red-500' : 'bg-[#0a192f]'
                        : 'bg-slate-200',
                    )}
                  >
                    <span className={cn('pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', s.value ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN ADMIN CONSOLE
// ─────────────────────────────────────────────────────────────

export interface AdminConsoleProps {
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

export function AdminConsole(props: AdminConsoleProps) {
  const [tab, setTab] = React.useState<AdminTab>('users')

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      {/* ── Sidebar nav ── */}
      <aside className="lg:w-56 shrink-0 lg:min-h-screen bg-white border-b lg:border-b-0 lg:border-r border-slate-200">
        <div className="sticky top-0 flex lg:flex-col gap-1 p-3 overflow-x-auto lg:overflow-visible">
          <div className="hidden lg:block px-3 py-3 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Admin Console</p>
          </div>
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a192f]/40',
                  active
                    ? 'bg-[#0a192f] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="size-4 shrink-0" />
                <span>{t.label}</span>
                {t.badge !== undefined && (
                  <span className={cn(
                    'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                  )}>
                    {t.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Content area ── */}
      <main className="flex-1 min-w-0 p-4 lg:p-6">
        {tab === 'users' && (
          <UsersRolesPage
            users={props.users}
            totalCount={props.totalCount}
            currentPage={props.currentPage}
            pageSize={props.pageSize}
            onInvite={props.onInvite}
            onUpdateRole={props.onUpdateRole}
            onToggleStatus={props.onToggleStatus}
            onDelete={props.onDelete}
            isLoading={props.isLoading}
          />
        )}
        {tab === 'roles'  && <div className="max-w-4xl"><RolesTab /></div>}
        {tab === 'teams'  && <div className="max-w-5xl"><TeamsTab /></div>}
        {tab === 'audit'  && <div className="max-w-6xl"><AuditLogTab /></div>}
        {tab === 'system' && <div className="max-w-3xl"><SystemSettingsTab /></div>}
      </main>
    </div>
  )
}
