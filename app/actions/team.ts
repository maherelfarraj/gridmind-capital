'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActor, getTaskComments, getStaffingRadar } from '@/lib/db/queries'
import type { StaffingRadar } from '@/lib/db/queries'

type ActionResult<T = void> = { data?: T; error?: string }

/** Client-callable loader for the Command Center staffing radar panel. */
export async function loadStaffingRadar(projectId: string): Promise<StaffingRadar | null> {
  if (!projectId) return null
  return getStaffingRadar(projectId)
}

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
  if (error) {
    if (error.code === '23505') return { error: 'That role is already assigned on this project.' }
    return { error: error.message }
  }

  await admin.from('audit_logs').insert({
    tenant_id: actor.tenantId,
    actor_id: actor.userId,
    action: 'assign',
    entity_type: 'project_team',
    entity_id: projectId,
    new_data: { project_id: projectId, role_id: roleId, person_id: personId },
  })

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

  await admin.from('audit_logs').insert({
    tenant_id: actor.tenantId,
    actor_id: actor.userId,
    action: 'unassign',
    entity_type: 'project_team',
    entity_id: projectId,
    old_data: { project_id: projectId, role_id: roleId },
  })

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

  revalidatePath('/team/gates')
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
    .select('person_id, phase_gate_id, role_id')
    .eq('id', signoffId)
    .single()

  const patch: Record<string, unknown> = {
    status: 'signed',
    signed_at: new Date().toISOString(),
  }
  if (existing && !existing.person_id && actor.userId) patch.person_id = actor.userId

  const { error } = await admin.from('gate_signoffs').update(patch).eq('id', signoffId)
  if (error) return { error: error.message }

  // Resolve the parallel approval_items inbox row for this gate+role.
  if (existing?.phase_gate_id && existing?.role_id) {
    await admin
      .from('approval_items')
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('phase_gate_id', existing.phase_gate_id)
      .eq('role_id', existing.role_id)
  }

  await logEvent(admin, {
    transition: 'GATE_SIGN',
    actorId: actor.userId,
    projectId,
    metadata: { signoff_id: signoffId },
  })

  revalidatePath('/team/gates')
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

  const { data: existing } = await admin
    .from('gate_signoffs')
    .select('phase_gate_id, role_id')
    .eq('id', signoffId)
    .single()

  const { error } = await admin
    .from('gate_signoffs')
    .update({ status: 'pending', signed_at: null })
    .eq('id', signoffId)
  if (error) return { error: error.message }

  // Re-open the parallel approval_items inbox row.
  if (existing?.phase_gate_id && existing?.role_id) {
    await admin
      .from('approval_items')
      .update({ status: 'pending', resolved_at: null })
      .eq('phase_gate_id', existing.phase_gate_id)
      .eq('role_id', existing.role_id)
  }

  await logEvent(admin, {
    transition: 'GATE_UNSIGN',
    actorId: actor.userId,
    projectId,
    metadata: { signoff_id: signoffId },
  })

  revalidatePath('/team/gates')
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

  revalidatePath('/team/gates')
  return {}
}

// ── Tasks (Phase 5) ──────────────────────────────────────────

const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done'] as const
const TASK_PRIORITIES = ['low', 'medium', 'high'] as const

