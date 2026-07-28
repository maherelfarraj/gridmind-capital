'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter, requireApprover, getAuthActor, requireAssignedApprover, ADMIN_ROLES } from '@/lib/auth/guard'
import { requireUser, requireInternalRole } from '@/lib/guards'
import { DB_ADMIN_ROLES } from '@/lib/auth/roles'
import { sendApprovalRequestEmail, sendApprovalDecisionEmail } from '@/lib/email/send'
import type { ApprovalRecord } from '@/components/approvals/approval-inbox'
import { createSignature, type SignatureDraft } from '@/app/actions/signatures'

// profiles.role enum values that action approvals (used to resolve email recipients).
const APPROVER_ENUM_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'project_manager']
import { getCurrentTenantId } from '@/lib/tenant'

/** Resolve the active approver profiles (id + email + name) for a tenant. */
async function resolveApprovers(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
): Promise<{ id: string; email: string; name: string }[]> {
  const { data } = await admin
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', APPROVER_ENUM_ROLES)
  return (data ?? [])
    .filter((p) => p.email)
    .map((p) => ({ id: p.id, email: p.email as string, name: p.full_name ?? 'Approver' }))
}

/**
 * Resolve the approver seat occupant for a given role.
 * Falls back to tenant_admin if no profile has the role or the role has no active member.
 * Used by approval creation paths to set assignee_id before writing the approval row.
 */
async function resolveApproveeSeat(
  supabase: ReturnType<typeof createAdminClient>,
  tenantId: string,
  role: string | null | undefined,
): Promise<string> {
  if (!role) {
    // Fallback: assign to tenant_admin
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'tenant_admin')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    return data?.id ?? tenantId // Worst case: tenant_id itself (not ideal, but explicit)
  }

  // Look for an active profile with the specified role
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', role)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (data?.id) return data.id

  // Role exists but no seat is occupied — assign to tenant_admin
  const { data: admin } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'tenant_admin')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  return admin?.id ?? tenantId
}

/**
 * Create a multi-level approval workflow based on approval_rules.
 *
 * Reads the matching approval_rules row for the given object_type and amount.
 * Creates:
 * - One approvals row (status='pending')
 * - One approval_steps row per level (assigned from required_roles)
 * - approval_events: 'created' + 'assigned' (per level)
 *
 * Idempotent: returns early if a pending approval for object_id exists.
 */
