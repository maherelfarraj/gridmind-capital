import { getRolesWithRaciCounts, getProjectsLite, getProjectTeam } from '@/lib/db/queries'
import { OrgChart } from '@/components/team/org-chart'
import { ProjectPicker } from '@/components/team/project-picker'

export const dynamic = 'force-dynamic'

export default async function OrgChartPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project: projectId } = await searchParams

  const [roles, projects] = await Promise.all([getRolesWithRaciCounts(), getProjectsLite()])
  const team = projectId ? await getProjectTeam(projectId) : []
  const byRole = new Map(team.map((t) => [t.role_id, t.full_name]))

  const nodes = roles.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    department_code: r.department_code,
    department_name: r.department_name,
    is_bess_critical: r.is_bess_critical,
    counts_toward_staffing: r.counts_toward_staffing,
    person: byRole.get(r.id) ?? null,
  }))

  const selectedProject = projects.find((p) => p.id === projectId) ?? null

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">Org Chart</h1>
          <p className="text-sm text-muted-foreground">
            {selectedProject
              ? `Delivery organisation for ${selectedProject.code}. Amber cards are BESS-critical roles.`
              : 'Select a project to see who holds each role. The structure renders even when unstaffed.'}
          </p>
        </div>
        <ProjectPicker
          projects={projects}
          selectedId={projectId}
          basePath="/team/org-chart"
          allowNone
          noneLabel="No project (skeleton)"
        />
      </header>
      <OrgChart nodes={nodes} projectSelected={!!projectId} />
    </div>
  )
}
