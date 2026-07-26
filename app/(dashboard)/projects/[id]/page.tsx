'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import useSWR from 'swr'
import { ProjectDetailPage } from '@/components/projects/project-detail-page'
import { CommentThread } from '@/components/comments/comment-thread'
import { StaffingRadar } from '@/components/projects/staffing-radar'
import { ProjectEditForm } from '@/components/projects/project-edit-form'
import { ProvenanceEditor } from '@/components/projects/provenance-editor'
import { useSession } from '@/lib/session-context'
import { useToast } from '@/components/ui/toast'
import {
  getProject,
  getProjectRisks,
  getProjectApprovals,
  getProjectDeliverables,
  getProjectTeamMembers,
  getProjectDocuments,
} from '@/app/actions/projects'
import { getProjectTimeline } from '@/app/actions/phase-gates'
import { loadStaffingRadar } from '@/app/actions/team'
import { createApproval } from '@/app/actions/approvals'

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function ProjectDetailRoute() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const session = useSession()
  const { toast } = useToast()

  const { data: project, isLoading, mutate: mutateProject } = useSWR(
    id ? `project-${id}` : null,
    () => getProject(id),
  )

  const { data: timelineLogs } = useSWR(
    id ? `project-timeline-${id}` : null,
    () => getProjectTimeline(id),
  )

  const { data: staffingRadar } = useSWR(
    id ? `staffing-radar-${id}` : null,
    () => loadStaffingRadar(id),
  )

  // Per-project real data
  const { data: risks } = useSWR(
    id ? `project-risks-${id}` : null,
    () => getProjectRisks(id),
  )

  const { data: teamMembers } = useSWR(
    id ? `project-team-${id}` : null,
    () => getProjectTeamMembers(id),
  )

  const { data: deliverables, mutate: mutateDeliverables } = useSWR(
    id ? `project-deliverables-${id}` : null,
    () => getProjectDeliverables(id),
  )

  const projectCode = project?.code ?? ''

  const { data: approvals, mutate: mutateApprovals } = useSWR(
    projectCode ? `project-approvals-${projectCode}` : null,
    () => getProjectApprovals(projectCode),
  )

  const { data: documents } = useSWR(
    projectCode ? `project-docs-${projectCode}` : null,
    () => getProjectDocuments(projectCode),
  )

  const [activePanel, setActivePanel] = React.useState<'comments' | 'documents' | 'edit' | 'provenance' | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const openPanel = React.useCallback((panel: 'comments' | 'documents' | 'edit' | 'provenance') => {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }, [])

  const isViewer = session.roles.includes('viewer')

  // Lender report distribution is limited to leadership + finance.
  // AppRole equivalents of DB roles: system_admin→super_admin, project_director→pmo_director,
  // finance_manager→finance_controller, tenant_admin→tenant_admin.
  const canLenderReport = session.roles.some((r) =>
    (['super_admin', 'tenant_admin', 'pmo_director', 'finance_controller'] as const).includes(
      r as 'super_admin' | 'tenant_admin' | 'pmo_director' | 'finance_controller',
    ),
  )

  const handleSubmitApproval = React.useCallback(async () => {
    if (!project) return
    setSubmitting(true)
    const res = await createApproval({
      title:       `${project.code} — Gate ${project.gate} Approval`,
      description: `Submitted for gate ${project.gate} (${project.gateName}) approval.`,
      objectType:  'project',
      priority:    'high',
      projectCode: project.code,
      projectName: project.name,
    })
    setSubmitting(false)
    if ('error' in res) {
      toast({ title: 'Failed to submit', description: res.error, variant: 'danger' })
    } else {
      toast({ title: 'Submitted for approval', variant: 'success' })
      mutateApprovals()
    }
  }, [project, toast, mutateApprovals])

  const handleRequestChanges = React.useCallback(async () => {
    if (!project) return
    setSubmitting(true)
    const res = await createApproval({
      title:       `${project.code} — Change Request (G${project.gate})`,
      description: `Changes requested for gate ${project.gate} (${project.gateName}).`,
      objectType:  'change_request',
      priority:    'normal',
      projectCode: project.code,
      projectName: project.name,
    })
    setSubmitting(false)
    if ('error' in res) {
      toast({ title: 'Failed to request changes', description: res.error, variant: 'danger' })
    } else {
      toast({ title: 'Change request created', variant: 'success' })
      mutateApprovals()
    }
  }, [project, toast, mutateApprovals])

  const handleBack = React.useCallback(() => router.push('/projects'), [router])

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  // ── 404 state ──
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <p className="text-4xl font-bold text-foreground">404</p>
        <p className="text-muted-foreground text-sm">
          Project <span className="font-mono text-foreground">{id}</span> was not found.
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/80 transition-colors"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  return (
    <>
      {staffingRadar && (
        <div className="mb-4">
          <StaffingRadar projectId={project.id} data={staffingRadar} />
        </div>
      )}
      <ProjectDetailPage
        project={{
          id: project.id,
          code: project.code,
          name: project.name,
          client: project.client,
          status: project.status as 'active' | 'on-hold' | 'completed' | 'cancelled' | 'draft' | 'planning',
          phase: project.phase,
          gate: project.gate,
          gateName: project.gateName,
          budgetUsd: project.budgetUsd,
          currency: project.currency ?? 'USD',
          startDate: String(project.startDate ?? ''),
          targetCod: String(project.targetCod ?? ''),
          location: project.location ? String(project.location) : undefined,
          // Forwarded so the Edit panel can prefill real values instead of blanks.
          technology: project.technology,
          capacityMw: project.capacityMw,
          country: project.country,
          description: project.description,
          commentCount: project.commentCount,
          documentCount: project.documentCount,
        }}
        gateProgress={Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [`G${i}`, i < project.gate]),
        )}
        deliverables={
          (deliverables && deliverables.length > 0)
            ? deliverables
            : [
                { name: 'Feasibility Study',        completed: project.gate >= 1 },
                { name: 'Development Approval',     completed: project.gate >= 1 },
                { name: 'IFC Drawings',             completed: project.gate >= 3 },
                { name: 'Procurement Ready',        completed: project.gate >= 4 },
              ]
        }
        risks={
          (risks && risks.length > 0)
            ? risks
            : [
                { title: 'No risks recorded', probability: 'low', impact: 'low', status: 'open' },
              ]
        }
        timelineLogs={timelineLogs ?? []}
        approvals={approvals ?? []}
        teamMembers={teamMembers ?? []}
        documents={documents ?? []}
        comments={[]}
        onBack={handleBack}
        onEdit={() => openPanel('edit')}
        onComments={() => openPanel('comments')}
        onDocuments={() => openPanel('documents')}
        onTeam={() => {}}
        onSettings={() => openPanel('provenance')}
        onSubmitApproval={handleSubmitApproval}
        onRequestChanges={handleRequestChanges}
        onLenderReport={canLenderReport ? () => router.push(`/projects/${project.id}/lender-report`) : undefined}
        hideActions={isViewer}
      />

      {/* ── Side panels ── */}
      {activePanel && (
        <aside
          aria-label={`${activePanel} panel`}
          className="fixed inset-y-0 right-0 z-40 w-96 border-l border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground capitalize">{activePanel}</h2>
            <button
              type="button"
              aria-label={`Close ${activePanel} panel`}
              onClick={() => setActivePanel(null)}
              className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
            >
              &times;
            </button>
          </div>
          <div className="overflow-y-auto p-4 text-sm text-muted-foreground max-h-[calc(100vh-4rem)]">
            {activePanel === 'edit' && (
              <ProjectEditForm
                project={project}
                readOnly={isViewer}
                onCancel={() => setActivePanel(null)}
                onSaved={() => {
                  // Refresh the project so the header, gate panel and registry agree.
                  mutateProject()
                  toast({ title: 'Project updated', variant: 'success' })
                  setActivePanel(null)
                }}
              />
            )}
            {activePanel === 'provenance' && (
              <ProvenanceEditor
                project={project}
                readOnly={isViewer || !session.roles.some((r) => ['system_admin', 'tenant_admin', 'project_director'].includes(r))}
                onSaved={() => {
                  mutateProject()
                  toast({ title: 'Provenance updated', variant: 'success' })
                  setActivePanel(null)
                }}
                mutate={mutateProject}
              />
            )}
            {activePanel === 'comments' && (
              <CommentThread
                entityType="project"
                entityId={project.id}
                title="Project Discussion"
                className="border-0 shadow-none"
              />
            )}
            {activePanel === 'documents' && 'Documents panel — coming soon.'}
          </div>
        </aside>
      )}
    </>
  )
}