export async function createApprovalWorkflow(
  objectType: string,
  objectId: string,
  title: string,
  amount: number | null,
): Promise<{ id: string; error?: string }> {
  try {
    const { userId } = await requireUser()
    
    const tenantId = await getCurrentTenantId()
    const supabase = createAdminClient()
    const createdBy = userId

    // Idempotent: skip if pending approval exists for this object
    const { data: existing } = await supabase
      .from('approvals')
      .select('id')
      .eq('object_id', objectId)
      .eq('object_type', objectType)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()
    if (existing) return { id: existing.id, error: 'Pending approval already exists for this object' }

    // Find matching approval_rule: object_type + amount within min/max, highest priority
    const { data: rule } = await supabase
      .from('approval_rules')
      .select('id, required_roles, approval_levels, min_amount, max_amount')
      .eq('object_type', objectType)
      .eq('is_active', true)
      .lte('min_amount', amount ?? 0)
      .gte('max_amount', amount ?? 0)
      .order('min_amount', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fallback if no exact rule match: use default tenant_admin rule
    let approvalLevels = 1
    let requiredRoles = ['tenant_admin']
    if (rule) {
      approvalLevels = rule.approval_levels ?? 1
      requiredRoles = rule.required_roles ?? ['tenant_admin']
    }

    // Resolve the first level approver (will be assigned_to on approvals.assignee_id)
    const firstLevelRole = requiredRoles[0] ?? 'tenant_admin'
    const firstLevelAssigneeId = await resolveApproveeSeat(supabase, tenantId, firstLevelRole)

    // Create approvals row with initial assignee = first level approver
    const { data: approval, error: apprErr } = await supabase
      .from('approvals')
      .insert({
        tenant_id: tenantId,
        object_type: objectType,
        object_id: objectId,
        title,
        status: 'pending',
        priority: 'normal',
        amount,
        requester_id: createdBy,
        assignee_id: firstLevelAssigneeId,
        rule_id: rule?.id,
      })
      .select('id')
      .single()

    if (apprErr || !approval) return { id: '', error: `Approval creation failed: ${apprErr?.message}` }

    // Create approval_steps (one per level)
    const stepRows = []
    for (let level = 1; level <= approvalLevels; level++) {
      const role = requiredRoles[level - 1] ?? 'tenant_admin'
      const assigneeId = await resolveApproveeSeat(supabase, tenantId, role)
      stepRows.push({
        approval_id: approval.id,
        level,
        assigned_to: assigneeId,
        status: 'pending',
      })
    }

    const { error: stepErr } = await supabase.from('approval_steps').insert(stepRows)
    if (stepErr) console.log(`[v0] approval_steps creation warning: ${stepErr.message}`)

    // Emit events: 'created' + 'assigned' per level
    const eventRows = [
      {
        approval_id: approval.id,
        actor_id: createdBy,
        event_type: 'created',
        metadata: { rule: rule?.id, levels: approvalLevels, amount },
      },
      ...stepRows.map((s) => ({
        approval_id: approval.id,
        actor_id: createdBy,
        event_type: 'assigned',
        metadata: { level: s.level, assigned_to: s.assigned_to },
      })),
    ]

    const { error: eventErr } = await supabase.from('approval_events').insert(eventRows)
    if (eventErr) console.log(`[v0] approval_events creation warning: ${eventErr.message}`)

    return { id: approval.id }
  } catch (e: any) {
    return { id: '', error: e.message }
  }
}

/**
 * Mark an approval condition as met, waived, or breached.
 * Only condition creator, assignee, or admin can update.
 */
export async function updateConditionStatus(
  conditionId: string,
  status: 'met' | 'waived',
): Promise<{ error?: string }> {
  const gate = await requireApprover()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  // Fetch condition to verify permissions
  const { data: condition } = await supabase
    .from('approval_conditions')
    .select('id, approval_id, created_by')
    .eq('id', conditionId)
    .single()

  if (!condition) return { error: 'Condition not found' }

  // Check authorization: creator, assignee, or admin
  const approval = await supabase
    .from('approvals')
    .select('assignee_id')
    .eq('id', condition.approval_id)
    .single()

  const isCreator = gate.actor.userId === condition.created_by
  const isAssignee = gate.actor.userId === approval.data?.assignee_id
  const isAdmin = ADMIN_ROLES.includes(gate.actor.role as typeof ADMIN_ROLES[number])

  if (!isCreator && !isAssignee && !isAdmin) {
    return { error: 'You are not authorized to update this condition' }
  }

  const { error } = await supabase
    .from('approval_conditions')
    .update({
      status,
      updated_at: new Date().toISOString(),
      updated_by: gate.actor.userId,
    })
    .eq('id', conditionId)

  if (error) return { error: error.message }

  // Emit condition_status_changed event
  const { error: eventErr } = await supabase.from('approval_events').insert({
    approval_id: condition.approval_id,
    actor_id: gate.actor.userId,
    event_type: 'condition_status_changed',
    metadata: { condition_id: conditionId, status },
  })
  if (eventErr) console.log(`[v0] Condition status event warning: ${eventErr.message}`)

  return {}
}

/**
 * Auto-breach conditions where due_date < today.
 * Called on-load or scheduled periodically.
 */
export async function autoBreachExpiredConditions(approvalId: string): Promise<void> {
  const supabase = createAdminClient()

  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const { error } = await supabase
    .from('approval_conditions')
    .update({
      status: 'breached',
      updated_at: new Date().toISOString(),
    })
    .eq('approval_id', approvalId)
    .eq('status', 'open')
    .lt('due_date', today)

  if (error) console.log(`[v0] Auto-breach warning: ${error.message}`)
}

/**
 * Fetch approval events with actor profile details for timeline display.
 * Includes created/assigned/decided/delegated/condition events.
 * Auto-breaches expired conditions before returning events.
 */
export async function getApprovalEvents(approvalId: string) {
  const supabase = createAdminClient()

  // Auto-breach any expired conditions before returning events
  await autoBreachExpiredConditions(approvalId)

  const { data: events } = await supabase
    .from('approval_events')
    .select(`
      id,
      event_type,
      metadata,
      created_at,
      actor_id,
      profiles!actor_id (
        id,
        full_name,
        email,
        role
      )
    `)
    .eq('approval_id', approvalId)
    .order('created_at', { ascending: true })

  if (!events) return []

  return events.map((e: any) => ({
    id: e.id,
    type: e.event_type,
    actorId: e.actor_id,
    actorName: e.profiles?.full_name || 'System',
    actorEmail: e.profiles?.email || null,
    actorRole: e.profiles?.role || 'Unknown',
    metadata: e.metadata as Record<string, unknown> | null,
    timestamp: e.created_at,
  }))
}

/**
 * Backfill decided_by for OPP-001 (known row with known PD).
 * Sets decided_by to ahmad@gsi.jo profile id (the approver).
 * Single-row attribution; everything else stays NULL (honest unknown).
 */
export async function backfillOPP001DecidedBy(): Promise<{ updated: number; error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { updated: 0, error: gate.error }

  const supabase = createAdminClient()

  // Find ahmad@gsi.jo profile id
  const { data: ahmad } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'ahmad@gsi.jo')
    .limit(1)
    .single()

  if (!ahmad) {
    return { updated: 0, error: 'Profile ahmad@gsi.jo not found' }
  }

  // Update OPP-001 approval decided_by
  const { error } = await supabase
    .from('approvals')
    .update({ decided_by: ahmad.id })
    .eq('object_id', (await supabase.from('projects').select('id').eq('code', 'OPP-001').single()).data?.id)
    .eq('status', 'approved')

  if (error) return { updated: 0, error: error.message }

  return { updated: 1 }
}

/**
 * Atomic project creation via RPC: inserts project (planning, phase 0) + 7 phase_gates (all pending)
 * + G0 approval (pending) in ONE TRANSACTION with automatic rollback on any failure.
 *
 * Called from createOpportunity and createProject after auth/roles are verified.
 * Replaces separate insert calls with guaranteed consistency.
 */
export async function createProjectGoverned(payload: {
  code: string
  name: string
  technology?: string
  capacity_mw?: number
  bess_mwh?: number
  location?: string
  country?: string
  target_completion?: string // ISO date
  project_manager?: string // UUID
  amount?: number
}): Promise<{ project_id?: string; approval_id?: string; error?: string }> {
  try {
    // Require admin role
    await requireInternalRole(['tenant_admin', 'system_admin', 'project_director'])
    
    // Derive tenant_id and created_by from session
    const tenantId = await getCurrentTenantId()
    const { userId } = await requireUser()
    
    const supabase = createAdminClient()

    // Build full payload with session-derived values
    const fullPayload = {
      tenant_id: tenantId,
      created_by: userId,
      ...payload,
    }

    // Call RPC function
    const { data, error } = await supabase.rpc('create_project_governed', {
      payload: JSON.stringify(fullPayload),
    })

  if (error || !data) {
    return { error: error?.message ?? 'RPC call failed' }
  }

  // Unwrap result from RPC
  const result = typeof data === 'string' ? JSON.parse(data) : data
    if (result.error) {
      return { error: result.error }
    }

    return {
      project_id: result.project_id,
      approval_id: result.approval_id,
    }
  } catch (e: any) {
    return { error: e.message }
  }
}

