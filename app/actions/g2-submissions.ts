'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter, requireApprover } from '@/lib/auth/guard'
import { getCurrentTenantId } from '@/lib/tenant'
import { assessG2Readiness, type G2FormData } from '@/lib/gates/g2-requirements'

/**
 * Load the current G2 submission for a project (if it exists).
 * Returns the form_data + status, or null if no submission exists.
 * Tenant-scoped: cross-tenant projects return null (not an error, just invisible).
 */
export async function getG2Submission(projectId: string) {
  const actor = await requireWriter()
  if ('error' in actor) return null

  const tenantId = await getCurrentTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  // Verify project belongs to this tenant (no cross-tenant leaks).
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id, tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (projError || !project) return null

  // Load G2 submission for this project.
  const { data: submission } = await supabase
    .from('gate_submissions')
    .select('id, form_data, status, submitted_at')
    .eq('project_id', projectId)
    .eq('gate_number', 2)
    .maybeSingle()

  return submission
    ? { formData: submission.form_data as G2FormData, status: submission.status, submittedAt: submission.submitted_at }
    : null
}

/**
 * Submit the G2 form — creates/updates the gate_submissions row and creates
 * an approval record for gate-level decision makers.
 *
 * Validation:
 * - User must be authenticated (has writer role)
 * - Project must belong to user's tenant
 * - Form must be complete (all required items filled)
 * - No pending G2 approval already exists (prevents duplicates)
 *
 * On success:
 * - Upsert gate_submissions row (gate 2, form_data, status='submitted')
 * - Create approvals row (for gate-level decision)
 * - Audit log entry (op='submit_g2')
 * - Return approval ID
 */
export async function submitG2FormAction(
  projectId: string,
  formData: G2FormData,
): Promise<{ error: string | null; approvalId?: string }> {
  const actor = await requireWriter()
  if ('error' in actor) return actor

  const tenantId = await getCurrentTenantId()
  if (!tenantId) return { error: 'Tenant not found' }

  const supabase = createAdminClient()

  // 1. Verify project belongs to this tenant.
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id, name, tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (projError || !project) return { error: 'Project not found or access denied' }

  // 2. Check form completeness.
  const readiness = assessG2Readiness(formData)
  if (!readiness.ready) {
    const blockerList = readiness.blockers.join('; ')
    return { error: `G2 submission incomplete: ${blockerList}` }
  }

  // 3. Check for existing pending/delegated G2 approval (prevent duplicates).
  const { data: existingApproval } = await supabase
    .from('approvals')
    .select('id, status')
    .eq('object_type', 'gate')
    .eq('object_id', projectId)
    .eq('gate_number', 2)
    .in('status', ['pending', 'delegated'])
    .maybeSingle()

  if (existingApproval) {
    return { error: 'G2 approval already pending — cannot resubmit' }
  }

  // 4. Upsert gate_submissions row.
  const { error: submitError } = await supabase.from('gate_submissions').upsert(
    {
      project_id: projectId,
      gate_number: 2,
      form_data: formData,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submitted_by: null,
    },
    { onConflict: 'project_id,gate_number' },
  )

  if (submitError) return { error: `Failed to save G2 submission: ${submitError.message}` }

  // 5. Create approvals row (gate-level approval).
  const { data: approval, error: approvalError } = await supabase
    .from('approvals')
    .insert({
      tenant_id: tenantId,
      object_type: 'gate',
      object_id: projectId,
      gate_number: 2,
      title: `G2 Submission: ${project.name}`,
      status: 'pending',
      priority: 'normal',
      requester_id: null,
      amount: 0,
      description: 'G2 Permitting & Grid Application submission',
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
    op: 'submit_g2',
    reason: 'G2 Permitting & Grid Application submission',
    changed_by: null,
    changed_at: new Date().toISOString(),
    old_values: {},
    new_values: {
      gate_number: 2,
      status: 'submitted',
      completeness: readiness.completionPercentage,
    },
  })

  return { error: null, approvalId: approval.id }
}

/**
 * Decide on a G2 approval (proceed to G3 or reject).
 *
 * On `proceed`:
 * - Mark approval as approved
 * - Update phase_gates: G2 → approved, G3 → active
 * - Audit: op='approve_g2'
 *
 * On `reject`:
 * - Mark approval as rejected + rationale
 * - Keep G2 in_review (stays active)
 * - Audit: op='reject_g2'
 */
export async function decideG2ApprovalAction(
  approvalId: string,
  decision: 'proceed' | 'reject',
  rationale: string,
): Promise<{ error: string | null }> {
  const actor = await requireApprover()
  if ('error' in actor) return actor

  const tenantId = await getCurrentTenantId()
  if (!tenantId) return { error: 'Tenant not found' }

  const supabase = createAdminClient()

  // Load the approval and verify it belongs to this actor's tenant.
  const { data: approval, error: loadError } = await supabase
    .from('approvals')
    .select('id, object_id, gate_number, status, tenant_id')
    .eq('id', approvalId)
    .eq('tenant_id', tenantId)
    .eq('gate_number', 2)
    .maybeSingle()

  if (loadError || !approval) {
    return { error: 'Approval not found or access denied' }
  }

  const projectId = approval.object_id

  // Verify the project exists and belongs to this tenant.
  const { data: project } = await supabase
    .from('projects')
    .select('id, tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!project) return { error: 'Project not found or access denied' }

  if (decision === 'proceed') {
    // Mark approval as approved.
    const { error: approveError } = await supabase
      .from('approvals')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
        decided_by: null,
        decision_note: rationale,
      })
      .eq('id', approvalId)

    if (approveError) return { error: `Failed to mark approval: ${approveError.message}` }

    // Update phase_gates: G2 → approved, G3 → active (if it exists).
    const { error: g2Error } = await supabase
      .from('phase_gates')
      .update({ status: 'approved' })
      .eq('project_id', projectId)
      .eq('phase_number', 2)

    if (g2Error) return { error: `Failed to mark G2 approved: ${g2Error.message}` }

    // Update G3 if it exists and is still pending (→ active).
    await supabase
      .from('phase_gates')
      .update({ status: 'in_review' })
      .eq('project_id', projectId)
      .eq('phase_number', 3)
      .eq('status', 'pending')

    // Audit log.
    await supabase.from('audit_log').insert({
      table_name: 'approvals',
      record_id: approvalId,
      action: 'UPDATE',
      op: 'approve_g2',
      reason: rationale,
      changed_by: null,
      changed_at: new Date().toISOString(),
      old_values: { status: 'pending' },
      new_values: { status: 'approved', project_advanced_to_g3: true },
    })

    return { error: null }
  } else {
    // Reject: mark approval as rejected, keep G2 active.
    const { error: rejectError } = await supabase
      .from('approvals')
      .update({
        status: 'rejected',
        decided_at: new Date().toISOString(),
        decided_by: null,
        decision_note: rationale,
      })
      .eq('id', approvalId)

    if (rejectError) return { error: `Failed to mark rejection: ${rejectError.message}` }

    // Audit log.
    await supabase.from('audit_log').insert({
      table_name: 'approvals',
      record_id: approvalId,
      action: 'UPDATE',
      op: 'reject_g2',
      reason: rationale,
      changed_by: null,
      changed_at: new Date().toISOString(),
      old_values: { status: 'pending' },
      new_values: { status: 'rejected' },
    })

    return { error: null }
  }
}
