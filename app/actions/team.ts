'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActor } from '@/lib/db/queries'

type ActionResult<T = void> = { data?: T; error?: string }

async function logEvent(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    transition: string
    actorId: string | null
    projectId: string
    comment?: string
    metadata?: Record<string, unknown>
  },
) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: null,
    to_state: null,
    transition_code: args.transition,
    actor_id: args.actorId,
    comment: args.comment ?? null,
    metadata: { module: 'team', project_id: args.projectId, ...(args.metadata ?? {}) },
  })
}

/**
 * Assign a person to a role on a project (idempotent via the
 * (project_id, role_id) unique constraint — upsert replaces the assignee).
 */
export async function assignRole(input: {
  projectId: string
  roleId: string
  personId: string
}): Promise<ActionResult> {
  const { projectId, roleId, personId } = input
  if (!projectId || !roleId || !personId) return { error: 'Missing required fields.' }

  const actor = await getActor()
  const admin = createAdminClient()

  const { error } = await admin
    .from('project_team')
    .upsert(
      {
        tenant_id: actor.tenantId,
        project_id: projectId,
        role_id: roleId,
        person_id: personId,
        assigned_by: actor.userId,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,role_id' },
    )
  if (error) return { error: error.message }

  await logEvent(admin, {
    transition: 'TEAM_ASSIGN',
    actorId: actor.userId,
    projectId,
    metadata: { role_id: roleId, person_id: personId },
  })

  revalidatePath('/team/staffing')
  revalidatePath('/team')
  return {}
}

/** Remove the assignee for a given role on a project. */
export async function unassignRole(input: {
  projectId: string
  roleId: string
}): Promise<ActionResult> {
  const { projectId, roleId } = input
  if (!projectId || !roleId) return { error: 'Missing required fields.' }

  const actor = await getActor()
  const admin = createAdminClient()

  const { error } = await admin
    .from('project_team')
    .delete()
    .eq('project_id', projectId)
    .eq('role_id', roleId)
  if (error) return { error: error.message }

  await logEvent(admin, {
    transition: 'TEAM_UNASSIGN',
    actorId: actor.userId,
    projectId,
    metadata: { role_id: roleId },
  })

  revalidatePath('/team/staffing')
  revalidatePath('/team')
  return {}
}
