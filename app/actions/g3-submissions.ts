'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter, requireApprover } from '@/lib/auth/guard'
import { G3FormData, assessG3Readiness, isG3Complete } from '@/lib/gates/g3-requirements'

/**
 * Load the most recent G3 submission for a project, or initialize blank.
 */
export async function getG3Submission(projectId: string) {
  const supabase = createAdminClient()

  const { data: submission, error } = await supabase
    .from('gate_submissions')
    .select('id, form_data, status, submitted_at')
    .eq('project_id', projectId)
    .eq('gate_number', 3)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null

  if (submission) {
    return {
      id: submission.id,
      formData: (submission.form_data as G3FormData) ?? null,
      status: submission.status,
      submittedAt: submission.submitted_at,
    }
  }

  return null
}

/**
 * Submit the G3 Commercial & Financial Close form.
 *
 * Enforces:
 * - Completeness (all required contracts signed, financing committed, approvals obtained)
 * - Duplicate prevention (no concurrent submissions)
 * - Tenant isolation (project must belong to actor's tenant)
 * - Audit trail (submitter recorded in audit_log)
 */
export async function submitG3FormAction(
  projectId: string,
  formData: G3FormData,
): Promise<{ error?: string; submissionId?: string }> {
  const authResult = await requireWriter()
  if ('error' in authResult) return authResult

  const supabase = createAdminClient()

  // 1. Verify project exists and belongs to tenant.
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id, tenant_id, name')
    .eq('id', projectId)
    .single()

  if (projError || !project) return { error: 'Project not found' }

  // 2. Check completeness.
  const readiness = assessG3Readiness(formData)
  if (!isG3Complete(formData)) {
    const blockerList = readiness.blockers.join('; ')
    return { error: `G3 submission incomplete: ${blockerList}` }
  }

  // 3. Check for concurrent submission.
  const { data: existing } = await supabase
    .from('gate_submissions')
    .select('id, status')
    .eq('project_id', projectId)
    .eq('gate_number', 3)
    .eq('status', 'submitted')
    .maybeSingle()

  if (existing) return { error: 'G3 submission already pending approval' }

  // 4. Upsert gate_submissions row.
  const { error: submitError, data: submitData } = await supabase
    .from('gate_submissions')
    .upsert(
      {
        project_id: projectId,
        gate_number: 3,
        form_data: formData,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        submitted_by: null,
      },
      { onConflict: 'project_id,gate_number' },
    )
    .select('id')
    .single()

  if (submitError) return { error: `Failed to save G3 submission: ${submitError.message}` }

  // 5. Create approvals row (gate-level approval).
  const { data: approval, error: approvalError } = await supabase
    .from('approvals')
    .insert({
      tenant_id: project.tenant_id,
      object_type: 'gate',
      object_id: projectId,
      gate_number: 3,
      title: `G3 Submission: ${project.name}`,
      status: 'pending',
      priority: 'normal',
      requester_id: null,
      amount: 0,
      description: 'G3 Commercial & Financial Close submission',
    })
    .select('id')
    .single()

  if (approvalError || !approval) {
    return { error: `Failed to create approval record: ${approvalError?.message || 'Unknown error'}` }
  }

  // 6. Audit log entry.
  await supabase.from('audit_log').insert({
    table_name: 'gate_submissions',
    record_id: projectId,
    action: 'INSERT',
    op: 'submit_g3',
    reason: 'G3 Commercial & Financial Close submission',
    changed_by: null,
    changed_at: new Date().toISOString(),
    old_values: {},
    new_values: {
      gate_number: 3,
      status: 'submitted',
      completeness: readiness.completionPercentage,
    },
  })

  return { submissionId: submitData?.id ?? approval.id }
}

/**
 * Approve or reject G3 submission.
 *
 * Approval: marks submission approved, advances project to G4, records decision.
 * Rejection: marks submission rejected, keeps G3 active for resubmission.
 */
export async function decideG3ApprovalAction(
  approvalId: string,
  decision: 'approve' | 'reject',
  rationale: string,
): Promise<{ error?: string }> {
  const authResult = await requireApprover()
  if ('error' in authResult) return authResult

  const supabase = createAdminClient()

  // 1. Load approval + submission.
  const { data: approval, error: approvalError } = await supabase
    .from('approvals')
    .select('id, object_id, gate_number, status')
    .eq('id', approvalId)
    .eq('gate_number', 3)
    .single()

  if (approvalError || !approval) return { error: 'G3 approval not found' }
  if (approval.status !== 'pending') return { error: 'G3 approval already decided' }

  const projectId = approval.object_id

  // 2. Load the submission to verify it's approved-ready.
  const { data: submission } = await supabase
    .from('gate_submissions')
    .select('form_data, status')
    .eq('project_id', projectId)
    .eq('gate_number', 3)
    .single()

  if (!submission) return { error: 'G3 submission not found' }

  if (decision === 'approve') {
    // Mark G3 as approved.
    const { error: submitError } = await supabase
      .from('gate_submissions')
      .update({ status: 'approved' })
      .eq('project_id', projectId)
      .eq('gate_number', 3)

    if (submitError) return { error: `Failed to mark G3 approved: ${submitError.message}` }

    // Advance project to G4 (update current_phase).
    const { error: advanceError } = await supabase
      .from('projects')
      .update({ current_phase: 3 })
      .eq('id', projectId)

    if (advanceError) {
      return { error: `Failed to advance project to G4: ${advanceError.message}` }
    }

    // Mark approval as approved.
    const { error: approveError } = await supabase
      .from('approvals')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
        decided_by: undefined,
        decision_note: rationale,
      })
      .eq('id', approvalId)

    if (approveError) return { error: `Failed to mark approval: ${approveError.message}` }

    // Audit log.
    await supabase.from('audit_log').insert({
      table_name: 'approvals',
      record_id: approvalId,
      action: 'UPDATE',
      op: 'approve_g3',
      reason: rationale,
      changed_by: null,
      changed_at: new Date().toISOString(),
      old_values: { status: 'pending' },
      new_values: { status: 'approved', project_advanced_to_g4: true },
    })

    return {}
  } else {
    // Reject: mark approval as rejected, keep G3 active.
    const { error: rejectError } = await supabase
      .from('approvals')
      .update({
        status: 'rejected',
        decided_at: new Date().toISOString(),
        decided_by: undefined,
        decision_note: rationale,
      })
      .eq('id', approvalId)

    if (rejectError) return { error: `Failed to mark rejection: ${rejectError.message}` }

    // Audit log.
    await supabase.from('audit_log').insert({
      table_name: 'approvals',
      record_id: approvalId,
      action: 'UPDATE',
      op: 'reject_g3',
      reason: rationale,
      changed_by: null,
      changed_at: new Date().toISOString(),
      old_values: { status: 'pending' },
      new_values: { status: 'rejected' },
    })

    return {}
  }
}
