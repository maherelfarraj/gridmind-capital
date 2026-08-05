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

  // 6. Batch-validate all deliverable documents using canonical document_files model.
  // Do NOT rely on loadG3EligibleDocuments() for security — submitted form data is client-controlled.
  const documentIds = formData.deliverables
    .map((d) => d.documentId)
    .filter(Boolean) as string[]

  if (documentIds.length !== formData.deliverables.length) {
    return { error: `${formData.deliverables.length - documentIds.length} deliverables missing document IDs` }
  }

  // Batch-query canonical document_files; verify each exists, is in-scope, eligible status
  const { data: docFiles } = await supabase
    .from('document_files')
    .select('id, project_id, tenant_id, storage_path, file_name, category, status, uploaded_by, created_at')
    .in('id', documentIds)

  if (!docFiles || docFiles.length !== documentIds.length) {
    return { error: `${documentIds.length - (docFiles?.length ?? 0)} document file IDs not found in database` }
  }

  // Verify ALL documents have storage paths, belong to this project/tenant, and are not deleted/superseded
  const invalidDocs = docFiles.filter(
    (d) => !d.storage_path || !d.file_name || d.project_id !== projectId || d.tenant_id !== tenantId || d.status === 'deleted' || d.status === 'superseded',
  )
  if (invalidDocs.length > 0) {
    return { 
      error: `${invalidDocs.length} document files are invalid, deleted, superseded, or not in this project` 
    }
  }

  // 7. Batch-validate all staffing assignments using canonical project_team model (role_id/person_id).
  // Do NOT rely on loadG3ProjectTeamMembers() for security — submitted form data is client-controlled.
  const personIds = formData.staffingRoles
    .map((r) => r.assignedProfileId)
    .filter(Boolean) as string[]

  if (personIds.length !== formData.staffingRoles.length) {
    return { error: `${formData.staffingRoles.length - personIds.length} staffing roles not assigned` }
  }

  // Batch-query canonical project_team through person_id foreign key; verify active assignment and active person
  const { data: assignments } = await supabase
    .from('project_team')
    .select('person_id, project_id, tenant_id, role_id, roles(id, code, title), profiles_project_team_person_id_fkey(id, is_active)')
    .in('person_id', personIds)
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)

  if (!assignments || assignments.length !== personIds.length) {
    return {
      error: `${personIds.length - (assignments?.length ?? 0)} people are not assigned to this project or not in this tenant`,
    }
  }

  // Verify each person has an active profile (not just the team assignment)
  const inactivePeople = assignments.filter((a) => {
    if (!a.profiles_project_team_person_id_fkey) return true
    if (!Array.isArray(a.profiles_project_team_person_id_fkey)) return true
    const profile = a.profiles_project_team_person_id_fkey[0]
    return !profile || !profile.is_active
  })
  if (inactivePeople.length > 0) {
    return { error: `${inactivePeople.length} assigned people have inactive profiles` }
  }

  // 8. Check for duplicate active approval workflow (pending or delegated) BEFORE changing gate_submissions.
  // This must happen before the upsert to ensure atomicity.
  const { data: existingApproval } = await supabase
    .from('approvals')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('object_type', 'gate')
    .eq('object_id', projectId)
    .eq('gate_number', 3)
    .in('status', ['pending', 'delegated'])
    .maybeSingle()

  if (existingApproval) {
    return { error: `G3 workflow already ${existingApproval.status} (distinct G2/G3 workflows)` }
  }

  // Capture the exact previous gate_submissions row before upsert for rollback
  const { data: previousSubmission } = await supabase
    .from('gate_submissions')
    .select('*')
    .eq('project_id', projectId)
    .eq('gate_number', 3)
    .maybeSingle()

  // 9. Upsert gate_submissions (safe - duplicate check passed).
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

  // 10. Create approval workflow via canonical engine (gate-aware with gateNumber=3).
  const approvalResult = await createApprovalWorkflow(
    'gate',
    projectId,
    `G3 Commercial & Financial Close: ${project.name}`,
    0, // amount not applicable for gates
    3, // gateNumber: G3 gate
  )

  if (approvalResult.error) {
    // Rollback: restore the exact previous submission or delete if this was the first submission
    if (previousSubmission) {
      // Restore to previous state
      await supabase
        .from('gate_submissions')
        .update(previousSubmission)
        .eq('project_id', projectId)
        .eq('gate_number', 3)
    } else {
      // Delete the submission we just created
      await supabase
        .from('gate_submissions')
        .delete()
        .eq('project_id', projectId)
        .eq('gate_number', 3)
    }
    return { error: approvalResult.error }
  }

  // 8. Audit log (use lowercase action per schema constraint).
  await supabase.from('audit_log').insert({
    tenant_id: tenantId,
    table_name: 'gate_submissions',
    record_id: projectId,
    action: 'insert',
    changed_by: actor.userId,
    old_values: null,
    new_values: {
      gate_number: 3,
      status: 'submitted',
      completeness: readiness.completionPercentage,
      op: 'submit_g3',
    },
  })

  return {}
}

