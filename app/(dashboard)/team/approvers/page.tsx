import { getProjectsLite, getGateApproverConfig, getRoles } from '@/lib/db/queries'
import { ApproversConfig } from '@/components/team/approvers-config'
import { ProjectPicker } from '@/components/team/project-picker'

export const dynamic = 'force-dynamic'

export default async function TeamApproversPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  const projects = await getProjectsLite()
  const selectedId = project && projects.some((p) => p.id === project) ? project : undefined

  const [config, roles] = await Promise.all([
    getGateApproverConfig(selectedId),
    getRoles(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Gate Approvers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tenant-wide approver defaults per gate, with optional per-project overrides.
        </p>
      </div>

      <ProjectPicker projects={projects} selectedId={selectedId} basePath="/team/approvers" allowNone />

      <ApproversConfig
        projectId={selectedId ?? null}
        config={config}
        roles={roles.map((r) => ({ code: r.code, title: r.title }))}
      />
    </div>
  )
}
