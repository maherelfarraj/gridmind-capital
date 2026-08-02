import { DB_ADMIN_ROLES, DB_ROLE_META, type DbUserRole } from '@/lib/auth/roles'

/**
 * Builds the subtitle under the "Administrators" tile on /admin/users.
 *
 * The subtitle used to be the hardcoded string "Tenant + 2 PMO", which was
 * simply wrong: production has 2 tenant_admins and 0 system_admins, and there
 * is no "PMO" role at all. Because it was a literal, it could never track the
 * number rendered directly above it.
 *
 * The counts here are taken over exactly `DB_ADMIN_ROLES` — the same set the
 * tile's total is computed from — so the subtitle always sums to the displayed
 * figure. That set includes `project_director`, so a director is reported as
 * its own category rather than being silently absorbed into the total. There
 * are 0 in production today, which is why the current tile reads correctly
 * while still being unable to stay correct.
 *
 * Nothing here changes role definitions, authorization, or what counts as an
 * administrator; it only describes the existing count.
 */

/** Count of profiles per administrator-level role. */
export type AdminRoleCounts = Partial<Record<DbUserRole, number>>

/** Order the categories appear in. Most privileged last-listed role first. */
const SUMMARY_ORDER: readonly DbUserRole[] = ['tenant_admin', 'system_admin', 'project_director']

/** Separator between categories. Bidi-neutral, so it is safe under RTL. */
const SEPARATOR = ' · '

/** Shown when there are no administrators of any kind. */
const NO_ADMINISTRATORS = 'No administrators'

/**
 * Coerce a count to a usable non-negative integer.
 *
 * Guards against `undefined`, `NaN`, negatives and fractions so a bad input can
 * only ever under-report, never render something like "-1 Tenant Admins".
 */
function normalizeCount(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

/**
 * Pluralize a role label by count.
 *
 * The singular form is taken from `DB_ROLE_META` rather than duplicated here,
 * so renaming a role in one place cannot leave this tile showing a stale name.
 * All three administrator labels pluralize by appending "s"
 * (Tenant Admin → Tenant Admins, Project Director → Project Directors).
 */
function labelFor(role: DbUserRole, count: number): string {
  const singular = DB_ROLE_META[role]?.label ?? role
  return count === 1 ? singular : `${singular}s`
}

/**
 * Tally administrator roles from a list of users.
 *
 * Only roles in `DB_ADMIN_ROLES` are counted, matching the tile's existing
 * definition of an administrator.
 */
export function adminRoleCountsFromUsers(users: readonly { role: string }[]): AdminRoleCounts {
  const counts: AdminRoleCounts = {}
  for (const role of DB_ADMIN_ROLES) {
    const n = users.filter(u => u.role === role).length
    if (n > 0) counts[role] = n
  }
  return counts
}

/** Total administrators, i.e. the number the tile displays. */
export function totalAdministrators(counts: AdminRoleCounts): number {
  return DB_ADMIN_ROLES.reduce((sum, role) => sum + normalizeCount(counts[role]), 0)
}

/**
 * Format the administrator subtitle.
 *
 * Pure and deterministic: same counts in, same string out, with no reference to
 * any production-specific number. Categories with a zero count are omitted, so
 * the common single-category case stays short ("2 Tenant Admins").
 *
 * @example formatAdministratorSummary({ tenant_admin: 2 })                     // '2 Tenant Admins'
 * @example formatAdministratorSummary({ tenant_admin: 2, system_admin: 1 })    // '2 Tenant Admins · 1 System Admin'
 * @example formatAdministratorSummary({})                                      // 'No administrators'
 */
export function formatAdministratorSummary(counts: AdminRoleCounts): string {
  const parts = SUMMARY_ORDER
    .map(role => ({ role, count: normalizeCount(counts[role]) }))
    .filter(({ count }) => count > 0)
    .map(({ role, count }) => `${count} ${labelFor(role, count)}`)

  return parts.length === 0 ? NO_ADMINISTRATORS : parts.join(SEPARATOR)
}