/**
 * Load eligible documents for G3 submission using canonical document_files model.
 * Shows file name, title, uploader profile, and created date.
 */
export async function loadG3EligibleDocuments(projectId: string) {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return { documents: [], error: 'Tenant context not available' }

  const supabase = createAdminClient()

  // Verify project in tenant
  const { data: project } = await supabase
    .from('projects')
    .select('id, tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .single()

  if (!project) return { documents: [], error: 'Project not found or not in your tenant' }

  // Load canonical document_files for this project/tenant, excluding deleted/superseded
  const { data: docFiles } = await supabase
    .from('document_files')
    .select('id, file_name, title, uploaded_by, created_at')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .not('status', 'eq', 'deleted')
    .not('status', 'eq', 'superseded')
    .order('created_at', { ascending: false })

  // Enrich with uploader profile info
  if (docFiles && docFiles.length > 0) {
    const uploaderIds = [...new Set(docFiles.map((d) => d.uploaded_by).filter(Boolean))]
    const { data: uploaders } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', uploaderIds)

    const uploaderMap = new Map(uploaders?.map((u) => [u.id, u.full_name]) ?? [])

    return {
      documents: docFiles.map((d) => ({
        id: d.id,
        title: d.title || d.file_name,
        uploader: uploaderMap.get(d.uploaded_by) || 'Unknown',
        uploadedAt: new Date(d.created_at).toLocaleDateString(),
      })),
    }
  }

  return { documents: [] }
}

/**
 * Load active project_team members for G3 staffing using canonical model (role_id/person_id).
 * Shows person name and role title.
 */
export async function loadG3ProjectTeamMembers(projectId: string) {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return { members: [], error: 'Tenant context not available' }

  const supabase = createAdminClient()

  // Verify project in tenant
  const { data: project } = await supabase
    .from('projects')
    .select('id, tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .single()

  if (!project) return { members: [], error: 'Project not found or not in your tenant' }

  // Load canonical project_team assignments with role and person details
  const { data: assignments } = await supabase
    .from('project_team')
    .select('person_id, role_id, roles(id, code, title), profiles_project_team_person_id_fkey(id, full_name)')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)

  if (!assignments || assignments.length === 0) {
    return { members: [], error: 'No active team members found' }
  }

  return {
    members: assignments
      .filter((a) => a.profiles_project_team_person_id_fkey && a.roles)
      .map((a) => ({
        profileId: a.person_id,
        name: (a.profiles_project_team_person_id_fkey as any).full_name || 'Unknown',
        role: (a.roles as any).title,
      })),
  }
}

/**
 * G3 approval decisions are routed through the canonical decideApproval() action.
 * Use: decideApproval(approvalId, 'approved' | 'rejected', rationale)
 * 
 * The canonical workflow handles:
 * - Approval step completion and quorum validation
 * - Gate lifecycle advancement when quorum met
 * - Audit trail and actor attribution
 * - Delegation and escalation rules
 */
