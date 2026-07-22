'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ExternalRole = 'subcontractor' | 'client_viewer'

export interface ExternalUser {
  id: string
  email: string
  full_name: string
  role: ExternalRole
  organization_name: string
  last_active: string | null
  projects: { id: string; code: string; name: string; revoked: boolean }[]
}

export interface ExternalAccessGrant {
  id: string
  project_id: string
  project_code: string
  project_name: string
  organization_name: string
  granted_at: string
  revoked_at: string | null
  granted_by_name: string | null
}

// ─────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────

/** All external users (subcontractor | client_viewer) in the tenant. */
export async function getExternalUsers(): Promise<ExternalUser[]> {
  const admin = createAdminClient()

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name, role, last_active')
    .eq('tenant_id', DEMO_TENANT)
    .in('role', ['subcontractor', 'client_viewer'])
    .order('created_at', { ascending: false })

  if (!profiles?.length) return []

  const userIds = profiles.map((p) => p.id)

  const { data: grants } = await admin
    .from('external_access')
    .select('user_id, project_id, organization_name, revoked_at, projects(code, name)')
    .eq('tenant_id', DEMO_TENANT)
    .in('user_id', userIds)

  const grantsByUser = (grants ?? []).reduce<Record<string, typeof grants>>((acc, g) => {
    if (!acc[g.user_id]) acc[g.user_id] = []
    acc[g.user_id]!.push(g)
    return acc
  }, {})

  return profiles.map((p) => {
    const userGrants = grantsByUser[p.id] ?? []
    const firstGrant = userGrants.find((g) => !g.revoked_at) ?? userGrants[0]
    return {
      id: p.id,
      email: p.email ?? '',
      full_name: p.full_name ?? '',
      role: p.role as ExternalRole,
      organization_name: firstGrant?.organization_name ?? '',
      last_active: p.last_active ?? null,
      projects: userGrants.map((g) => ({
        id: g.project_id,
        code: (g.projects as { code: string; name: string } | null)?.code ?? '',
        name: (g.projects as { code: string; name: string } | null)?.name ?? '',
        revoked: g.revoked_at !== null,
      })),
    }
  })
}

/** Access grants for a single external user. */
export async function getExternalAccessGrants(userId: string): Promise<ExternalAccessGrant[]> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('external_access')
    .select('id, project_id, organization_name, granted_at, revoked_at, projects(code, name), profiles!granted_by(full_name)')
    .eq('tenant_id', DEMO_TENANT)
    .eq('user_id', userId)
    .order('granted_at', { ascending: false })

  return (data ?? []).map((g) => ({
    id: g.id,
    project_id: g.project_id,
    project_code: (g.projects as { code: string; name: string } | null)?.code ?? '',
    project_name: (g.projects as { code: string; name: string } | null)?.name ?? '',
    organization_name: g.organization_name,
    granted_at: g.granted_at,
    revoked_at: g.revoked_at ?? null,
    granted_by_name: (g.profiles as { full_name: string } | null)?.full_name ?? null,
  }))
}

// ─────────────────────────────────────────────────────────────
// Invite
// ─────────────────────────────────────────────────────────────

export interface InviteExternalUserArgs {
  email: string
  role: ExternalRole
  organizationName: string
  projectIds: string[]
  siteUrl: string
}

export interface InviteResult {
  userId?: string
  inviteLink?: string
  error?: string
  isExisting?: boolean
}

/**
 * Invite an external user:
 *  1. Check if a profile already exists.
 *  2. If not: call inviteUserByEmail (sends branded magic-link email if SMTP is set)
 *     and also generate an action link as a fallback for copy/share.
 *  3. Set/update the profile role + tenant.
 *  4. Create external_access grants for the specified projects.
 */
