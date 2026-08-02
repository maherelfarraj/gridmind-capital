/**
 * Single source of truth for turning a profile row into the Active/Inactive
 * state the admin table renders.
 *
 * This exists because the mapping was previously written inline as
 * `department === 'Deactivated' ? 'inactive' : 'active'`. That predicate keyed
 * off a free-text marker left over from an older lossy soft-delete which the
 * canonical provisioning service no longer writes — and which no production
 * row carries. The result was that every user rendered as Active regardless of
 * `profiles.is_active`, so a successful deactivation still appeared to revert
 * on refresh. Keeping the rule in one tested place stops that reappearing.
 */
export type UserStatus = 'active' | 'inactive'

/**
 * Derive display status from the authorization flag itself.
 *
 * Anything that is not explicitly `true` is treated as inactive: an absent or
 * unreadable flag must never render a deactivated account as Active, because
 * that is the failure mode that hid this bug in the first place.
 */
export function statusFromProfile(profile: { is_active?: boolean | null }): UserStatus {
  return profile.is_active === true ? 'active' : 'inactive'
}
