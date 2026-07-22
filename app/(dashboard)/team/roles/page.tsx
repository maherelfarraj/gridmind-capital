import { getRolesWithRaciCounts, getDepartments, getProjectsLite, getProjectTeam } from '@/lib/db/queries'
import { RolesTable } from '@/components/team/roles-table'
import { ProjectPicker } from '@/components/team/project-picker'

export const dynamic = 'force-dynamic'

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project: projectId } = await searchParams

  const [roles, departments, projects] = await Promise.all([
    getRolesWithRaciCounts(),
    getDepartments(),
    getProjectsLite(),
  ])

  // Resolve assigned person per role for the selected project.
  const team = projectId ? await getProjectTeam(projectId) : []
  const byRole = new Map(team.map((t) => [t.role_id, t.full_name]))
  const rows = roles.map((r) => ({
    ...r,
    assigned_person: byRole.get(r.id) ?? null,
  }))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">Roles</h1>
          <p className="text-sm text-muted-foreground">
            {roles.length} roles across {departments.length} departments. A/R counts come from the
            RACI matrix; assignment comes from the selected project.
          </p>
        </div>
        <ProjectPicker
          projects={projects}
          selectedId={projectId}
          basePath="/team/roles"
          allowNone
          noneLabel="No project (roles only)"
        />
      </header>
      <RolesTable roles={rows} departments={departments} projectSelected={!!projectId} />
    </div>
  )
}