/**
 * Backfill migration events for existing approvals without events.
 * Creates one 'migrated' event per approval with created_at from approvals row.
 * Admin-only operation (run as part of deployment scripts).
 */
export async function backfillApprovalEvents(): Promise<{ migrated: number; error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { migrated: 0, error: gate.error }

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()

  // Find all approvals for this tenant
  const { data: allApprovals } = await supabase
    .from('approvals')
    .select('id, created_at, title')
    .eq('tenant_id', tenantId)

  if (!allApprovals || allApprovals.length === 0) {
    return { migrated: 0 }
  }

  // Find which already have events
  const { data: existingEventApprovals } = await supabase
    .from('approval_events')
    .select('approval_id')

  const existingIds = new Set(existingEventApprovals?.map((e) => e.approval_id) ?? [])

  // Get approvals that need migration
  const toMigrate = allApprovals.filter((a) => !existingIds.has(a.id))

  if (toMigrate.length === 0) {
    return { migrated: 0 }
  }

  // Create 'migrated' events with created_at = approvals.created_at
  const migrationEvents = toMigrate.map((a) => ({
    approval_id: a.id,
    actor_id: null, // No actor for pre-engine record
    event_type: 'migrated',
    metadata: { note: 'pre-engine record', title: a.title },
    created_at: a.created_at, // Use approval created_at for event timestamp
  }))

  const { error } = await supabase.from('approval_events').insert(migrationEvents)

  if (error) return { migrated: 0, error: error.message }

  return { migrated: toMigrate.length }
}

/**
 * Apply the project lifecycle transition implied by an approval decision.
 *
 * Acceptance — not submission — drives project status:
 *   approved → active     (the opportunity is accepted, work may begin)
 *   rejected → cancelled
 *   anything else (pending/hold/delegated) → no change
 *
 * `project_status` enum = planning | active | on_hold | completed | cancelled.
 *
 * This MUST stay shared. There are three separate server actions that write
 * `approvals.status` — `decideApproval` (desktop detail view),
 * `syncQueuedApproval` (mobile cards + offline queue) and
 * `updateApprovalStatus`. Putting the transition in only one of them is exactly
 * how "approve" appeared to succeed while the project silently stayed 'planning'.
 *
 * Returns an error string when the project write fails. There is no FK on
 * `approvals.object_id` (it is polymorphic across projects/documents/
 * payment_certificates), so a stale id cannot be caught by the database —
 * callers must surface this rather than report a clean decision.
 */
/**
 * Single source of truth for `decided_at`.
 *
 * ⚠️ THE THREE-WRITER TRAP — read before adding any field to `approvals`.
 * FOUR functions write `approvals.status`: decideApproval, delegateApproval,
 * syncQueuedApproval (mobile) and updateApprovalStatus. Every new column must be
 * written by ALL of them or the ones that forget silently produce wrong data.
 * This has now bitten us three times (project lifecycle, then decided_at, then
 * the delegate path below), so status writes go through this helper — spread it
 * into the update object and a new writer cannot forget the field.
 *
 * Returning `null` for non-terminal states is deliberate, not a no-op: it CLEARS
 * a stale timestamp when a decision is reopened (decideApproval's 'hold' maps to
 * 'pending') or handed off ('delegated'), so `decided_at IS NULL` always means
 * "no decision currently stands".
 *
 * NOTE: there is no `decided_by` column on `approvals` (verified against the live
 * schema — only `decided_at` and an unused `decision_note`). Recording WHO decided
 * needs a schema pass; until then attribution lives only in the description trail.
 */
function decisionStamp(
  status: 'approved' | 'rejected' | 'pending' | 'delegated',
): { decided_at: string | null } {
  const isTerminal = status === 'approved' || status === 'rejected'
  return { decided_at: isTerminal ? new Date().toISOString() : null }
}

async function applyApprovalLifecycle(
  supabase: ReturnType<typeof createAdminClient>,
  approval: { object_type?: string | null; object_id?: string | null } | null,
  status: 'approved' | 'rejected' | 'pending' | 'delegated',
): Promise<string | null> {
  if (!approval || approval.object_type !== 'opportunity' || !approval.object_id) return null

  const nextStatus = status === 'approved' ? 'active' : status === 'rejected' ? 'cancelled' : null
  if (!nextStatus) return null

  const { error } = await supabase
    .from('projects')
    .update({ status: nextStatus })
    .eq('id', approval.object_id)

  return error ? `Approval recorded, but project status update failed: ${error.message}` : null
}

/** Resolved visibility scope for one actor. */
interface ApprovalScope {
  tenantId: string | null
  dbRole: string
  isAdmin: boolean
  /** `null` = no object_type restriction (admin). `[]` = routes to nothing. */
  allowedObjectTypes: string[] | null
}

/**
 * Resolve WHICH approvals the current actor may see. Shared by the inbox list
 * (`getApprovals`) and the KPI/chart aggregates (`loadApprovalsDashboard`) so the
 * two can never drift apart again.
 *
 * They previously drifted: the list was role-scoped while the counters were not,
 * so a non-admin saw "3 PENDING" cards and chart bars above an "All caught up"
 * list. That self-contradiction is ALSO the signature of a swallowed query error,
 * so keeping these in one place preserves the diagnostic.
 *
 * @throws if the routing lookup fails — never returns "sees nothing" on error.
 */
