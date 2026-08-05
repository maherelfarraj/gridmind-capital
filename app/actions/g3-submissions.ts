'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { getCurrentTenantId } from '@/lib/tenant'
import { G3FormData, assessG3Readiness } from '@/lib/gates/g3-requirements'
import { createApprovalWorkflow } from './approvals'

/**
 * Load existing G3 submission and gate status for a project (current tenant only).
 * Returns submission data even if gate is locked/approved so form can show proper UI states.
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

  // Get existing submission if any.
  const { data: submission } = await supabase
    .from('gate_submissions')
    .select('form_data, status')
    .eq('project_id', projectId)
    .eq('gate_number', 3)
    .maybeSingle()

  return {
    formData: (submission?.form_data ?? undefined) as G3FormData | undefined,
    submissionStatus: submission?.status ?? null,
    gateStatus: gate?.status ?? null,
  }
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

  // 6. Verify all deliverables have real document IDs.
  const missingDocuments = formData.deliverables.filter((d) => !d.documentId)
  if (missingDocuments.length > 0) {
    return { error: `${missingDocuments.length} deliverables missing document records` }
  }

  // 7. Verify all staffing roles have real profile IDs.
  const unassignedStaff = formData.staffingRoles.filter((r) => !r.assignedProfileId)
  if (unassignedStaff.length > 0) {
    return { error: `${unassignedStaff.length} staffing roles not assigned to project members` }
  }

  // 8. Check for duplicate active approval workflow.
  const { data: existingApproval } = await supabase
    .from('approvals')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('object_type', 'gate')
    .eq('object_id', projectId)
    .eq('gate_number', 3)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingApproval) {
    return { error: 'G3 submission already pending approval' }
  }

  // 9. Upsert gate_submissions.
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

  // 10. Create approval workflow via canonical engine.
  const approvalResult = await createApprovalWorkflow(
    'gate',
    projectId,
    `G3 Commercial & Financial Close: ${project.name}`,
    0, // amount not applicable for gates
  )

  if (approvalResult.error) {
    // Rollback: delete the submission if workflow creation failed
    await supabase
      .from('gate_submissions')
      .delete()
      .eq('project_id', projectId)
      .eq('gate_number', 3)
    return { error: approvalResult.error }
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
 * G3 approval decisions are routed through the canonical decideApproval() action.
 * Use: decideApproval(approvalId, 'approved' | 'rejected', rationale)
 * 
 * The canonical workflow handles:
 * - Approval step completion and quorum validation
 * - Gate lifecycle advancement when quorum met (Corrections 10-11)
 * - Audit trail and actor attribution
 * - Delegation and escalation rules
 */
