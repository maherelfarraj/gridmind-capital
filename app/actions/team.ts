'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActor, getTaskComments, getStaffingRadar } from '@/lib/db/queries'
import type { StaffingRadar } from '@/lib/db/queries'
import { requireUser, requireInternalRole } from '@/lib/guards'

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
 * Write an attributed row to `audit_log`.
 *
 * The table is `audit_log` (SINGULAR) — the old `audit_logs` inserts targeted a
 * table that does not exist, so every one of these audit trails silently wrote
 * nothing. Column names differ too: table_name/record_id/changed_by/
 * old_values/new_values (NOT entity_type/entity_id/actor_id/old_data/new_data).
 *
 * `action` is constrained by `audit_log_action_check` to insert|update|delete,
 * so the domain verb ("assign", "unassign", …) is preserved under new_values.op
 * rather than being crammed into `action` (which would fail with 23514).
 *
 * A DB trigger also audits some tables, but with `changed_by = NULL` because the
 * admin client bypasses auth.uid(). These app-level rows supply the actor.
 * The error is always logged — a discarded audit error is how a whole trail
 * goes missing unnoticed.
 */
async function logAudit(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    tenantId: string | null
    tableName: string
    recordId: string
    action: 'insert' | 'update' | 'delete'
    actorId: string | null
    op?: string
    oldValues?: Record<string, unknown> | null
    newValues?: Record<string, unknown> | null
  },
) {
  const withOp = (v: Record<string, unknown> | null | undefined) =>
    v == null ? (args.op ? { op: args.op } : null) : args.op ? { op: args.op, ...v } : v

  const { error } = await admin.from('audit_log').insert({
    tenant_id: args.tenantId,
    table_name: args.tableName,
    record_id: args.recordId,
    action: args.action,
    changed_by: args.actorId,
    old_values: args.oldValues ?? null,
    new_values: withOp(args.newValues),
  })
  if (error) {
    console.log(`[v0] logAudit(${args.tableName}/${args.action}) failed:`, error.message)
  }
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
  try {
    await requireUser()
  } catch (e: any) {
    return { error: e.message }
  }
  
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

  await logAudit(admin, {
    tenantId: actor.tenantId,
    tableName: 'project_team',
    recordId: projectId,
    action: 'insert',
    actorId: actor.userId,
    op: 'assign',
    newValues: { project_id: projectId, role_id: roleId, person_id: personId },
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
  const session = await requireUser()
  
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

  await logAudit(admin, {
    tenantId: actor.tenantId,
    tableName: 'project_team',
    recordId: projectId,
    action: 'delete',
    actorId: actor.userId,
    op: 'unassign',
    oldValues: { project_id: projectId, role_id: roleId },
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
  const session = await requireUser()
  
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
  try {
    await requireUser()
  } catch (e: any) {
    return { error: e.message }
  }
  
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
  try {
    await requireUser()
  } catch (e: any) {
    return { error: e.message }
  }
  
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
  try {
    await requireUser()
  } catch (e: any) {
    return { error: e.message }
  }
  
  const { phaseGateId, projectId } = input
  if (!phaseGateId) return { error: 'Missing gate id.' }

  const actor = await getActor()
  const admin = createAdminClient()

  // Verify this gate IS the project's current active gate (prevent approving a stale gate)
  const { data: projectRow, error: projectErr } = await admin
    .from('projects')
    .select('current_phase')
    .eq('id', projectId)
    .single()

  if (projectErr) return { error: `Could not load project: ${projectErr.message}` }
  if (!projectRow) return { error: 'Project not found' }

  const { data: gateRow, error: gateErr } = await admin
    .from('phase_gates')
    .select('id, phase_number, status')
    .eq('id', phaseGateId)
    .maybeSingle()

  if (gateErr) return { error: `Could not find gate: ${gateErr.message}` }
  if (!gateRow) return { error: 'Gate not found.' }
  
  // Verify the gate is the current active gate (phase_number = current_phase + 1)
  // Active gate is the first non-approved gate (phase_number = current_phase + 1; G0 phase_number=0 when current_phase=0 are locked, phase_number=1 is active when current_phase=0)
  if (gateRow.phase_number !== projectRow.current_phase + 1) {
    return { error: 'This is not the project\'s current active gate' }
  }

  // Verify all sign-offs are signed before advancing
  const { data: unsignedSignoffs, error: soErr } = await admin
    .from('gate_signoffs')
    .select('id')
    .eq('phase_gate_id', phaseGateId)
    .neq('status', 'signed')
    .limit(1)

  if (soErr) return { error: `Could not verify sign-offs: ${soErr.message}` }
  if (unsignedSignoffs && unsignedSignoffs.length > 0) {
    return { error: 'All sign-offs must be completed before this gate can be approved.' }
  }

  // Record the gate approval decision
  await logEvent(admin, {
    transition: 'GATE_APPROVE',
    actorId: actor.userId,
    projectId,
    metadata: { phase_gate_id: phaseGateId },
  })

  // Advance the project: mark current gate 'approved', next gate 'in_review',
  // update projects.current_phase. This is the single authority for gate state.
  const { advanceProjectGate } = await import('@/app/actions/phase-gates')
  const advanceRes = await advanceProjectGate(projectId)

  if (advanceRes.error) {
    return { error: `Gate approval verified, but advancement failed: ${advanceRes.error}` }
  }

  revalidatePath('/team/gates')
  // 'layout' so every nested gate route (/projects/:id/g1, /g2, …) revalidates
  // too — a plain revalidatePath matches only the exact path, which would leave
  // the gate sub-pages serving a cached stepper.
  revalidatePath(`/projects/${projectId}`, 'layout')
  revalidatePath('/projects')
  revalidatePath('/dashboard')

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
  const session = await requireUser()
  
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

  await logAudit(admin, {
    tenantId: actor.tenantId,
    tableName: 'tasks',
    recordId: created.id,
    action: 'insert',
    actorId: actor.userId,
    newValues: { title: title.trim(), assignee_role_id: roleId, assignee_person_id: personId, deliverable_id: input.deliverableId || null },
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
  const session = await requireUser()
  
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

  await logAudit(admin, {
    tenantId: actor.tenantId,
    tableName: 'tasks',
    recordId: taskId,
    action: 'update',
    actorId: actor.userId,
    oldValues: prior ? { status: prior.status } : null,
    newValues: { status },
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
  const session = await requireUser()
  
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
  try {
    await requireUser()
  } catch (e: any) {
    return { error: e.message }
  }
  
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
  try {
    await requireUser()
  } catch (e: any) {
    return { error: e.message }
  }
  
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
 * the assignment. Writes an audit_log row on every change. Catches the
 * one-Accountable partial-unique violation (23505 on
 * `one_accountable_per_deliverable`) and surfaces a friendly message so the UI
 * can roll back the optimistic update.
 */
export async function updateRaciCell(input: {
  deliverableId: string
  roleId: string
  letter: RaciLetterValue | null
}): Promise<ActionResult<{ letter: RaciLetterValue | null }>> {
  const session = await requireUser()
  
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

  await logAudit(admin, {
    tenantId: actor.tenantId,
    tableName: 'raci_assignments',
    recordId: deliverableId,
    // Clearing a cell deletes the row; setting one is an upsert.
    action: letter === null ? 'delete' : 'update',
    actorId: actor.userId,
    oldValues: oldData,
    newValues:
      letter === null ? null : { deliverable_id: deliverableId, role_id: roleId, letter },
  })

  revalidatePath('/team/raci')
  return { data: { letter } }
}

// ── Admin: Roles & Approval Flow (Phase 9) ───────────────────

/** Log an admin/config event (not tied to a project) to workflow_events. */
async function logAdminEvent(
  admin: ReturnType<typeof createAdminClient>,
  transition: string,
  actorId: string | null,
  metadata: Record<string, unknown>,
) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: null,
    to_state: null,
    transition_code: transition,
    actor_id: actorId,
    comment: null,
    metadata: { module: 'team_roles', ...metadata },
  })
}

/** Change a user's home role (Tab 1) with an audit_log old/new record. */
export async function changeUserHomeRole(input: {
  userId: string
  roleId: string | null
}): Promise<ActionResult> {
  try {
    await requireUser()
  } catch (e: any) {
    return { error: e.message }
  }
  
  const { userId, roleId } = input
  if (!userId) return { error: 'Missing user.' }

  const actor = await getActor()
  const admin = createAdminClient()

  const { data: prior } = await admin
    .from('profiles')
    .select('home_role_id')
    .eq('id', userId)
    .maybeSingle()

  const { error } = await admin.from('profiles').update({ home_role_id: roleId }).eq('id', userId)
  if (error) return { error: error.message }

  await logAudit(admin, {
    tenantId: actor.tenantId,
    tableName: 'profiles',
    recordId: userId,
    action: 'update',
    actorId: actor.userId,
    oldValues: { home_role_id: prior?.home_role_id ?? null },
    newValues: { home_role_id: roleId },
  })

  revalidatePath('/admin/roles-flow')
  return {}
}

/** Save a tenant-wide gate approver default (Tab 2). Logs to workflow_events. */
export async function saveGateApproverDefault(input: {
  gateNumber: number
  primaryRole: string
  secondaryRole: string | null
}): Promise<ActionResult> {
  await requireInternalRole(['tenant_admin', 'system_admin', 'project_director'])
  
  const { gateNumber, primaryRole, secondaryRole } = input
  if (!gateNumber || !primaryRole) return { error: 'Gate and primary approver are required.' }
  if (secondaryRole && secondaryRole === primaryRole) {
    return { error: 'Primary and secondary approvers must differ.' }
  }

  const actor = await getActor()
  const admin = createAdminClient()

  const { error } = await admin
    .from('gate_approver_defaults')
    .upsert(
      { gate_number: gateNumber, primary_role: primaryRole, secondary_role: secondaryRole },
      { onConflict: 'gate_number' },
    )
  if (error) return { error: error.message }

  await logAdminEvent(admin, 'GATE_APPROVER_DEFAULT', actor.userId, {
    gate_number: gateNumber,
    primary_role: primaryRole,
    secondary_role: secondaryRole,
  })

  revalidatePath('/admin/roles-flow')
  revalidatePath('/team/approvers')
  return {}
}

export interface RuleResult {
  code: string
  label: string
  status: 'pass' | 'fail' | 'error'
  count: number | null
  note: string
  details: unknown[]
  deepLink: string | null
}

const RULE_META: { code: string; fn: string; label: string; deepLink: string | null }[] = [
  { code: 'B1', fn: 'gm_rule_b1', label: 'Gate approvals are signed', deepLink: '/admin/signatures' },
  { code: 'B2', fn: 'gm_rule_b2', label: 'No PAC gate approved with open NCRs', deepLink: null },
  { code: 'B3', fn: 'gm_rule_b3', label: 'Executed VOs are approved & baselined', deepLink: null },
  { code: 'B4', fn: 'gm_rule_b4', label: 'No FAC gate with active guarantees', deepLink: null },
  { code: 'B5', fn: 'gm_rule_b5', label: 'RLS enabled on non-reference tables', deepLink: null },
  { code: 'B6', fn: 'gm_rule_b6', label: 'No self-approved approvals', deepLink: '/admin/audit' },
  { code: 'B7', fn: 'gm_rule_b7', label: 'Deliverables have write policies', deepLink: null },
  { code: 'B8', fn: 'gm_rule_b8', label: 'No draft client reports leaked to storage', deepLink: null },
  { code: 'B9', fn: 'gm_rule_b9', label: 'Paid milestones have paid_at & amount', deepLink: null },
  { code: 'B10', fn: 'gm_rule_b10', label: 'Recent changes are logged as events', deepLink: '/admin/audit' },
]

/**
 * Run all 10 governance health-check rules. Each rule is an isolated RPC call;
 * one failing/erroring query surfaces as a CHECK ERROR on that card only and
 * never breaks the others. The run itself is logged to workflow_events.
 */
export async function runRulesHealthCheck(): Promise<{ results: RuleResult[]; ranAt: string }> {
  const actor = await getActor()
  const admin = createAdminClient()

  const results: RuleResult[] = await Promise.all(
    RULE_META.map(async (meta): Promise<RuleResult> => {
      try {
        const { data, error } = await admin.rpc(meta.fn)
        if (error) throw new Error(error.message)
        const payload = (data ?? {}) as { ok?: boolean; count?: number; details?: unknown[]; note?: string }
        return {
          code: meta.code,
          label: meta.label,
          status: payload.ok ? 'pass' : 'fail',
          count: typeof payload.count === 'number' ? payload.count : null,
          note: payload.note ?? '',
          details: Array.isArray(payload.details) ? payload.details : [],
          deepLink: meta.deepLink,
        }
      } catch (e) {
        return {
          code: meta.code,
          label: meta.label,
          status: 'error',
          count: null,
          note: e instanceof Error ? e.message : 'Check failed to run.',
          details: [],
          deepLink: meta.deepLink,
        }
      }
    }),
  )

  const ranAt = new Date().toISOString()
  const passing = results.filter((r) => r.status === 'pass').length
  await logAdminEvent(admin, 'rules_health_check', actor.userId, {
    passing,
    total: results.length,
    ran_at: ranAt,
  })

  return { results, ranAt }
}
