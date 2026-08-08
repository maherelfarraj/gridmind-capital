'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { getCurrentTenantId } from '@/lib/tenant'
import {
  G3FormData,
  assessG3Readiness,
  isCategoryAllowedForDeliverable,
  isRoleCodeAllowedForStaffing,
  DELIVERABLE_CATEGORY_MAP,
  STAFFING_ROLE_CODE_MAP,
} from '@/lib/gates/g3-requirements'
import { createApprovalWorkflow } from './approvals'

/**
 * Load existing G3 submission and gate status for a project (current tenant only).
 * Returns submission data even if gate is locked/approved so form can show proper UI states.
 *
 * Read guard matches getG2Submission: authenticate as a writer first, then resolve
 * tenant, then read only rows inside that tenant. Cross-tenant projects return null
 * (invisible, not an error).
 */
export async function getG3Submission(projectId: string) {
  // Match the established getG2Submission read guard: writer auth before any read.
  const actor = await requireWriter()
  if ('error' in actor) return null

  const tenantId = await getCurrentTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  // Verify project in tenant.
  const { data: project } = await supabase
    .from('projects')
    .select('id, tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!project) return null

  // Get G3 (gate 3) phase status. phase_gates has NO tenant_id column — tenant
  // ownership is already proven via the project lookup above; scope by project_id only.
  const { data: gate } = await supabase
    .from('phase_gates')
    .select('status')
    .eq('project_id', projectId)
    .eq('phase_number', 3)
    .maybeSingle()

  // Get existing submission if any — tenant-scoped.
  const { data: submission } = await supabase
    .from('gate_submissions')
    .select('form_data, status')
    .eq('tenant_id', tenantId)
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
 * - Enforces EXACT deliverable-category and staffing-role matching (not mere existence)
 * - Stores submission with an approval request, tenant-scoped throughout
 * - Records audit trail with the real actor id from requireWriter()
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

  // 4. Check no approved submission exists (tenant-scoped).
  const { data: existingSubmission } = await supabase
    .from('gate_submissions')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('gate_number', 3)
    .maybeSingle()

  if (existingSubmission?.status === 'approved') {
    return { error: 'G3 has already been approved' }
  }

  // G3 gate must be in_review. phase_gates scoped by project_id only (no tenant_id column);
  // tenant ownership is already verified via the project lookup above.
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

  // 5b. Structural guard: the submitted deliverable/staffing item ids must be
  // exactly the governed set. A client that omits or renames items cannot slip
  // past the per-item checks below.
  for (const d of formData.deliverables) {
    if (!(d.id in DELIVERABLE_CATEGORY_MAP)) {
      return { error: `Unknown deliverable item: ${d.id}` }
    }
  }
  for (const r of formData.staffingRoles) {
    if (!(r.roleId in STAFFING_ROLE_CODE_MAP)) {
      return { error: `Unknown staffing role: ${r.roleId}` }
    }
  }

  // 6. EXACT deliverable-document matching (server-authoritative; form data is client-controlled).
  const documentIds = formData.deliverables.map((d) => d.documentId).filter(Boolean) as string[]
  if (documentIds.length !== formData.deliverables.length) {
    return { error: `${formData.deliverables.length - documentIds.length} deliverables missing document IDs` }
  }

  // Batch-query canonical document_files with tenant + project + not-deleted/superseded filters.
  const { data: docFiles } = await supabase
    .from('document_files')
    .select('id, project_id, tenant_id, storage_path, file_name, category, status, uploaded_by, created_at')
    .in('id', documentIds)
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .not('status', 'eq', 'deleted')
    .not('status', 'eq', 'superseded')

  const docById = new Map((docFiles ?? []).map((d) => [d.id, d]))

  // Verify EACH deliverable item's selected document: exists in scope, matches the
  // required category for THAT item, and carries the required storage fields.
  for (const deliverable of formData.deliverables) {
    const doc = docById.get(deliverable.documentId as string)
    if (!doc) {
      return {
        error: `Deliverable "${deliverable.id}": selected document is missing, not in your tenant/project, or deleted`,
      }
    }
    if (!isCategoryAllowedForDeliverable(deliverable.id, doc.category)) {
      return {
        error: `Deliverable "${deliverable.id}": document category "${doc.category ?? 'none'}" is not allowed (expected one of: ${DELIVERABLE_CATEGORY_MAP[deliverable.id].join(', ')})`,
      }
    }
    if (!doc.storage_path || !doc.file_name || !doc.uploaded_by || !doc.created_at) {
      return { error: `Deliverable "${deliverable.id}": document is missing required file metadata` }
    }
  }

  // 7. EXACT staffing-role matching (server-authoritative). A valid project member
  // selected for the WRONG G3 seat must be rejected.
  const personIds = formData.staffingRoles.map((r) => r.assignedProfileId).filter(Boolean) as string[]
  if (personIds.length !== formData.staffingRoles.length) {
    return { error: `${formData.staffingRoles.length - personIds.length} staffing roles not assigned` }
  }

  // Batch-query canonical project_team (tenant + project scoped) with role code and profile.
  const { data: assignments } = await supabase
    .from('project_team')
    .select(`
      person_id,
      project_id,
      tenant_id,
      role_id,
      roles(id, code, title),
      profiles!project_team_person_id_fkey(id, full_name, is_active, tenant_id)
    `)
    .in('person_id', personIds)
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)

  // A person may hold multiple roles on the project; index all (person_id -> set of role codes).
  const personRoleCodes = new Map<string, Set<string>>()
  const personActive = new Map<string, boolean>()
  for (const a of assignments ?? []) {
    const role = a.roles as any
    const profile = a.profiles as any
    if (!personRoleCodes.has(a.person_id)) personRoleCodes.set(a.person_id, new Set())
    if (role?.code) personRoleCodes.get(a.person_id)!.add(role.code)
    // Profile must be active AND in the same tenant.
    personActive.set(
      a.person_id,
      Boolean(profile && profile.is_active && profile.tenant_id === tenantId),
    )
  }

  for (const seat of formData.staffingRoles) {
    const pid = seat.assignedProfileId as string
    const codes = personRoleCodes.get(pid)
    if (!codes) {
      return { error: `Staffing "${seat.roleId}": selected person is not on this project's team (in your tenant)` }
    }
    if (personActive.get(pid) !== true) {
      return { error: `Staffing "${seat.roleId}": selected person has an inactive or cross-tenant profile` }
    }
    const ok = [...codes].some((c) => isRoleCodeAllowedForStaffing(seat.roleId, c))
    if (!ok) {
      return {
        error: `Staffing "${seat.roleId}": selected person is not assigned through the required role (expected roles.code one of: ${STAFFING_ROLE_CODE_MAP[seat.roleId].join(', ')})`,
      }
    }
  }

  // 8. Duplicate active approval workflow check (tenant-scoped) BEFORE mutating gate_submissions.
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

  // Capture the exact previous gate_submissions row (tenant-scoped) for rollback.
  const { data: previousSubmission } = await supabase
    .from('gate_submissions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('gate_number', 3)
    .maybeSingle()

  // 9. Upsert gate_submissions with explicit tenant_id (never rely on the column default).
  const { error: submitError } = await supabase
    .from('gate_submissions')
    .upsert(
      {
        tenant_id: tenantId,
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
    // Rollback: restore the exact previous submission (tenant-scoped) or delete the row we created.
    if (previousSubmission) {
      await supabase
        .from('gate_submissions')
        .update(previousSubmission)
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('gate_number', 3)
    } else {
      await supabase
        .from('gate_submissions')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('gate_number', 3)
    }
    return { error: approvalResult.error }
  }

  // 11. Audit log (lowercase action per schema constraint).
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
 * Returns each document's category so the UI can filter the picker per deliverable.
 */
export async function loadG3EligibleDocuments(projectId: string) {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return { documents: [], error: 'Tenant context not available' }

  const supabase = createAdminClient()

  // Verify project in tenant.
  const { data: project } = await supabase
    .from('projects')
    .select('id, tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!project) return { documents: [], error: 'Project not found or not in your tenant' }

  // Load canonical document_files for this project/tenant, excluding deleted/superseded.
  const { data: docFiles } = await supabase
    .from('document_files')
    .select('id, file_name, title, category, uploaded_by, created_at')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .not('status', 'eq', 'deleted')
    .not('status', 'eq', 'superseded')
    .order('created_at', { ascending: false })

  if (docFiles && docFiles.length > 0) {
    // Enrich with uploader profile info (tenant-scoped).
    const uploaderIds = [...new Set(docFiles.map((d) => d.uploaded_by).filter(Boolean))]
    const { data: uploaders } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .in('id', uploaderIds)

    const uploaderMap = new Map(uploaders?.map((u) => [u.id, u.full_name]) ?? [])

    return {
      documents: docFiles.map((d) => ({
        id: d.id,
        title: d.title || d.file_name,
        category: d.category ?? null,
        uploader: uploaderMap.get(d.uploaded_by) || 'Unknown',
        uploadedAt: new Date(d.created_at).toLocaleDateString(),
      })),
    }
  }

  return { documents: [] }
}

/**
 * Load active project_team members for G3 staffing using canonical model (role_id/person_id).
 * Returns each member's role code so the UI can filter the picker per staffing seat.
 */
export async function loadG3ProjectTeamMembers(projectId: string) {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return { members: [], error: 'Tenant context not available' }

  const supabase = createAdminClient()

  // Verify project in tenant.
  const { data: project } = await supabase
    .from('projects')
    .select('id, tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!project) return { members: [], error: 'Project not found or not in your tenant' }

  // Load canonical project_team assignments (tenant + project scoped) with role + profile.
  const { data: assignments } = await supabase
    .from('project_team')
    .select(`
      person_id,
      role_id,
      roles(id, code, title),
      profiles!project_team_person_id_fkey(id, full_name, is_active, tenant_id)
    `)
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)

  if (!assignments || assignments.length === 0) {
    return { members: [], error: 'No active team members found' }
  }

  return {
    members: assignments
      .filter((a) => {
        const profile = a.profiles as any
        const role = a.roles as any
        return profile && profile.is_active && profile.tenant_id === tenantId && role
      })
      .map((a) => ({
        profileId: a.person_id,
        name: ((a.profiles as any) || {}).full_name || 'Unknown',
        role: ((a.roles as any) || {}).title,
        roleCode: ((a.roles as any) || {}).code as string,
      })),
  }
}

/**
 * G3 approval decisions are routed through the canonical decideApproval() action.
 * Use: decideApproval(approvalId, 'approved' | 'rejected', rationale)
 *
 * The canonical workflow handles (atomically, via the finalize_gate_decision RPC):
 * - Approval step completion and quorum validation
 * - Gate lifecycle advancement when quorum met
 * - Audit trail and actor attribution
 * - Delegation and escalation rules
 */
