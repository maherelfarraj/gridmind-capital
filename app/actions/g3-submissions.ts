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

  // 6. Batch-validate all deliverable documents exist and are in-scope.
  // Do NOT rely on loadG3EligibleDocuments() for security — submitted form data is client-controlled.
  const documentIds = formData.deliverables
    .map((d) => d.documentId)
    .filter(Boolean) as string[]

  if (documentIds.length !== formData.deliverables.length) {
    return { error: `${formData.deliverables.length - documentIds.length} deliverables missing document IDs` }
  }

  // Batch-query all documents; verify each exists, is in-scope, and not archived
  const { data: documents } = await supabase
    .from('documents')
    .select('id, project_id, tenant_id, metadata')
    .in('id', documentIds)

  if (!documents || documents.length !== documentIds.length) {
    return { error: `${documentIds.length - (documents?.length ?? 0)} document IDs not found in database` }
  }

  // Verify ALL documents belong to this project/tenant and are not archived
  const invalidDocs = documents.filter(
    (d) => d.project_id !== projectId || d.tenant_id !== tenantId || d.metadata?.status === 'archived',
  )
  if (invalidDocs.length > 0) {
    return { 
      error: `${invalidDocs.length} documents are invalid, archived, or not in this project` 
    }
  }

  // 7. Batch-validate all staffing assignments are active project_team members.
  // Do NOT rely on loadG3ProjectTeamMembers() for security — submitted form data is client-controlled.
  const profileIds = formData.staffingRoles
    .map((r) => r.assignedProfileId)
    .filter(Boolean) as string[]

  if (profileIds.length !== formData.staffingRoles.length) {
    return { error: `${formData.staffingRoles.length - profileIds.length} staffing roles not assigned` }
  }

  // Batch-query all profiles through project_team; verify active membership
  const { data: teamMembers } = await supabase
    .from('project_team')
    .select('profile_id, project_id, tenant_id, is_active, profiles(id, is_active)')
    .in('profile_id', profileIds)
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (!teamMembers || teamMembers.length !== profileIds.length) {
    return {
      error: `${profileIds.length - (teamMembers?.length ?? 0)} team members are not found, inactive, or not on this project`,
    }
  }

  // Verify each profile is also active (not just the team membership)
  const inactiveProfiles = teamMembers.filter(
    (m) => !m.profiles || (typeof m.profiles === 'object' && !('is_active' in m.profiles && m.profiles.is_active)),
  )
  if (inactiveProfiles.length > 0) {
    return { error: `${inactiveProfiles.length} assigned team members have inactive profiles` }
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
 * Load eligible documents for G3 submission (project + tenant scoped, non-archived).
 * Shows file name, uploader profile, and upload date.
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

  // Load documents for this project/tenant, excluding archived
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, metadata, created_at, created_by')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .not('metadata->status', 'eq', '"archived"')
    .order('created_at', { ascending: false })

  // Enrich with uploader info
  if (documents && documents.length > 0) {
    const uploaderIds = [...new Set(documents.map((d) => d.created_by).filter(Boolean))]
    const { data: uploaders } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', uploaderIds)

    const uploaderMap = new Map(uploaders?.map((u) => [u.id, u.full_name]) ?? [])

    return {
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        uploader: uploaderMap.get(d.created_by) || 'Unknown',
        uploadedAt: new Date(d.created_at).toLocaleDateString(),
      })),
    }
  }

  return { documents: [] }
}

/**
 * Load active project_team members for G3 staffing (tenant + project scoped).
 * Shows profile name and project role.
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

  // Load active project_team members
  const { data: members } = await supabase
    .from('project_team')
    .select('profile_id, role')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (!members || members.length === 0) {
    return { members: [], error: 'No active team members found' }
  }

  // Enrich with profile info
  const profileIds = members.map((m) => m.profile_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', profileIds)

  const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? [])

  return {
    members: members.map((m) => ({
      profileId: m.profile_id,
      name: profileMap.get(m.profile_id) || 'Unknown',
      role: m.role,
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
