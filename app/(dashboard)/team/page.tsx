import { redirect } from 'next/navigation'
import { getRoles, getPeople, getProjectsLite, getProjectTeam, getProjectStaffing } from '@/lib/db/queries'
import { ProjectPicker } from '@/components/team/project-picker'
import { TeamAssignmentBoard } from '@/components/team/team-assignment-board'

export const dynamic = 'force-dynamic'

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  const projects = await getProjectsLite()

  // Default to the first project when none is selected.
  if (!project && projects.length > 0) {
    redirect(`/team?project=${projects[0].id}`)
  }

  const [roles, people] = await Promise.all([getRoles(), getPeople()])

  const team = project ? await getProjectTeam(project) : []
  const staffing = project
    ? (await getProjectStaffing()).find((s) => s.project_id === project) ?? null
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">Team Assignment</h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Assign one person to each of the 19 project roles. A person may hold multiple roles.
          </p>
        </div>
        <ProjectPicker projects={projects} selectedId={project} basePath="/team" />
      </div>

      {project ? (
        <TeamAssignmentBoard
          projectId={project}
          roles={roles}
          people={people}
          team={team}
          staffing={staffing}
        />
      ) : (
        <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Select a project to staff its roles.
        </p>
      )}
    </div>
  )
}
