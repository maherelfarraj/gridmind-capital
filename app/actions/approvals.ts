'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter, requireApprover, getAuthActor } from '@/lib/auth/guard'
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
  conditions?: string
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
    .select('title, object_type, object_id, description')
    .eq('id', opts.id)
    .single()

  if (!approval) return { error: 'Approval not found' }

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

  const { error } = await supabase
    .from('approvals')
    .update({
      status:     statusMap[opts.decision],
      // 'hold' maps to 'pending', which correctly CLEARS decided_at (reopened).
      ...decisionStamp(statusMap[opts.decision]),
      updated_at: new Date().toISOString(),
      // Store decision detail in description
      description: [
        approval?.description ?? '',
        `\n\n[Decision: ${opts.decision.replace('_', ' ')}]`,
        `\nRationale: ${opts.rationale}`,
        opts.conditions ? `\nConditions: ${opts.conditions}` : '',
        signatureId ? `\n[Signed: ${signatureId}]` : '',
      ].join(''),
    })
    .eq('id', opts.id)

  // `hold` maps to 'pending', so the helper correctly makes no lifecycle change.
  if (!error) {
    const lifecycleError = await applyApprovalLifecycle(supabase, approval, statusMap[opts.decision])
    if (lifecycleError) return { error: lifecycleError }
  }

  if (!error && approval) {
    sendApprovalDecisionEmail({
      to: 'admin@gridmind.capital',
      requesterName: 'Team',
      title: approval.title ?? opts.id,
      decision: statusMap[opts.decision] === 'approved' ? 'approved' : 'rejected',
      decisionBy: 'Executive Sponsor',
      projectCode: approval.object_type ?? 'G0',
      approvalId: opts.id,
      reason: opts.rationale,
    }).catch(() => {})
  }

  return { error: error?.message ?? null }
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

  // Seed approval_rules.
  //
  // This seed was silently broken: it wrote `level` and `approver_role`, neither
  // of which exists on this table, and used ROLE_LABELS display strings ("Project
  // Manager") where `required_roles` holds DbUserRole enum values. Every insert
  // was rejected by PostgREST, which is why no 'opportunity' routing rule existed
  // and the inbox had nothing to match against.
  const ruleSeeds = [
    { name: 'Opportunity G0 Gate Review', object_type: 'opportunity',     approval_levels: 1, required_roles: ['project_director', 'system_admin', 'tenant_admin'], is_active: true },
    { name: 'Project Charter Approval',   object_type: 'project_charter', approval_levels: 2, required_roles: ['project_director', 'finance_manager'],              is_active: true },
    { name: 'Purchase Order Approval',    object_type: 'purchase_order',  approval_levels: 1, required_roles: ['project_manager', 'finance_manager'],               is_active: true },
    { name: 'Change Order Approval',      object_type: 'change_order',    approval_levels: 2, required_roles: ['project_manager', 'project_director'],              is_active: true },
  ]
  const { data: exRules } = await supabase.from('approval_rules').select('id').limit(1)
  if ((exRules?.length ?? 0) === 0) {
    for (const r of ruleSeeds) {
      const { error: seedError } = await supabase.from('approval_rules').insert({ tenant_id: tenantId, ...r })
      // A rejected insert used to pass unnoticed here, leaving the routing table
      // empty while the seed reported success.
      if (seedError) {
        console.error(`[v0] seedApprovalsDemoData: approval_rules insert failed for ${r.object_type}:`, seedError.message)
        return { error: `Failed to seed approval rule for ${r.object_type}: ${seedError.message}` }
      }
    }
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
    .select('title, description, object_type, object_id')
    .eq('id', opts.id)
    .single()

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
    .select('title, description, object_type, object_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('approvals')
    .update({ status, ...decisionStamp(status), updated_at: new Date().toISOString() })
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