export async function inviteExternalUser(args: InviteExternalUserArgs): Promise<InviteResult> {
  const admin = createAdminClient()

  // Step 1 — check for existing profile.
  const { data: existing } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('email', args.email)
    .eq('tenant_id', DEMO_TENANT)
    .maybeSingle()

  let userId: string

  if (existing) {
    // User already exists — update their role and re-grant projects.
    userId = existing.id
    await admin.from('profiles').update({ role: args.role }).eq('id', userId)
  } else {
    // Step 2 — invite via Supabase Auth (sends magic link if SMTP configured).
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      args.email,
      {
        data: {
          role: args.role,
          tenant_id: DEMO_TENANT,
          organization_name: args.organizationName,
          full_name: '',
        },
        redirectTo: `${args.siteUrl}/auth/callback?next=/portal`,
      },
    )

    if (inviteErr || !inviteData?.user) {
      return { error: inviteErr?.message ?? 'Failed to invite user' }
    }
    userId = inviteData.user.id

    // Ensure the profile row exists (the handle_new_user trigger creates it,
    // but it may not have fired yet for an invite flow).
    await admin.from('profiles').upsert({
      id:               userId,
      tenant_id:        DEMO_TENANT,
      email:            args.email,
      full_name:        '',
      role:             args.role,
      is_active:        true,
    }, { onConflict: 'id', ignoreDuplicates: false })
  }

  // Step 3 — generate a fallback action link (copy/share if email not sent).
  let inviteLink: string | undefined
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: args.email,
    options: { redirectTo: `${args.siteUrl}/auth/callback?next=/portal` },
  })
  if (linkData?.properties?.action_link) {
    inviteLink = linkData.properties.action_link
  }

  // Step 4 — grant project access (upsert, revived if previously revoked).
  if (args.projectIds.length > 0) {
    await admin.from('external_access').upsert(
      args.projectIds.map((pid) => ({
        tenant_id:         DEMO_TENANT,
        user_id:           userId,
        project_id:        pid,
        organization_name: args.organizationName,
        revoked_at:        null,
      })),
      { onConflict: 'user_id,project_id', ignoreDuplicates: false },
    )
  }

  revalidatePath('/admin/users')
  return { userId, inviteLink, isExisting: !!existing }
}

// ─────────────────────────────────────────────────────────────
// Grant / Revoke
// ─────────────────────────────────────────────────────────────

export async function assignProjectAccess(args: {
  userId: string
  projectId: string
  organizationName: string
}): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('external_access').upsert({
    tenant_id:         DEMO_TENANT,
    user_id:           args.userId,
    project_id:        args.projectId,
    organization_name: args.organizationName,
    revoked_at:        null,
  }, { onConflict: 'user_id,project_id', ignoreDuplicates: false })

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return {}
}

export async function revokeProjectAccess(args: {
  userId: string
  projectId: string
}): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('external_access')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', args.userId)
    .eq('project_id', args.projectId)
    .eq('tenant_id', DEMO_TENANT)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return {}
}

export async function revokeAllAccess(userId: string): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin
    .from('external_access')
    .update({ revoked_at: now })
    .eq('user_id', userId)
    .eq('tenant_id', DEMO_TENANT)
    .is('revoked_at', null)

  if (error) return { error: error.message }
  // Also deactivate the profile role so the user can't log in to internal pages.
  await admin
    .from('profiles')
    .update({ role: 'viewer', is_active: false })
    .eq('id', userId)
    .eq('tenant_id', DEMO_TENANT)

  revalidatePath('/admin/users')
  return {}
}

// ─────────────────────────────────────────────────────────────
// Visibility toggles
// ─────────────────────────────────────────────────────────────

export async function toggleDocumentVisibility(
  documentId: string,
  visibleToClient: boolean,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('documents')
    .update({ visible_to_client: visibleToClient })
    .eq('id', documentId)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return {}
}

export async function toggleWorkPackageVisibility(
  id: string,
  visibleToClient: boolean,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('work_packages')
    .update({ visible_to_client: visibleToClient })
    .eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function toggleEngineeringPackageVisibility(
  id: string,
  visibleToClient: boolean,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('engineering_packages')
    .update({ visible_to_client: visibleToClient })
    .eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function toggleVoClientVisible(
  voId: string,
  clientVisible: boolean,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('variation_orders')
    .update({ client_visible: clientVisible })
    .eq('id', voId)
  if (error) return { error: error.message }
  revalidatePath('/commercial/variations')
  return {}
}

export async function toggleMilestoneClientVisible(
  milestoneId: string,
  clientVisible: boolean,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('payment_milestones')
    .update({ client_visible: clientVisible })
    .eq('id', milestoneId)
  if (error) return { error: error.message }
  return {}
}
