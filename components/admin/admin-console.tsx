'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { UsersRolesPage } from '@/components/admin/users-roles-page'
import type { UserProfile, UserRole } from '@/components/admin/users-roles-page'
import { AuditTrail } from '@/components/notifications/audit-trail'
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

// Real roles are managed via Users & Roles page (UsersRolesPage component)
// No mock roles — role configuration routes to dedicated admin page

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
  return (
    <div className="flex flex-col gap-4 items-center justify-center py-16">
      <Shield className="size-12 text-muted-foreground/40" aria-hidden />
      <div className="text-center">
        <h3 className="font-semibold text-foreground">Roles are managed in the Users page</h3>
        <p className="text-sm text-muted-foreground mt-1">Go to the "Users" tab to configure roles and permissions.</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TEAMS TAB
// ─────────────────────────────────────────────────────────────

interface TeamMember { id: string; name: string; role: string; initials: string; color: string }
interface Team { id: string; name: string; department: string; lead: string; memberCount: number; color: string; members: TeamMember[] }

// Real teams are managed via Users & Roles page
// No mock teams — team configuration routes to dedicated admin page

function TeamsTab() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center py-16">
      <UsersRound className="size-12 text-muted-foreground/40" aria-hidden />
      <div className="text-center">
        <h3 className="font-semibold text-foreground">Teams are managed in the Users page</h3>
        <p className="text-sm text-muted-foreground mt-1">Go to the "Users" tab to organize team members and assign roles.</p>
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

// Real audit log records fetched from database via AuditTrail component — no mock fixtures

const SEVERITY_META = {
  info:    { dot: 'bg-blue-500',  row: '' },
  warning: { dot: 'bg-amber-500', row: 'bg-amber-50/50' },
  danger:  { dot: 'bg-red-500',   row: 'bg-red-50/40' },
}

function AuditLogTab() {
  return (
    <div className="h-[600px] flex flex-col">
      <AuditTrail />
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
