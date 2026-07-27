import { ProjectDetailPageClient } from '@/components/projects/project-detail-page-client'
import {
  getProject,
  getProjectRisks,
  getProjectApprovals,
  getProjectDeliverables,
  getProjectTeamMembers,
  getProjectDocuments,
} from '@/app/actions/projects'
import { getProjectTimeline, getProjectGateState } from '@/app/actions/phase-gates'
import { loadStaffingRadar } from '@/app/actions/team'

// ─────────────────────────────────────────────────────────────
// Page (Async Server Component)
// ─────────────────────────────────────────────────────────────

export default async function ProjectDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Fetch all data server-side in parallel
  const [project, timelineLogs, staffingRadar, risks, teamMembers, deliverables, gateState] = await Promise.all([
    getProject(id),
    getProjectTimeline(id),
    loadStaffingRadar(id),
    getProjectRisks(id),
    getProjectTeamMembers(id),
    getProjectDeliverables(id),
    getProjectGateState(id),
  ])

  // Fetch approvals and documents after we have project data
  const projectCode = project?.code ?? ''
  const [approvals, documents] = await Promise.all([
    projectCode ? getProjectApprovals(projectCode) : null,
    projectCode ? getProjectDocuments(projectCode) : null,
  ])

  // Pass all server-fetched data to client component with fallbackData for SWR hydration
  return (
    <ProjectDetailPageClient
      initialProject={project}
      initialTimeline={timelineLogs}
      initialStaffingRadar={staffingRadar}
      initialRisks={risks}
      initialTeamMembers={teamMembers}
      initialDeliverables={deliverables}
      initialGateState={gateState}
      initialApprovals={approvals}
      initialDocuments={documents}
      projectId={id}
      projectCode={projectCode}
    />
  )
}
