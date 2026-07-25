/**
 * The DATABASE role vocabulary — single source of truth for `profiles.role`.
 *
 * These values mirror the Postgres `public.user_role` enum EXACTLY. A value
 * outside this list cannot be stored; writing one raises Postgres 22P02
 * (invalid input value for enum).
 *
 * ── Do not confuse this with `AppRole` in `lib/session.ts` ──
 * The app deliberately runs TWO role vocabularies:
 *   • DbUserRole (here)         — what is persisted on `profiles.role`.
 *   • AppRole (lib/session.ts)  — the wider presentation/permission vocabulary
 *                                 that `lib/auth/resolve-session.ts` maps onto.
 * Screens that READ permissions use AppRole. Screens that WRITE `profiles.role`
 * (i.e. admin user management, invites) MUST use DbUserRole, or the write fails.
 *
 * To re-verify against the live database:
 *   SELECT unnest(enum_range(NULL::public.user_role));
 *
 * NOTE: imported by client components — keep free of server-only imports.
 */

export const DB_USER_ROLES = [
  'system_admin',
  'tenant_admin',
  'project_director',
  'project_manager',
  'engineer',
  'hse_manager',
  'commissioning_manager',
  'finance_manager',
  'commercial_manager',
  'viewer',
] as const

export type DbUserRole = (typeof DB_USER_ROLES)[number]

/** Runtime guard — use before writing any caller-supplied role to the DB. */
export function isDbUserRole(value: unknown): value is DbUserRole {
  return typeof value === 'string' && (DB_USER_ROLES as readonly string[]).includes(value)
}

/** Roles that carry tenant-wide administrative authority. */
export const DB_ADMIN_ROLES: readonly DbUserRole[] = [
  'system_admin',
  'tenant_admin',
  'project_director',
]

export interface DbRoleMeta {
  label: string
  /** badge: bg + text + border */
  badge: string
  /** avatar: bg + text */
  avatar: string
  description: string
  permissions: string[]
}

export const DB_ROLE_META: Record<DbUserRole, DbRoleMeta> = {
  system_admin: {
    label: 'System Admin',
    badge: 'bg-red-100 text-red-700 border-red-200',
    avatar: 'bg-red-200 text-red-800',
    description: 'Full platform access across every tenant.',
    permissions: ['All modules', 'Tenant management', 'User management', 'System configuration', 'Audit logs'],
  },
  tenant_admin: {
    label: 'Tenant Admin',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    avatar: 'bg-blue-200 text-blue-800',
    description: 'Organisation-level admin managing users and settings.',
    permissions: ['User management', 'Settings', 'All modules', 'Reports', 'Approvals'],
  },
  project_director: {
    label: 'Project Director',
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
    avatar: 'bg-sky-200 text-sky-800',
    description: 'Accountable for project delivery; chairs stage gates.',
    permissions: ['Portfolio view', 'Gate approval', 'Approvals', 'Reports', 'Project management'],
  },
  project_manager: {
    label: 'Project Manager',
    badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    avatar: 'bg-cyan-200 text-cyan-800',
    description: 'Manages individual projects end-to-end.',
    permissions: ['Project management', 'Schedule', 'Cost', 'Documents', 'Risk', 'HSE'],
  },
  engineer: {
    label: 'Engineer',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    avatar: 'bg-orange-200 text-orange-800',
    description: 'Delivers engineering scope, drawings, and technical review.',
    permissions: ['Engineering', 'Documents', 'RFIs', 'Packages', 'Inspections'],
  },
  hse_manager: {
    label: 'HSE Manager',
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
    avatar: 'bg-rose-200 text-rose-800',
    description: 'Manages health, safety, and environmental compliance.',
    permissions: ['HSE', 'Incidents', 'Work permits', 'Audits', 'Observations'],
  },
  commissioning_manager: {
    label: 'Commissioning Mgr',
    badge: 'bg-lime-100 text-lime-700 border-lime-200',
    avatar: 'bg-lime-200 text-lime-800',
    description: 'Leads system commissioning and handover activities.',
    permissions: ['Commissioning', 'Test packs', 'Punch lists', 'Handover'],
  },
  finance_manager: {
    label: 'Finance Manager',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    avatar: 'bg-emerald-200 text-emerald-800',
    description: 'Controls budgets, cost tracking, and payment certification.',
    permissions: ['Finance', 'Cost control', 'Cash flow', 'Guarantees', 'Retention'],
  },
  commercial_manager: {
    label: 'Commercial Mgr',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    avatar: 'bg-amber-200 text-amber-800',
    description: 'Owns contracts, variations, and commercial claims.',
    permissions: ['Contracts', 'Variations', 'Claims', 'Procurement'],
  },
  viewer: {
    label: 'Viewer',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    avatar: 'bg-slate-200 text-slate-800',
    description: 'Read-only access to assigned projects.',
    permissions: ['Project view', 'Reports (read)', 'Documents (read)'],
  },
}

/** Options for a <Select>, in the order defined by DB_USER_ROLES. */
export const DB_ROLE_OPTIONS: { value: DbUserRole; label: string }[] = DB_USER_ROLES.map(
  (value) => ({ value, label: DB_ROLE_META[value].label }),
)

/**
 * Metadata for any role string, including unknown/legacy values, so the UI
 * degrades to a readable label instead of silently mislabelling the row.
 */
export function dbRoleMeta(role: string | null | undefined): DbRoleMeta {
  if (isDbUserRole(role)) return DB_ROLE_META[role]
  return {
    label: role
      ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Unknown',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    avatar: 'bg-slate-200 text-slate-700',
    description: 'Unrecognised role — not part of the user_role enum.',
    permissions: [],
  }
}