async function resolveApprovalScope(
  supabase: ReturnType<typeof createAdminClient>,
  context: string,
): Promise<ApprovalScope | { error: string }> {
  const auth = await getAuthActor()
  if ('error' in auth) return { error: auth.error }

  const dbRole = auth.actor.role
  // `actor.tenantId` is nullable; fall back to the documented tenant resolver.
  const tenantId = auth.actor.tenantId ?? (await getCurrentTenantId())
  const isAdmin = (DB_ADMIN_ROLES as readonly string[]).includes(dbRole)

  // Admins are intentionally tenant-wide (still tenant-filtered, never global).
  if (isAdmin) return { tenantId, dbRole, isAdmin, allowedObjectTypes: null }

  let rulesQuery = supabase
    .from('approval_rules')
    .select('object_type')
    .eq('is_active', true)
    .overlaps('required_roles', [dbRole])
  if (tenantId) rulesQuery = rulesQuery.eq('tenant_id', tenantId)

  const { data: rules, error: rulesError } = await rulesQuery
  if (rulesError) {
    console.error(`[v0] ${context}: approval_rules lookup failed:`, rulesError.message)
    throw new Error(`Could not determine your approval routing: ${rulesError.message}`)
  }

  return {
    tenantId,
    dbRole,
    isAdmin,
    allowedObjectTypes: Array.from(new Set((rules ?? []).map((r) => r.object_type).filter(Boolean))),
  }
}

/**
 * Pending-approval count for the nav badge (desktop sidebar + mobile tab bar).
 *
 * Uses the SAME routing + tenant scope as the inbox list and the KPI cards. It
 * was previously only tenant-filtered, so a non-admin saw a red "3" badge that
 * opened onto an "All caught up" inbox.
 */
