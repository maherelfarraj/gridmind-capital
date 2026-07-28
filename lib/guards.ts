'use server'

import { getActor } from '@/lib/db/queries'

/**
 * Guard: Require authenticated user session.
 * Throws error if no session or no profile.
 *
 * Use this at the start of every exported mutation to ensure:
 * 1. User is authenticated (session exists)
 * 2. User profile exists in the database
 * 3. User's identity and role are available for authorization checks
 */
export async function requireUser(): Promise<{ userId: string; profile: any }> {
  const actor = await getActor()
  
  if (!actor?.userId) {
    throw new Error('Unauthorized: User session required')
  }
  
  // getActor already validates profile exists, just return it
  return { userId: actor.userId, profile: actor }
}

/**
 * Guard: Require user with one of the specified internal roles.
 * Throws error if user role not in the allowed list.
 *
 * Use this for operations restricted to admins or staff:
 * - Allowed roles: 'system_admin', 'tenant_admin', 'staff', 'approver', etc.
 * - Never pass untrusted user-submitted role values
 * - This check is CUMULATIVE with requireUser()
 */
export async function requireInternalRole(allowed: string[]): Promise<{ userId: string; profile: any }> {
  const actor = await getActor()
  
  if (!actor?.userId) {
    throw new Error('Unauthorized: User session required')
  }
  
  if (!actor.role || !allowed.includes(actor.role)) {
    throw new Error(`Unauthorized: User role '${actor.role}' not in allowed list [${allowed.join(', ')}]`)
  }
  
  return { userId: actor.userId, profile: actor }
}

/**
 * Role whitelist from DB schema — use this to validate role arguments from callers.
 * Never accept system_admin or tenant_admin from untrusted input.
 */
export const WHITELISTED_EXTERNAL_ROLES = ['subcontractor', 'vendor'] as const

/**
 * Verify role argument is in the whitelist for external user invites.
 * Prevents callers from self-assigning admin roles.
 */
export const validateExternalRole = async (role: string): Promise<string> => {
  const valid = WHITELISTED_EXTERNAL_ROLES.includes(role as any)
  if (!valid) {
    throw new Error(`Invalid external role '${role}'. Allowed: ${WHITELISTED_EXTERNAL_ROLES.join(', ')}`)
  }
  return role
}
