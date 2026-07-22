import {
  getProjectsLite,
  getRoles,
  getPeople,
  getProjectTeam,
  getProjectStaffing,
} from '@/lib/db/queries'
import { StaffingBoard } from '@/components/team/staffing-board'

export default async function StaffingPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  const [projects, roles, people, staffing] = await Promise.all([
    getProjectsLite(),
    getRoles(),
    getPeople(),
    getProjectStaffing(),
  ])

  const selectedId = project && projects.some((p) => p.id === project) ? project : projects[0]?.id ?? null
  const team = selectedId ? await getProjectTeam(selectedId) : []
  const selectedStaffing = staffing.find((s) => s.project_id === selectedId) ?? null

  return (
    <StaffingBoard
      projects={projects}
      roles={roles}
      people={people}
      selectedProjectId={selectedId}
      team={team}
      staffing={selectedStaffing}
    />
  )
}