export async function getPendingApprovalCount(): Promise<number> {
  const supabase = createAdminClient()

  let scope: Awaited<ReturnType<typeof resolveApprovalScope>>
  try {
    scope = await resolveApprovalScope(supabase, 'getPendingApprovalCount')
  } catch (err) {
    // A badge must never break the whole dashboard shell it renders in.
    console.error('[v0] getPendingApprovalCount: scope resolution failed:', err)
    return 0
  }
  if ('error' in scope) return 0

  let query = supabase
    .from('approvals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (scope.tenantId) query = query.eq('tenant_id', scope.tenantId)
  if (scope.allowedObjectTypes !== null) query = query.in('object_type', scope.allowedObjectTypes)

  const { count, error } = await query
  if (error) {
    console.error('[v0] getPendingApprovalCount: count query failed:', error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Fetch approvals for the inbox.
 *
 * Routing source of truth is `approval_rules` (object_type → required_roles).
 * Do NOT route from `approval_matrix`: that table is gate POLICY documentation
 * for the Phase 9 admin surfaces (matrix tab, Excel export, B1–B10 health
 * checks). It has no `object_type` column and its `approver_role` holds role
 * CODES ('PD', 'PM', 'DM') — a third vocabulary with no bridge to the
 * `user_role` enum — so matching against it silently yields nothing.
 *
 * @param approverRole  Display-only role label (e.g. "Project Manager"). NOT used
 *                      for authorization — scoping is derived from the session.
 * @throws if the routing lookup fails, so a broken query can never be rendered
 *         as an empty "All caught up" inbox.
 */
export async function getApprovals(approverRole?: string): Promise<ApprovalRecord[]> {
  const supabase = createAdminClient()

  // Authorization is resolved SERVER-SIDE from the session, never from the
  // caller-supplied `approverRole` (a client-passed role label is spoofable, and
  // it is in the wrong vocabulary — see below). `approverRole` is display-only.
  // Resolve which object_types this approver is responsible for.
  //
  // Two bugs previously made this return [] for EVERY non-admin role, so the
  // inbox was permanently empty while the KPI counters (then unscoped) still
  // showed a pending count:
  //   1. It filtered `approval_rules.approver_role`, which DOES NOT EXIST on
  //      that table — the real column is `required_roles text[]`. (`approver_role`
  //      belongs to the separate `approval_matrix` table.) The resulting 400 was
  //      discarded by destructuring only `data`, so the failure looked like
  //      "this role approves nothing" and hit a `return []`.
  //   2. It compared against ROLE_LABELS display strings ("Project Manager")
  //      while `required_roles` holds DbUserRole enum values ("project_manager").
  //      Fixing the column name alone would still have matched nothing.
  const scope = await resolveApprovalScope(supabase, 'getApprovals')
  if ('error' in scope) return []
  const { allowedObjectTypes, tenantId } = scope

  let query = supabase
    .from('approvals')
    .select('id, object_type, title, status, priority, created_at, description, amount')
    .order('created_at', { ascending: false })
    .limit(100)

  if (tenantId) query = query.eq('tenant_id', tenantId)

  // Scope to the approver's object types. If the role has no rules, it sees nothing.
  if (allowedObjectTypes !== null) {
    if (allowedObjectTypes.length === 0) return []
    query = query.in('object_type', allowedObjectTypes)
  }

  const { data, error } = await query
  if (error || !data) return []

  return data.map((a) => ({
    id: a.id,
    object_type: a.object_type ?? 'Approval',
    object_code: a.title ?? a.id.slice(0, 8).toUpperCase(),
    status: (a.status as ApprovalRecord['status']) ?? 'pending',
    level: 1,
    approver_role: approverRole ?? 'Project Manager',
    requested_by_name: 'Team Member',
    due_date: null,
    created_at: a.created_at,
    decided_at: null,
    decision_reason: a.description ?? null,
  }))
}

export async function createApproval(opts: {
  title: string
  description?: string
  objectType?: string
  priority?: 'critical' | 'high' | 'normal' | 'low'
  approverEmail?: string
  approverUserId?: string
  approverName?: string
  requestedBy?: string
  projectCode?: string
  projectName?: string
  amount?: number
}): Promise<{ id: string } | { error: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate
  const tenantId = await getCurrentTenantId()

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('approvals')
    .insert({
      title:       opts.title,
      description: opts.description ?? null,
      object_type: opts.objectType ?? 'General',
      priority:    opts.priority ?? 'normal',
      status:      'pending',
      amount:      opts.amount ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create approval' }

  // Notify approvers — fire-and-forget, prefs-aware, logged to email_log.
  void (async () => {
    // Explicit recipient wins; otherwise notify all active approver profiles.
    if (opts.approverEmail) {
      await sendApprovalRequestEmail({
        to: opts.approverEmail,
        userId: opts.approverUserId ?? null,
        approverName: opts.approverName ?? 'Approver',
        title: opts.title,
        requestedBy: opts.requestedBy ?? 'System',
        projectCode: opts.projectCode ?? 'N/A',
        projectName: opts.projectName ?? opts.title,
        approvalId: data.id,
      })
      return
    }
    const approvers = await resolveApprovers(supabase, tenantId)
    for (const a of approvers) {
      await sendApprovalRequestEmail({
        to: a.email,
        userId: a.id,
        approverName: a.name,
        title: opts.title,
        requestedBy: opts.requestedBy ?? 'System',
        projectCode: opts.projectCode ?? 'N/A',
        projectName: opts.projectName ?? opts.title,
        approvalId: data.id,
      })
    }
  })().catch((e) => console.error('[approvals] notify failed:', e))

  return { id: data.id }
}

export async function decideApproval(opts: {
  id: string
  decision: 'proceed' | 'conditional_proceed' | 'hold' | 'reject'
  rationale: string
  /** Conditions for conditional_proceed (title, due_date). Required if decision='conditional_proceed'. */
  conditions?: Array<{ title: string; due_date: string }> // ISO date string
  /**
   * UNPERSISTED signature captured for this decision (gate approvals).
   *
   * Written HERE — after the authorization guard passes and immediately before the
   * status write — never at sign time. The pad used to persist on its own "Sign"
   * button, so a user could sign, abandon the form, and leave a permanent
   * signature row on an approval that was never decided. Because `signatures` is
   * append-only and a signature legitimately means "a human put pen to paper",
   * those orphans then blocked any safe status reconciliation.
   */
  signatureDraft?: SignatureDraft
}): Promise<{ error: string | null }> {
  const gate = await requireApprover()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  const statusMap = {
    proceed:             'approved',
    conditional_proceed: 'approved',
    hold:                'pending',
    reject:              'rejected',
  } as const

  const { data: approval } = await supabase
    .from('approvals')
    .select('title, object_type, object_id, description, assignee_id')
    .eq('id', opts.id)
    .single()

  if (!approval) return { error: 'Approval not found' }

  // Verify caller is the assigned approver (or admin override).
  const approverCheck = await requireAssignedApprover(approval)
  if ('error' in approverCheck) return approverCheck

  // Log admin override if applicable.
  if (gate.actor.role && ADMIN_ROLES.includes(gate.actor.role as typeof ADMIN_ROLES[number]) &&
      gate.actor.userId !== approval.assignee_id) {
    console.log(`[v0] Admin override: ${gate.actor.role} (${gate.actor.userId}) decided approval assigned to ${approval.assignee_id}`)
  }

  // Conditional approval validation: require ≥1 condition if decision='conditional_proceed'
  if (opts.decision === 'conditional_proceed') {
    if (!opts.conditions || opts.conditions.length === 0) {
      return { error: 'Conditional approval requires at least 1 condition (title + due date)' }
    }
    // Validate each condition has title and due_date
    const invalidCondition = opts.conditions.find(c => !c.title?.trim() || !c.due_date)
    if (invalidCondition) {
      return { error: 'All conditions must have a title and due date' }
    }
  }

  // Step-aware workflow: find the CURRENT lowest-pending approval_step
  const { data: currentStep } = await supabase
    .from('approval_steps')
    .select('id, level, status')
    .eq('approval_id', opts.id)
    .eq('status', 'pending')
    .order('level')
    .limit(1)
    .maybeSingle()

  // Persist the signature only now that the caller is authorized AND the target
  // approval exists. If it fails we abort without touching the decision, so we
  // never record a decision whose signature is missing.
  let signatureId: string | undefined
  if (opts.signatureDraft) {
    const sigRes = await createSignature({
      dataUrl:     opts.signatureDraft.dataUrl,
      entityType:  'gate_approval',
      entityId:    opts.id,
      projectId:   approval.object_type === 'opportunity' ? approval.object_id : null,
      statement:   opts.signatureDraft.statement,
      signerName:  opts.signatureDraft.signerName,
      signerRole:  opts.signatureDraft.signerRole,
      // This IS the decision call, so the orphan guard does not apply.
      allowUndecided: true,
    })
    if ('error' in sigRes) return { error: `Could not record your signature: ${sigRes.error}` }
    signatureId = sigRes.signature.id
  }

  const decisionStatus = statusMap[opts.decision]

  // If a step workflow exists, update ONLY the current step; otherwise update the approval directly
  if (currentStep) {
    // Step-aware: mark current step with decision + emit event
    // Also update approvals.decision column for audit trail
    const { error: stepErr } = await supabase
      .from('approval_steps')
      .update({
        status: decisionStatus === 'rejected' ? 'rejected' : 'approved',
        decided_at: new Date().toISOString(),
        decided_by: gate.actor.userId,
        decision_note: opts.rationale,
      })
      .eq('id', currentStep.id)

    // Update approvals row: decision column + decision_note
    const { error: apprDecisionErr } = await supabase
      .from('approvals')
      .update({
        decision: opts.decision,
        decision_note: opts.rationale,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.id)

    if (apprDecisionErr) console.log(`[v0] Approval decision column update warning: ${apprDecisionErr.message}`)

    if (stepErr) return { error: `Step decision failed: ${stepErr.message}` }

    // Emit 'decided' event for this step
    const { error: eventErr } = await supabase.from('approval_events').insert({
      approval_id: opts.id,
      actor_id: gate.actor.userId,
      event_type: 'decided',
      metadata: { level: currentStep.level, decision: decisionStatus, rationale: opts.rationale },
    })
    if (eventErr) console.log(`[v0] approval_events emission warning: ${eventErr.message}`)

    // Check if all steps are now completed (all non-pending)
    const { data: pendingSteps } = await supabase
      .from('approval_steps')
      .select('id', { count: 'exact' })
      .eq('approval_id', opts.id)
      .eq('status', 'pending')

    // If rejection, skip remaining steps
    if (decisionStatus === 'rejected') {
      const { error: skipErr } = await supabase
        .from('approval_steps')
        .update({ status: 'skipped' })
        .eq('approval_id', opts.id)
        .eq('status', 'pending')
      if (skipErr) console.log(`[v0] Step skip warning: ${skipErr.message}`)
    }

    // If all steps approved, mark approval as approved
    if (decisionStatus !== 'rejected' && (!pendingSteps || pendingSteps.length === 0)) {
      const { error: apprErr } = await supabase
        .from('approvals')
        .update({
          status: 'approved',
          decided_by: gate.actor.userId,
          ...decisionStamp('approved'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', opts.id)

      if (!apprErr) {
        const lifecycleError = await applyApprovalLifecycle(supabase, approval, 'approved')
        if (lifecycleError) return { error: lifecycleError }

        // Advance gate for approved opportunities
        if (approval.object_type === 'opportunity' && approval.object_id) {
          const { advanceProjectGate } = await import('@/app/actions/phase-gates')
          const advErr = await advanceProjectGate(approval.object_id, { viaApproval: true })
          if (advErr.error) return { error: advErr.error }
        }
      }
    }
  } else {
    // Legacy path (no approval_steps): update approval directly with decision column + decision_note
    const { error } = await supabase
      .from('approvals')
      .update({
        status:     decisionStatus,
        decision:   opts.decision,
        decision_note: opts.rationale,
        decided_by: gate.actor.userId,
        ...decisionStamp(decisionStatus),
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.id)

    if (!error) {
      const lifecycleError = await applyApprovalLifecycle(supabase, approval, decisionStatus)
      if (lifecycleError) return { error: lifecycleError }

      if (
        approval.object_type === 'opportunity' &&
        approval.object_id &&
        decisionStatus === 'approved'
      ) {
        const { advanceProjectGate } = await import('@/app/actions/phase-gates')
        const advErr = await advanceProjectGate(approval.object_id, { viaApproval: true })
        if (advErr.error) return { error: advErr.error }
      }
    }

    if (error) return { error: error.message }
  }

  // Create approval_conditions rows if decision='conditional_proceed'
  if (opts.decision === 'conditional_proceed' && opts.conditions && opts.conditions.length > 0) {
    const conditionRows = opts.conditions.map((c) => ({
      approval_id: opts.id,
      title: c.title.trim(),
      due_date: c.due_date, // ISO date string
      status: 'open', // All new conditions start as 'open'
      created_by: gate.actor.userId,
    }))

    const { error: condErr } = await supabase.from('approval_conditions').insert(conditionRows)
    if (condErr) console.log(`[v0] Approval conditions creation warning: ${condErr.message}`)

    // Emit 'condition_added' events for audit trail
    const eventRows = conditionRows.map((c) => ({
      approval_id: opts.id,
      actor_id: gate.actor.userId,
      event_type: 'condition_added',
      metadata: { title: c.title, due_date: c.due_date },
    }))

    const { error: eventErr } = await supabase.from('approval_events').insert(eventRows)
    if (eventErr) console.log(`[v0] Condition events emission warning: ${eventErr.message}`)
  }

  if (approval) {
    sendApprovalDecisionEmail({
      to: 'admin@gridmind.capital',
      requesterName: 'Team',
      title: approval.title ?? opts.id,
      decision: decisionStatus === 'approved' ? 'approved' : 'rejected',
      decisionBy: 'Executive Sponsor',
      projectCode: approval.object_type ?? 'G0',
      approvalId: opts.id,
      reason: opts.rationale,
    }).catch(() => {})
  }

  return { error: null }
}

export async function delegateApproval(opts: {
  id: string
  delegateId: string
  reason: string
}): Promise<{ error: string | null }> {
  const gate = await requireApprover()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  // The `approval_status` enum is: pending | approved | rejected | delegated.
  // There is NO `under_review` member, so writing it made every delegation fail
  // with a 22P02 invalid-enum-input error. `delegated` is the correct value.
  //
  // Reassign `assignee_id` to the delegate as well — without it the row stayed
  // on the original approver's queue and the delegation had no effect.
  const { data: current, error: readErr } = await supabase
    .from('approvals')
    .select('description')
    .eq('id', opts.id)
    .single()

  if (readErr) return { error: readErr.message }

  // Append to the audit trail rather than overwriting it.
  const note = `[Delegated to ${opts.delegateId} at ${new Date().toISOString()}] Reason: ${opts.reason}`
  const description = current?.description ? `${current.description}\n${note}` : note

  const { error } = await supabase
    .from('approvals')
    .update({
      status:      'delegated',
      // Delegation is a HAND-OFF, not a decision — this clears any stale stamp.
      ...decisionStamp('delegated'),
      assignee_id: opts.delegateId,
      description,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', opts.id)
  return { error: error?.message ?? null }
}

export async function getApprovalById(id: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

export interface ApprovalsDashboard {
  total: number
  pending: number
  approved: number
  rejected: number
  overdue: number
  byObjectType: { name: string; value: number }[]
  byStatus: { name: string; value: number; color: string }[]
  approvalRules: { object_type: string; levels: number; roles: string[] }[]
  /**
   * Which population these numbers describe, so the UI can label them honestly:
   * 'mine' = only the object_types routed to this actor, 'tenant' = every
   * approval in the tenant (admins only).
   */
  scope: 'mine' | 'tenant'
}

/**
 * KPI cards + charts for /approvals.
 *
 * Scoped with the SAME `approval_rules` routing as `getApprovals`, and filtered
 * by tenant. Previously this selected every approvals row with no role scope and
 * no tenant filter, so the counters both leaked across tenants and contradicted
 * the role-scoped list rendered directly beneath them.
 */
export async function loadApprovalsDashboard(): Promise<ApprovalsDashboard> {
  const supabase = createAdminClient()

  const scope = await resolveApprovalScope(supabase, 'loadApprovalsDashboard')
  if ('error' in scope) {
    return {
      total: 0, pending: 0, approved: 0, rejected: 0, overdue: 0,
      byObjectType: [], byStatus: [], approvalRules: [], scope: 'mine',
    }
  }
  const { allowedObjectTypes, tenantId, isAdmin } = scope

  let approvalsQuery = supabase
    .from('approvals')
    .select('id, object_type, status, priority, created_at')
    .order('created_at', { ascending: false })
  if (tenantId) approvalsQuery = approvalsQuery.eq('tenant_id', tenantId)
  if (allowedObjectTypes !== null) {
    // `.in()` with an empty list yields zero rows, which is the correct answer
    // for a role that routes to nothing.
    approvalsQuery = approvalsQuery.in('object_type', allowedObjectTypes)
  }

  // Real columns are `approval_levels` and `required_roles text[]`. This
  // previously selected `level` and `approver_role` — NEITHER of which exists
  // on this table — so it 400'd and the `?? []` below turned the failure into
  // a permanently empty "Approval Rules" panel.
  let rulesQuery = supabase
    .from('approval_rules')
    .select('object_type, approval_levels, required_roles')
    .order('approval_levels')
  if (tenantId) rulesQuery = rulesQuery.eq('tenant_id', tenantId)
  if (allowedObjectTypes !== null) rulesQuery = rulesQuery.in('object_type', allowedObjectTypes)

  const [appRes, rulesRes] = await Promise.all([approvalsQuery, rulesQuery])

  const rows  = appRes.data  ?? []
  const rules = rulesRes.data ?? []

  // Never let a failed query render as "no data" (see getApprovals).
  if (appRes.error) console.error('[v0] loadApprovalsDashboard: approvals query failed:', appRes.error.message)
  if (rulesRes.error) console.error('[v0] loadApprovalsDashboard: approval_rules query failed:', rulesRes.error.message)

  const now = new Date()
  const OVERDUE_DAYS = 5
  const overdue = rows.filter((r) => {
    const age = (now.getTime() - new Date(r.created_at).getTime()) / 86400000
    return r.status === 'pending' && age > OVERDUE_DAYS
  }).length

  const statusColors: Record<string, string> = {
    pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444',
    under_review: '#3b82f6', changes_requested: '#f97316',
  }

  const byObjectType = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.object_type ?? 'General'] = (m[r.object_type ?? 'General'] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  })()

  const byStatus = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.status ?? 'pending'] = (m[r.status ?? 'pending'] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value, color: statusColors[name] ?? '#94a3b8' }))
  })()

  // Aggregate approval rules per object_type. `required_roles` is a text[] of
  // DbUserRole enum values, so flatten it rather than reading a single column.
  const rulesMap: Record<string, { levels: number; roles: string[] }> = {}
  for (const rule of rules) {
    const key = rule.object_type ?? 'General'
    if (!rulesMap[key]) rulesMap[key] = { levels: 0, roles: [] }
    rulesMap[key].levels = Math.max(rulesMap[key].levels, rule.approval_levels ?? 1)
    for (const role of rule.required_roles ?? []) {
      if (role && !rulesMap[key].roles.includes(role)) rulesMap[key].roles.push(role)
    }
  }
  const approvalRules = Object.entries(rulesMap).map(([object_type, v]) => ({ object_type, ...v }))

  return {
    total:    rows.length,
    pending:  rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
    overdue,
    byObjectType,
    byStatus,
    approvalRules,
    scope: isAdmin ? 'tenant' : 'mine',
  }
}

export async function seedApprovalsDemoData(): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate
  const tenantId = await getCurrentTenantId()

  const supabase = createAdminClient()

  // Seed approval_rules unconditionally before the demo-approvals guard.
  // The old code nested this inside the demo-approvals guard, so on any
  // environment that already had approval rows (e.g. production) the rules
  // were never written, leaving the inbox invisible to non-admin roles.
  // Rules have their own guard: re-running is safe.
  const ruleSeeds = [
    { name: 'Opportunity G0 Gate Review', object_type: 'opportunity',     approval_levels: 1, required_roles: ['project_director', 'system_admin', 'tenant_admin'], is_active: true },
    { name: 'Project Charter Approval',   object_type: 'project_charter', approval_levels: 2, required_roles: ['project_director', 'finance_manager'],              is_active: true },
    { name: 'Purchase Order Approval',    object_type: 'purchase_order',  approval_levels: 1, required_roles: ['project_manager', 'finance_manager'],               is_active: true },
    { name: 'Change Order Approval',      object_type: 'change_order',    approval_levels: 2, required_roles: ['project_manager', 'project_director'],              is_active: true },
    { name: 'Subcontract Approval',       object_type: 'subcontract',     approval_levels: 1, required_roles: ['system_admin'],                                     is_active: true },
    { name: 'Variation Order Approval',   object_type: 'variation',       approval_levels: 1, required_roles: ['project_director', 'project_manager'],              is_active: true },
  ]
  const { data: exRules } = await supabase.from('approval_rules').select('id').limit(1)
  if ((exRules?.length ?? 0) === 0) {
    for (const r of ruleSeeds) {
      const { error: ruleErr } = await supabase.from('approval_rules').insert({ tenant_id: tenantId, ...r })
      if (ruleErr) {
        console.error(`[v0] seedApprovalsDemoData: approval_rules insert failed for ${r.object_type}:`, ruleErr.message)
        return { error: `Failed to seed approval rule for ${r.object_type}: ${ruleErr.message}` }
      }
    }
  }

  // Demo approval rows — skip if any already exist (prevents duplicate seeding).
  const { data: ex } = await supabase.from('approvals').select('id').limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  const demos = [
    { object_type: 'opportunity',    title: 'OPP-RAK-250', description: 'G0 gate review for 250MW Solar opportunity', status: 'pending',  priority: 'high',   amount: 175_000_000 },
    { object_type: 'opportunity',    title: 'OPP-GOS-150', description: 'G0 gate review for 150MW Wind opportunity',  status: 'approved', priority: 'normal', amount: 210_000_000 },
    { object_type: 'project_charter',title: 'CHR-SRS-400', description: 'G1 commercial charter — Sirius 400MW',      status: 'pending',  priority: 'high',   amount: 380_000_000 },
    { object_type: 'change_order',   title: 'CO-041',      description: 'Inverter substitution SMA → Huawei',        status: 'pending',  priority: 'normal', amount: 0           },
    { object_type: 'purchase_order', title: 'PO-2026-001', description: 'Module supply agreement — 500MW bifacial',  status: 'rejected', priority: 'high',   amount: 62_000_000  },
    { object_type: 'variation',      title: 'VAR-012',     description: 'Schedule variation — weather delay +6wk',   status: 'pending',  priority: 'critical', amount: 12_400_000 },
  ]
  for (const d of demos) {
    await supabase.from('approvals').insert({ tenant_id: tenantId, ...d })
  }

  return {}
}

/**
 * Apply a decision that may carry an approver comment. Used by both the
 * mobile swipe/thumb inbox and the offline-queue sync path. The comment
 * is appended to the approval description so it is preserved in the audit
 * trail (mirrors decideApproval's rationale handling).
 */
export async function syncQueuedApproval(opts: {
  id: string
  decision: 'approved' | 'rejected'
  comment: string
}): Promise<{ error: string | null }> {
  const gate = await requireApprover()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  const { data: approval } = await supabase
    .from('approvals')
    .select('title, description, object_type, object_id, assignee_id')
    .eq('id', opts.id)
    .single()

  // Verify caller is the assigned approver (or admin override).
  if (!approval) return { error: 'Approval not found' }
  const approverCheck = await requireAssignedApprover(approval)
  if ('error' in approverCheck) return approverCheck

  // Log admin override if applicable.
  if (gate.actor.role && ADMIN_ROLES.includes(gate.actor.role as typeof ADMIN_ROLES[number]) &&
      gate.actor.userId !== approval.assignee_id) {
    console.log(`[v0] Admin override: ${gate.actor.role} (${gate.actor.userId}) synced approval assigned to ${approval.assignee_id}`)
  }

  const description = opts.comment
    ? [
        approval?.description ?? '',
        `\n\n[${opts.decision === 'approved' ? 'Approved' : 'Rejected'} via mobile]`,
        `\nComment: ${opts.comment}`,
      ].join('')
    : approval?.description ?? null

  const { error } = await supabase
    .from('approvals')
    .update({
      status: opts.decision,
      decided_by: gate.actor.userId,
      ...decisionStamp(opts.decision),
      description,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.id)

  // Same lifecycle transition as the desktop path — this is the action the
  // mobile approval cards call, and it previously left the project untouched.
  if (!error) {
    const lifecycleError = await applyApprovalLifecycle(supabase, approval, opts.decision)
    if (lifecycleError) return { error: lifecycleError }
  }

  if (!error && approval) {
    sendApprovalDecisionEmail({
      to: 'admin@gridmind.capital',
      requesterName: 'Team',
      title: approval.title ?? opts.id,
      decision: opts.decision,
      decisionBy: 'Mobile',
      projectCode: approval.object_type ?? 'N/A',
      approvalId: opts.id,
      reason: opts.comment || undefined,
    }).catch(() => {})
  }

  return { error: error?.message ?? null }
}

export async function updateApprovalStatus(id: string, status: 'approved' | 'rejected') {
  const gate = await requireApprover()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  // Fetch the approval first so we can include context in the email
  const { data: approval } = await supabase
    .from('approvals')
    .select('title, description, object_type, object_id, assignee_id')
    .eq('id', id)
    .single()

  // Verify caller is the assigned approver (or admin override).
  if (!approval) return { error: 'Approval not found' }
  const approverCheck = await requireAssignedApprover(approval)
  if ('error' in approverCheck) return approverCheck

  // Log admin override if applicable.
  if (gate.actor.role && ADMIN_ROLES.includes(gate.actor.role as typeof ADMIN_ROLES[number]) &&
      gate.actor.userId !== approval.assignee_id) {
    console.log(`[v0] Admin override: ${gate.actor.role} (${gate.actor.userId}) updated approval assigned to ${approval.assignee_id}`)
  }

  const { error } = await supabase
    .from('approvals')
    .update({ status, decided_by: gate.actor.userId, ...decisionStamp(status), updated_at: new Date().toISOString() })
    .eq('id', id)

  // Third decision path — kept in sync via the shared helper.
  if (!error) {
    const lifecycleError = await applyApprovalLifecycle(supabase, approval, status)
    if (lifecycleError) return { error: lifecycleError }
  }

  if (!error && approval) {
    // Fire-and-forget — do not block response on email delivery
    sendApprovalDecisionEmail({
      to: 'admin@gridmind.capital',
      requesterName: 'Team',
      title: approval.title ?? id,
      decision: status,
      decisionBy: 'System',
      projectCode: approval.object_type ?? 'N/A',
      approvalId: id,
      reason: approval.description ?? undefined,
    }).catch(() => {})
  }

  return { error: error?.message ?? null }
}
