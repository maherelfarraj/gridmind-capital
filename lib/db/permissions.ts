/**
 * RBAC map: EPC delivery role code → the sidebar nav item ids that role may see.
 *
 * The delivery role comes from `profiles.home_role_id` (→ roles.code); platform
 * access (admin console visibility) comes from `profiles.role`. This file maps
 * only the DELIVERY role's menu scope. The roles themselves are DB-driven — this
 * is pure config, keyed by the canonical role codes.
 *
 * PD and PM see everything. '*' = all nav items.
 */

export type MenuScope = string[] | '*'

/** Nav item ids (mirrors components/app-shell/nav-config.ts). */
export const MENU_PERMISSIONS: Record<string, MenuScope> = {
  // Leadership — full visibility
  PD: '*',
  PM: '*',

  // Development / commercial origination
  DEV: ['dashboard', 'portfolio', 'opportunities', 'projects', 'documents', 'risks', 'esg', 'team'],
  PER: ['dashboard', 'projects', 'documents', 'risks', 'team'],
  GCM: ['dashboard', 'projects', 'engineering', 'documents', 'team'],

  // Engineering & design
  DM: ['dashboard', 'projects', 'engineering', 'documents', 'team'],
  BSE: ['dashboard', 'projects', 'engineering', 'commissioning', 'team'],
  ELE: ['dashboard', 'projects', 'engineering', 'team'],
  GSE: ['dashboard', 'projects', 'engineering', 'team'],
  SCE: ['dashboard', 'projects', 'engineering', 'commissioning', 'team'],

  // Procurement & construction
  PRC: ['dashboard', 'projects', 'procurement', 'commercial', 'team'],
  CM: ['dashboard', 'projects', 'construction', 'handover', 'team'],
  QAQC: ['dashboard', 'projects', 'construction', 'team'],
  HSE: ['dashboard', 'projects', 'construction', 'team'],

  // Commissioning & operations
  CXM: ['dashboard', 'projects', 'commissioning', 'handover', 'team'],
  OMM: ['dashboard', 'projects', 'om', 'handover', 'team'],

  // Support functions
  FIN: ['dashboard', 'portfolio', 'finance', 'commercial', 'team'],
  LEG: ['dashboard', 'projects', 'commercial', 'documents', 'team'],
  DCL: ['dashboard', 'projects', 'documents', 'team'],
}

/**
 * True if a delivery role code may see a given nav item id.
 *
 * FAIL-CLOSED. A null, undefined, or unrecognised role code grants nothing.
 * This is a presentation control rather than a server-side authorization gate,
 * but it must not invent visibility from malformed input: a helper that returns
 * `true` for an unknown role is an easy thing to later mistake for a real gate.
 */
export function canSeeMenu(roleCode: string | null | undefined, navItemId: string): boolean {
  if (!roleCode) return false
  const scope = MENU_PERMISSIONS[roleCode]
  if (!scope) return false
  if (scope === '*') return true
  return scope.includes(navItemId)
}

/** Platform-access roles that unlock the /admin area. */
export const ADMIN_PLATFORM_ROLES = ['system_admin', 'tenant_admin'] as const

export function isPlatformAdmin(platformRole: string | null | undefined): boolean {
  return !!platformRole && (ADMIN_PLATFORM_ROLES as readonly string[]).includes(platformRole)
}

/**
 * Roles allowed to perform team-management writes (staffing, assigning tasks,
 * editing RACI). Accepts EITHER a delivery role code (PD/PM) OR a platform role
 * (project_director/project_manager/*_admin).
 */
const TEAM_WRITE_ROLES = new Set<string>([
  'PD',
  'PM',
  'project_director',
  'project_manager',
  'system_admin',
  'tenant_admin',
])

/**
 * FAIL-CLOSED. A null, undefined, or unrecognised role grants no team-write
 * capability. The server actions that perform these writes enforce their own
 * guards; this helper only decides whether to offer the control.
 */
export function canWriteTeam(role: string | null | undefined): boolean {
  if (!role) return false
  return TEAM_WRITE_ROLES.has(role)
}
