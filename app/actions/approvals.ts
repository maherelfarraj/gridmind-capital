'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendApprovalRequestEmail, sendApprovalDecisionEmail } from '@/lib/email/send'
import type { ApprovalRecord } from '@/components/approvals/approval-inbox'

// Roles that see every approval regardless of routing rules.
const ADMIN_APPROVER_ROLES = ['Super Admin', 'Tenant Admin', 'Executive Sponsor', 'PMO Director']

// profiles.role enum values that action approvals (used to resolve email recipients).
const APPROVER_ENUM_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'project_manager']
const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

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
 * Fetch approvals for the inbox.
 * @param approverRole  Human-readable role label (e.g. "Project Manager"). When provided
 *                      and not an admin role, results are scoped to the object_types this
 *                      role is configured to approve in `approval_rules`. Omit for the
 *                      full/admin view.
 */
export async function getApprovals(approverRole?: string): Promise<ApprovalRecord[]> {
  const supabase = createAdminClient()

  // Resolve which object_types this approver is responsible for.
  let allowedObjectTypes: string[] | null = null
  if (approverRole && !ADMIN_APPROVER_ROLES.includes(approverRole)) {
    const { data: rules } = await supabase
      .from('approval_rules')
      .select('object_type')
      .eq('approver_role', approverRole)
    allowedObjectTypes = Array.from(new Set((rules ?? []).map((r) => r.object_type).filter(Boolean)))
  }

  let query = supabase
    .from('approvals')
    .select('id, object_type, title, status, priority, created_at, description, amount')
    .order('created_at', { ascending: false })

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
    const approvers = await resolveApprovers(supabase, DEMO_TENANT)
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
}): Promise<{ error: string | null }> {
  const supabase = createAdminClient()

  const statusMap = {
    proceed:             'approved',
    conditional_proceed: 'approved',
    hold:                'pending',
    reject:              'rejected',
  } as const

  const { data: approval } = await supabase
    .from('approvals')
    .select('title, object_type, description')
    .eq('id', opts.id)
    .single()

  const { error } = await supabase
    .from('approvals')
    .update({
      status:     statusMap[opts.decision],
      updated_at: new Date().toISOString(),
      // Store decision detail in description
      description: [
        approval?.description ?? '',
        `\n\n[Decision: ${opts.decision.replace('_', ' ')}]`,
        `\nRationale: ${opts.rationale}`,
        opts.conditions ? `\nConditions: ${opts.conditions}` : '',
      ].join(''),
    })
    .eq('id', opts.id)

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
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('approvals')
    .update({
      status:      'delegated' as never,
      description: `[Delegated to: ${opts.delegateId}]\nReason: ${opts.reason}`,
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
}

export async function loadApprovalsDashboard(): Promise<ApprovalsDashboard> {
  const supabase = createAdminClient()
  const [appRes, rulesRes] = await Promise.all([
    supabase.from('approvals').select('id, object_type, status, priority, created_at').order('created_at', { ascending: false }),
    supabase.from('approval_rules').select('object_type, level, approver_role').order('level'),
  ])

  const rows  = appRes.data  ?? []
  const rules = rulesRes.data ?? []

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

  // Aggregate approval rules per object_type
  const rulesMap: Record<string, { levels: number; roles: string[] }> = {}
  for (const rule of rules) {
    const key = rule.object_type ?? 'General'
    if (!rulesMap[key]) rulesMap[key] = { levels: 0, roles: [] }
    rulesMap[key].levels = Math.max(rulesMap[key].levels, rule.level ?? 1)
    if (rule.approver_role && !rulesMap[key].roles.includes(rule.approver_role)) {
      rulesMap[key].roles.push(rule.approver_role)
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
  }
}

export async function seedApprovalsDemoData(): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('approvals').select('id').limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'
  const demos = [
    { object_type: 'opportunity',    title: 'OPP-RAK-250', description: 'G0 gate review for 250MW Solar opportunity', status: 'pending',  priority: 'high',   amount: 175_000_000 },
    { object_type: 'opportunity',    title: 'OPP-GOS-150', description: 'G0 gate review for 150MW Wind opportunity',  status: 'approved', priority: 'normal', amount: 210_000_000 },
    { object_type: 'project_charter',title: 'CHR-SRS-400', description: 'G1 commercial charter — Sirius 400MW',      status: 'pending',  priority: 'high',   amount: 380_000_000 },
    { object_type: 'change_order',   title: 'CO-041',      description: 'Inverter substitution SMA → Huawei',        status: 'pending',  priority: 'normal', amount: 0           },
    { object_type: 'purchase_order', title: 'PO-2026-001', description: 'Module supply agreement — 500MW bifacial',  status: 'rejected', priority: 'high',   amount: 62_000_000  },
    { object_type: 'variation',      title: 'VAR-012',     description: 'Schedule variation — weather delay +6wk',   status: 'pending',  priority: 'critical', amount: 12_400_000 },
  ]
  for (const d of demos) {
    await supabase.from('approvals').insert({ tenant_id: DEMO_TENANT, ...d })
  }

  // Seed approval_rules
  const ruleSeeds = [
    { object_type: 'opportunity',     level: 1, approver_role: 'Project Manager' },
    { object_type: 'opportunity',     level: 2, approver_role: 'Executive Sponsor' },
    { object_type: 'project_charter', level: 1, approver_role: 'Project Manager' },
    { object_type: 'project_charter', level: 2, approver_role: 'CFO' },
    { object_type: 'project_charter', level: 3, approver_role: 'Board' },
    { object_type: 'purchase_order',  level: 1, approver_role: 'Project Manager' },
    { object_type: 'change_order',    level: 1, approver_role: 'Project Manager' },
    { object_type: 'change_order',    level: 2, approver_role: 'Commercial Director' },
  ]
  const { data: exRules } = await supabase.from('approval_rules').select('id').limit(1)
  if ((exRules?.length ?? 0) === 0) {
    for (const r of ruleSeeds) await supabase.from('approval_rules').insert({ tenant_id: DEMO_TENANT, ...r })
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
  const supabase = createAdminClient()

  const { data: approval } = await supabase
    .from('approvals')
    .select('title, description, object_type')
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
    .update({ status: opts.decision, description, updated_at: new Date().toISOString() })
    .eq('id', opts.id)

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
  const supabase = createAdminClient()

  // Fetch the approval first so we can include context in the email
  const { data: approval } = await supabase
    .from('approvals')
    .select('title, description, object_type')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('approvals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

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
