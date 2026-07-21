'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendApprovalRequestEmail, sendApprovalDecisionEmail } from '@/lib/email/send'
import type { ApprovalRecord } from '@/components/approvals/approval-inbox'

export async function getApprovals(): Promise<ApprovalRecord[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('approvals')
    .select('id, object_type, title, status, priority, created_at, description, amount')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((a) => ({
    id: a.id,
    object_type: a.object_type ?? 'Approval',
    object_code: a.title ?? a.id.slice(0, 8).toUpperCase(),
    status: (a.status as ApprovalRecord['status']) ?? 'pending',
    level: 1,
    approver_role: 'Project Manager',
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

  // Notify approver — fire-and-forget
  if (opts.approverEmail) {
    sendApprovalRequestEmail({
      to: opts.approverEmail,
      approverName: opts.approverName ?? 'Approver',
      title: opts.title,
      requestedBy: opts.requestedBy ?? 'System',
      projectCode: opts.projectCode ?? 'N/A',
      projectName: opts.projectName ?? opts.title,
      approvalId: data.id,
    }).catch(() => {})
  }

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
