/**
 * Pure routing decisions for authenticated areas.
 *
 * These functions contain the ENTIRE routing matrix for the dashboard, admin
 * and field layouts. The layouts do no role comparison of their own — they
 * resolve the session state, call the matching function here, and act on the
 * returned decision.
 *
 * Keeping the matrix in one pure, dependency-free module means the unit tests
 * exercise the exact code the layouts run, instead of a test-local copy that
 * can drift from production behaviour.
 *
 * NOTE: no server-only imports — this module is pure data in / data out.
 */

import { isPlatformAdminRole, isWriterRole } from '@/lib/auth/roles'
import type { SessionResolution } from '@/lib/auth/resolve-session'
import type { ActorResolution } from '@/lib/auth/actor'

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

export type DashboardDecision =
  | { action: 'redirect'; to: '/auth/login' | '/client' | '/portal' }
  | { action: 'render-setup-incomplete'; email: string }
  | { action: 'render-dashboard' }

/**
 * unauthenticated → login
 * unprovisioned   → account-setup screen (NOT login: the user is already
 *                   authenticated, so a login redirect would loop)
 * client_viewer   → client portal
 * subcontractor   → subcontractor portal
 * otherwise       → dashboard
 */
export function dashboardDecision(state: SessionResolution): DashboardDecision {
  if (state.kind === 'unauthenticated') {
    return { action: 'redirect', to: '/auth/login' }
  }

  if (state.kind === 'unprovisioned') {
    return { action: 'render-setup-incomplete', email: state.email }
  }

  if (state.session.roles.includes('client_viewer')) {
    return { action: 'redirect', to: '/client' }
  }

  if (state.session.roles.includes('subcontractor')) {
    return { action: 'redirect', to: '/portal' }
  }

  return { action: 'render-dashboard' }
}

// ─────────────────────────────────────────────────────────────
// Admin console
// ─────────────────────────────────────────────────────────────

export type AdminDecision =
  | { action: 'redirect'; to: '/auth/login' | '/dashboard' }
  | { action: 'render-admin' }

/**
 * unauthenticated       → login
 * any other invalid     → dashboard (which renders the setup screen; sending an
 *                         authenticated user back to login would loop)
 * not a platform admin  → dashboard
 * platform admin        → admin console
 *
 * Admin authority comes from the canonical PLATFORM_ADMIN_ROLES group; this
 * module keeps no local admin list.
 */
export function adminDecision(state: ActorResolution): AdminDecision {
  if (state.kind === 'invalid') {
    return state.reason === 'not_authenticated'
      ? { action: 'redirect', to: '/auth/login' }
      : { action: 'redirect', to: '/dashboard' }
  }

  return isPlatformAdminRole(state.actor.role)
    ? { action: 'render-admin' }
    : { action: 'redirect', to: '/dashboard' }
}

// ─────────────────────────────────────────────────────────────
// Field mode
// ─────────────────────────────────────────────────────────────

export type FieldDecision =
  | { action: 'redirect'; to: '/auth/login' | '/dashboard' | '/client' | '/portal' }
  | { action: 'render-field' }

/**
 * unauthenticated → login
 * unprovisioned   → dashboard, which renders the account-setup screen without
 *                   creating a session (login would loop)
 * client_viewer   → client portal
 * subcontractor   → subcontractor portal
 * non-writer      → dashboard (field mode is a write surface)
 * writer          → field shell
 *
 * Field access is decided by the exhaustive writer classification, not by a
 * separately maintained blocked-role list. The previous implementation blocked
 * a phantom `client_pmc` role that is not in the canonical vocabulary, while
 * letting `viewer` — a real read-only role — into a write surface.
 */
export function fieldDecision(state: SessionResolution): FieldDecision {
  if (state.kind === 'unauthenticated') {
    return { action: 'redirect', to: '/auth/login' }
  }

  if (state.kind === 'unprovisioned') {
    return { action: 'redirect', to: '/dashboard' }
  }

  const role = state.session.roles[0]

  if (role === 'client_viewer') return { action: 'redirect', to: '/client' }
  if (role === 'subcontractor') return { action: 'redirect', to: '/portal' }

  return isWriterRole(role)
    ? { action: 'render-field' }
    : { action: 'redirect', to: '/dashboard' }
}
