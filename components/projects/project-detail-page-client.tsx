'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ProjectDetailPage } from '@/components/projects/project-detail-page'
import { StaffingRadar } from '@/components/projects/staffing-radar'
import { ProjectEditForm } from '@/components/projects/project-edit-form'
import { ProvenanceEditor } from '@/components/projects/provenance-editor'
import { CommentThread } from '@/components/comments/comment-thread'
import { useSession } from '@/lib/session-context'
import { useToast } from '@/components/ui/toast'
import {
  getProject,
  getProjectApprovals,
  getProjectDeliverables,
  getProjectDocuments,
} from '@/app/actions/projects'
import { createApproval } from '@/app/actions/approvals'
import type { ProjectMember, Document, Approval } from '@/lib/project-types'
import type { ProjectData } from '@/components/project/project-command-center'

interface ProjectDetailPageClientProps {
  initialProject: ProjectData | null
  initialTimeline: any[]
  initialStaffingRadar: any
  initialRisks: any[]
  initialTeamMembers: ProjectMember[]
  initialDeliverables: any[]
  initialGateState: any
  initialApprovals: Approval[] | null
  initialDocuments: Document[] | null
  projectId: string
  projectCode: string
}

export function ProjectDetailPageClient({
  initialProject,
  initialTimeline,
  initialStaffingRadar,
  initialRisks,
  initialTeamMembers,
  initialDeliverables,
  initialGateState,
  initialApprovals,
  initialDocuments,
  projectId,
  projectCode,
}: ProjectDetailPageClientProps) {
  const router = useRouter()
  const session = useSession()
  const { toast } = useToast()

  // SWR with fallbackData from server
  const { data: project, mutate: mutateProject } = useSWR(
    projectId ? `project-${projectId}` : null,
    () => getProject(projectId),
    { fallbackData: initialProject || undefined },
  )

  const { data: approvals, mutate: mutateApprovals } = useSWR(
    projectCode ? `project-approvals-${projectCode}` : null,
    () => getProjectApprovals(projectCode),
    { fallbackData: initialApprovals || undefined },
  )

  const { data: documents } = useSWR(
    projectCode ? `project-docs-${projectCode}` : null,
    () => getProjectDocuments(projectCode),
    { fallbackData: initialDocuments || undefined },
  )

  const [activePanel, setActivePanel] = React.useState<'comments' | 'documents' | 'edit' | 'provenance' | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const openPanel = React.useCallback((panel: 'comments' | 'documents' | 'edit' | 'provenance') => {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }, [])

  const isViewer = session.roles.includes('viewer')

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

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <p className="text-4xl font-bold text-foreground">404</p>
        <p className="text-muted-foreground text-sm">
          Project <span className="font-mono text-foreground">{projectId}</span> was not found.
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
      {initialStaffingRadar && (
        <div className="mb-4">
          <StaffingRadar projectId={project.id} data={initialStaffingRadar} />
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
          technology: project.technology,
          capacityMw: project.capacityMw,
          country: project.country,
          description: project.description,
          commentCount: project.commentCount,
          documentCount: project.documentCount,
        }}
        gateNames={initialGateState?.gateNames}
        gateProgress={Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [`G${i}`, i < project.gate]),
        )}
        deliverables={
          (initialDeliverables && initialDeliverables.length > 0)
            ? initialDeliverables
            : [
                { name: 'Feasibility Study',        completed: project.gate >= 1 },
                { name: 'Development Approval',     completed: project.gate >= 1 },
                { name: 'IFC Drawings',             completed: project.gate >= 3 },
                { name: 'Procurement Ready',        completed: project.gate >= 4 },
              ]
        }
        risks={
          (initialRisks && initialRisks.length > 0)
            ? initialRisks
            : [
                { title: 'No risks recorded', probability: 'low', impact: 'low', status: 'open' },
              ]
        }
        timelineLogs={initialTimeline ?? []}
        approvals={approvals ?? []}
        teamMembers={initialTeamMembers ?? []}
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
