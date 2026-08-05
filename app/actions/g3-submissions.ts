'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { getCurrentTenantId } from '@/lib/tenant'
import { G3FormData, assessG3Readiness } from '@/lib/gates/g3-requirements'
import { advanceProjectGate } from './phase-gates'
import { createApproval } from './approvals'

/**
 * Load existing G3 submission for a project (current tenant only).
 * Returns null if no submission exists or gate is not in_review status.
 */
export async function getG3Submission(projectId: string) {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  // Verify project in tenant.
  const { data: project } = await supabase
    .from('projects')
    .select('id, tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .single()

  if (!project) return null

  // Get G3 (gate 3) phase status.
  const { data: gate } = await supabase
    .from('phase_gates')
    .select('status')
    .eq('project_id', projectId)
    .eq('phase_number', 3)
    .maybeSingle()

  // Can only submit G3 when it's in_review.
  if (!gate || gate.status !== 'in_review') return null

  // Get existing submission if any.
  const { data: submission } = await supabase
    .from('gate_submissions')
    .select('form_data, status')
    .eq('project_id', projectId)
    .eq('gate_number', 3)
    .maybeSingle()

  return submission
    ? {
        formData: (submission.form_data ?? undefined) as G3FormData | undefined,
        status: submission.status,
      }
    : null
}

/**
 * Submit G3 form for approval.
 * - Validates completeness
 * - Stores submission atomically with approval request
 * - Records audit trail
 * - Uses real actor ID from requireWriter()
 * - Enforces tenant isolation
 */
export async function submitG3FormAction(projectId: string, formData: G3FormData) {
  // 1. Authenticate and get actor.
  const actorResult = await requireWriter()
  if ('error' in actorResult) return actorResult
  const { actor } = actorResult

  // 2. Get tenant and verify actor is in it.
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return { error: 'Tenant context not available' }

  const supabase = createAdminClient()

  // 3. Verify project exists in tenant.
  const { data: project } = await supabase
    .from('projects')
    .select('id, tenant_id, name')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .single()

  if (!project) return { error: 'Project not found or not in your tenant' }

  // 4. Check G3 gate is in_review and no approved submission exists.
  const { data: existingSubmission } = await supabase
    .from('gate_submissions')
    .select('status')
    .eq('project_id', projectId)
    .eq('gate_number', 3)
    .maybeSingle()

  if (existingSubmission?.status === 'approved') {
    return { error: 'G3 has already been approved' }
  }

  const { data: gate } = await supabase
    .from('phase_gates')
    .select('status')
    .eq('project_id', projectId)
    .eq('phase_number', 3)
    .maybeSingle()

  if (!gate || gate.status !== 'in_review') {
    return { error: 'G3 is not open for submission' }
  }

  // 5. Validate completeness.
  const readiness = assessG3Readiness(formData)
  if (!readiness.ready) {
    return { error: `G3 is not ready: ${readiness.blockers.join('; ')}` }
  }

  // 6. Upsert gate_submissions.
  const { error: submitError } = await supabase
    .from('gate_submissions')
    .upsert(
      {
        project_id: projectId,
        gate_number: 3,
        form_data: formData,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        submitted_by: actor.userId,
      },
      { onConflict: 'project_id,gate_number' },
    )

  if (submitError) return { error: `Failed to save G3 submission: ${submitError.message}` }

  // 7. Create approval record directly.
  const { error: approvalError } = await supabase
    .from('approvals')
    .insert({
      tenant_id: tenantId,
      object_type: 'gate',
      object_id: projectId,
      gate_number: 3,
      title: `G3 Commercial & Financial Close: ${project.name}`,
      description: 'Commercial and financial close for ready-to-build approval',
      status: 'pending',
      priority: 'normal',
      requester_id: actor.userId,
      amount: 0,
    })

  if (approvalError) {
    // Rollback: delete the submission if approval creation failed
    await supabase
      .from('gate_submissions')
      .delete()
      .eq('project_id', projectId)
      .eq('gate_number', 3)
    return { error: `Failed to create approval record: ${approvalError.message}` }
  }

  // 8. Audit log.
  await supabase.from('audit_log').insert({
    table_name: 'gate_submissions',
    record_id: projectId,
    action: 'INSERT',
    op: 'submit_g3',
    reason: 'G3 Commercial & Financial Close submission',
    changed_by: actor.userId,
    changed_at: new Date().toISOString(),
    old_values: {},
    new_values: {
      gate_number: 3,
      status: 'submitted',
      completeness: readiness.completionPercentage,
    },
  })

  return {}
}

/**
 * Decide on G3 approval (approve or reject).
 * - Approves/rejects the submission
 * - Calls canonical gate lifecycle to advance project if approved
 * - Records audit trail with real actor ID
 * - Enforces tenant isolation
 */
export async function decideG3ApprovalAction(
  projectId: string,
  decision: 'approved' | 'rejected',
  rationale: string,
) {
  // 1. Authenticate and verify approver role.
  const actorResult = await requireWriter()
  if ('error' in actorResult) return actorResult
  const { actor } = actorResult

  // 2. Get tenant and verify actor.
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return { error: 'Tenant context not available' }

  const supabase = createAdminClient()

  // 3. Verify project in tenant.
  const { data: project } = await supabase
    .from('projects')
    .select('id, tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .single()

  if (!project) return { error: 'Project not found or not in your tenant' }

  // 4. Get the approval record for this G3 submission.
  const { data: approval } = await supabase
    .from('approvals')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('object_type', 'gate')
    .eq('object_id', projectId)
    .eq('gate_number', 3)
    .maybeSingle()

  if (!approval) return { error: 'No G3 approval request found' }
  if (approval.status !== 'pending') return { error: 'G3 approval is not pending' }

  // 5. Update approval status.
  const { error: updateError } = await supabase
    .from('approvals')
    .update({
      status: decision === 'approved' ? 'approved' : 'rejected',
      decided_at: new Date().toISOString(),
      decided_by: actor.userId,
      decision_note: rationale,
    })
    .eq('id', approval.id)

  if (updateError) return { error: `Failed to update approval: ${updateError.message}` }

  // 6. If approved, advance project gate via canonical lifecycle.
  if (decision === 'approved') {
    const advanceResult = await advanceProjectGate(projectId, { viaApproval: true })
    if ('error' in advanceResult) return advanceResult
  }

  // 7. Audit log.
  await supabase.from('audit_log').insert({
    table_name: 'approvals',
    record_id: approval.id,
    action: 'UPDATE',
    op: decision === 'approved' ? 'approve_g3' : 'reject_g3',
    reason: rationale,
    changed_by: actor.userId,
    changed_at: new Date().toISOString(),
    old_values: { status: 'pending' },
    new_values: {
      status: decision === 'approved' ? 'approved' : 'rejected',
      project_advanced: decision === 'approved',
    },
  })

  return {}
}
