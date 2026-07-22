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

// ── Gate sign-off lifecycle (Phase 4) ────────────────────────

/**
 * Move a gate into review. The DB trigger `spawn_gate_signoffs` then
 * creates one gate_signoff + approval_item per template role, resolving
 * the assignee from project_team.
 */
export async function openGateReview(input: {
  phaseGateId: string
  projectId: string
}): Promise<ActionResult> {
  const { phaseGateId, projectId } = input
  if (!phaseGateId) return { error: 'Missing gate id.' }

  const actor = await getActor()
  const admin = createAdminClient()

  const { error } = await admin
    .from('phase_gates')
    .update({ status: 'in_review' })
    .eq('id', phaseGateId)
  if (error) return { error: error.message }

  await logEvent(admin, {
    transition: 'GATE_OPEN_REVIEW',
    actorId: actor.userId,
    projectId,
    metadata: { phase_gate_id: phaseGateId },
  })

  revalidatePath('/team/signoffs')
  return {}
}

/** Sign one sign-off row. Records the signer + timestamp. */
export async function signGate(input: {
  signoffId: string
  projectId: string
}): Promise<ActionResult> {
  const { signoffId, projectId } = input
  if (!signoffId) return { error: 'Missing sign-off id.' }

  const actor = await getActor()
  const admin = createAdminClient()

  // If the row has no assignee yet, the signer becomes the assignee.
  const { data: existing } = await admin
    .from('gate_signoffs')
    .select('person_id')
    .eq('id', signoffId)
    .single()

  const patch: Record<string, unknown> = {
    status: 'signed',
    signed_at: new Date().toISOString(),
  }
  if (existing && !existing.person_id && actor.userId) patch.person_id = actor.userId

  const { error } = await admin.from('gate_signoffs').update(patch).eq('id', signoffId)
  if (error) return { error: error.message }

  await logEvent(admin, {
    transition: 'GATE_SIGN',
    actorId: actor.userId,
    projectId,
    metadata: { signoff_id: signoffId },
  })

  revalidatePath('/team/signoffs')
  return {}
}

/** Undo a signature (revert to pending). */
export async function unsignGate(input: {
  signoffId: string
  projectId: string
}): Promise<ActionResult> {
  const { signoffId, projectId } = input
  if (!signoffId) return { error: 'Missing sign-off id.' }

  const actor = await getActor()
  const admin = createAdminClient()

  const { error } = await admin
    .from('gate_signoffs')
    .update({ status: 'pending', signed_at: null })
    .eq('id', signoffId)
  if (error) return { error: error.message }

  await logEvent(admin, {
    transition: 'GATE_UNSIGN',
    actorId: actor.userId,
    projectId,
    metadata: { signoff_id: signoffId },
  })

  revalidatePath('/team/signoffs')
  return {}
}

/**
 * Approve a gate. The DB trigger `enforce_gate_approval` blocks this
 * unless every sign-off is signed — we surface that as a clean error.
 */
export async function approveGate(input: {
  phaseGateId: string
  projectId: string
}): Promise<ActionResult> {
  const { phaseGateId, projectId } = input
  if (!phaseGateId) return { error: 'Missing gate id.' }

  const actor = await getActor()
  const admin = createAdminClient()

  const { error } = await admin
    .from('phase_gates')
    .update({ status: 'approved', reviewed_by: actor.userId, reviewed_at: new Date().toISOString() })
    .eq('id', phaseGateId)

  if (error) {
    // The enforce_gate_approval trigger raises when sign-offs are incomplete.
    const friendly = /sign|approv|pending/i.test(error.message)
      ? 'All sign-offs must be completed before this gate can be approved.'
      : error.message
    return { error: friendly }
  }

  await logEvent(admin, {
    transition: 'GATE_APPROVE',
    actorId: actor.userId,
    projectId,
    metadata: { phase_gate_id: phaseGateId },
  })

  revalidatePath('/team/signoffs')
  return {}
}