export async function createTask(input: {
  projectId: string
  title: string
  description?: string
  assigneeRoleId?: string | null
  assigneePersonId?: string | null
  priority?: string
  dueDate?: string | null
  deliverableId?: string | null
}): Promise<ActionResult> {
  const { projectId, title } = input
  if (!projectId) return { error: 'Select a project first.' }
  if (!title?.trim()) return { error: 'Task title is required.' }

  const actor = await getActor()
  const admin = createAdminClient()

  const priority = TASK_PRIORITIES.includes(input.priority as never)
    ? input.priority
    : 'medium'

  // RACI smart-default: if a deliverable is picked and no explicit assignee was
  // supplied, derive the role from the deliverable's Responsible/Accountable
  // (letter IN 'R','A/R') and the person from that role's project_team seat.
  let roleId = input.assigneeRoleId || null
  let personId = input.assigneePersonId || null
  if (input.deliverableId && !roleId) {
    const { data: raci } = await admin
      .from('raci_assignments')
      .select('role_id, letter')
      .eq('deliverable_id', input.deliverableId)
      .in('letter', ['R', 'A/R'])
    // Prefer the Responsible; fall back to Accountable/Responsible.
    const chosen = raci?.find((r) => r.letter === 'R') ?? raci?.[0]
    if (chosen) {
      roleId = chosen.role_id as string
      if (!personId) {
        const { data: seat } = await admin
          .from('project_team')
          .select('person_id')
          .eq('project_id', projectId)
          .eq('role_id', roleId)
          .maybeSingle()
        if (seat?.person_id) personId = seat.person_id as string
      }
    }
  }

  const { data: created, error } = await admin
    .from('tasks')
    .insert({
      tenant_id: actor.tenantId,
      project_id: projectId,
      title: title.trim(),
      description: input.description?.trim() || null,
      assignee_role_id: roleId,
      assignee_person_id: personId,
      deliverable_id: input.deliverableId || null,
      priority,
      status: 'todo',
      due_date: input.dueDate || null,
      created_by: actor.userId,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await admin.from('audit_logs').insert({
    tenant_id: actor.tenantId,
    actor_id: actor.userId,
    action: 'create',
    entity_type: 'tasks',
    entity_id: created.id,
    new_data: { title: title.trim(), assignee_role_id: roleId, assignee_person_id: personId, deliverable_id: input.deliverableId || null },
  })

  await logEvent(admin, {
    transition: 'TASK_CREATE',
    actorId: actor.userId,
    projectId,
    metadata: { title: title.trim() },
  })

  revalidatePath('/team/tasks')
  return {}
}

export async function updateTaskStatus(input: {
  taskId: string
  status: string
  projectId: string
}): Promise<ActionResult> {
  const { taskId, status, projectId } = input
  if (!TASK_STATUSES.includes(status as never)) return { error: 'Invalid status.' }

  const actor = await getActor()
  const admin = createAdminClient()

  // Moving to "blocked" requires an explanatory comment to already exist.
  if (status === 'blocked') {
    const { count } = await admin
      .from('task_comments')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', taskId)
    if (!count) {
      return { error: 'Add a comment explaining the blocker before marking this task blocked.' }
    }
  }

  const { data: prior } = await admin.from('tasks').select('status').eq('id', taskId).maybeSingle()

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    completed_at: status === 'done' ? new Date().toISOString() : null,
  }
  const { error } = await admin.from('tasks').update(patch).eq('id', taskId)
  if (error) return { error: error.message }

  await admin.from('audit_logs').insert({
    tenant_id: actor.tenantId,
    actor_id: actor.userId,
    action: 'update',
    entity_type: 'tasks',
    entity_id: taskId,
    old_data: prior ? { status: prior.status } : null,
    new_data: { status },
  })

  await logEvent(admin, {
    transition: 'TASK_STATUS',
    actorId: actor.userId,
    projectId,
    metadata: { task_id: taskId, status },
  })

  revalidatePath('/team/tasks')
  return {}
}

/** Live RACI smart-default preview for the Assign/new-task UI. */
export async function resolveTaskSmartDefault(input: {
  projectId: string
  deliverableId: string
}): Promise<{ roleId: string | null; roleCode: string | null; personId: string | null; personName: string | null }> {
  const admin = createAdminClient()
  const { data: raci } = await admin
    .from('raci_assignments')
    .select('role_id, letter, roles(code)')
    .eq('deliverable_id', input.deliverableId)
    .in('letter', ['R', 'A/R'])
  const chosen = raci?.find((r) => r.letter === 'R') ?? raci?.[0]
  if (!chosen) return { roleId: null, roleCode: null, personId: null, personName: null }
  const roleId = chosen.role_id as string
  const roleCode = (chosen.roles as unknown as { code: string } | null)?.code ?? null
  const { data: seat } = await admin
    .from('project_team')
    .select('person_id, profiles(full_name)')
    .eq('project_id', input.projectId)
    .eq('role_id', roleId)
    .maybeSingle()
  return {
    roleId,
    roleCode,
    personId: (seat?.person_id as string) ?? null,
    personName: (seat?.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
  }
}

export async function listTaskComments(
  taskId: string,
): Promise<{ id: string; body: string; author_name: string | null; created_at: string }[]> {
  return getTaskComments(taskId)
}

export async function addTaskComment(input: {
  taskId: string
  body: string
  projectId: string
}): Promise<ActionResult> {
  const { taskId, body, projectId } = input
  if (!body?.trim()) return { error: 'Comment cannot be empty.' }

  const actor = await getActor()
  const admin = createAdminClient()

  const { error } = await admin.from('task_comments').insert({
    task_id: taskId,
    author_id: actor.userId,
    body: body.trim(),
  })
  if (error) return { error: error.message }

  await logEvent(admin, {
    transition: 'TASK_COMMENT',
    actorId: actor.userId,
    projectId,
    metadata: { task_id: taskId },
  })

  revalidatePath('/team/tasks')
  return {}
}

// ── Gate approver config (Phase 8) ───────────────────────────

/** Set (upsert) a per-project approver override for one gate. */
export async function setProjectGateApprover(input: {
  projectId: string
  gateNumber: number
  primaryRole: string
  secondaryRole?: string | null
}): Promise<ActionResult> {
  const { projectId, gateNumber, primaryRole } = input
  if (!projectId) return { error: 'Select a project first.' }
  if (!primaryRole) return { error: 'A primary approver role is required.' }

  const actor = await getActor()
  const admin = createAdminClient()

  const { error } = await admin.from('project_gate_approvers').upsert(
    {
      project_id: projectId,
      gate_number: gateNumber,
      primary_role: primaryRole,
      secondary_role: input.secondaryRole || null,
    },
    { onConflict: 'project_id,gate_number' },
  )
  if (error) return { error: error.message }

  await logEvent(admin, {
    transition: 'GATE_APPROVER_OVERRIDE',
    actorId: actor.userId,
    projectId,
    metadata: { gate_number: gateNumber, primary_role: primaryRole, secondary_role: input.secondaryRole || null },
  })

  revalidatePath('/team/approvers')
  return {}
}

/** Remove a per-project override so the gate reverts to the tenant default. */
export async function clearProjectGateApprover(input: {
  projectId: string
  gateNumber: number
}): Promise<ActionResult> {
  const { projectId, gateNumber } = input
  if (!projectId) return { error: 'Select a project first.' }

  const actor = await getActor()
  const admin = createAdminClient()

  const { error } = await admin
    .from('project_gate_approvers')
    .delete()
    .eq('project_id', projectId)
    .eq('gate_number', gateNumber)
  if (error) return { error: error.message }

  await logEvent(admin, {
    transition: 'GATE_APPROVER_RESET',
    actorId: actor.userId,
    projectId,
    metadata: { gate_number: gateNumber },
  })

  revalidatePath('/team/approvers')
  return {}
}

// ── RACI matrix editing (Phase 3) ────────────────────────────

type RaciLetterValue = 'R' | 'A/R' | 'C' | 'I'

/**
 * Set (or clear) a RACI cell for a deliverable × role. `letter: null` removes
 * the assignment. Writes an audit_logs row on every change. Catches the
 * one-Accountable partial-unique violation (23505 on
 * `one_accountable_per_deliverable`) and surfaces a friendly message so the UI
 * can roll back the optimistic update.
 */
export async function updateRaciCell(input: {
  deliverableId: string
  roleId: string
  letter: RaciLetterValue | null
}): Promise<ActionResult<{ letter: RaciLetterValue | null }>> {
  const { deliverableId, roleId, letter } = input
  if (!deliverableId || !roleId) return { error: 'Missing deliverable or role.' }

  const actor = await getActor()
  const admin = createAdminClient()

  // Capture prior state for the audit trail.
  const { data: existing } = await admin
    .from('raci_assignments')
    .select('id, letter')
    .eq('deliverable_id', deliverableId)
    .eq('role_id', roleId)
    .maybeSingle()

  const oldData = existing
    ? { deliverable_id: deliverableId, role_id: roleId, letter: existing.letter }
    : null

  if (letter === null) {
    if (existing) {
      const { error } = await admin.from('raci_assignments').delete().eq('id', existing.id)
      if (error) return { error: error.message }
    }
  } else {
    const { error } = await admin
      .from('raci_assignments')
      .upsert(
        { deliverable_id: deliverableId, role_id: roleId, letter },
        { onConflict: 'deliverable_id,role_id' },
      )
    if (error) {
      if (error.code === '23505' && /one_accountable/i.test(error.message)) {
        return { error: 'Deliverable already has an Accountable — reassign first.' }
      }
      return { error: error.message }
    }
  }

  await admin.from('audit_logs').insert({
    tenant_id: actor.tenantId,
    actor_id: actor.userId,
    action: 'update',
    entity_type: 'raci_assignments',
    entity_id: deliverableId,
    old_data: oldData,
    new_data:
      letter === null ? null : { deliverable_id: deliverableId, role_id: roleId, letter },
  })

  revalidatePath('/team/raci')
  return { data: { letter } }
}
