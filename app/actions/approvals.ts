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
      approvalTitle: approval.title ?? id,
      objectType: approval.object_type ?? 'Approval',
      decision: status,
      decidedBy: 'System',
      reason: approval.description ?? undefined,
    }).catch(() => {})
  }

  return { error: error?.message ?? null }
}
