import {
  getRoleWorkload,
  getPersonTaskLoad,
  getPersonWorkload,
  getProjectsLite,
} from '@/lib/db/queries'
import { WorkloadDashboard } from '@/components/team/workload-dashboard'
import { ProjectPicker } from '@/components/team/project-picker'

export const dynamic = 'force-dynamic'

export default async function TeamWorkloadPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  const projects = await getProjectsLite()
  const selectedId = project || projects[0]?.id

  const [roleWorkload, taskLoad, personWorkload] = await Promise.all([
    getRoleWorkload(),
    getPersonTaskLoad(selectedId),
    getPersonWorkload(selectedId),
  ])

  const selected = projects.find((p) => p.id === selectedId) ?? projects[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Workload</h1>
          <p className="text-sm text-muted-foreground">
            Accountability load across roles, plus task and RACI load for{' '}
            {selected ? `${selected.code} · ${selected.name}` : 'the selected project'}
          </p>
        </div>
        {selectedId && (
          <ProjectPicker projects={projects} selectedId={selectedId} basePath="/team/workload" />
        )}
      </div>

      <WorkloadDashboard
        roleWorkload={roleWorkload}
        taskLoad={taskLoad}
        personWorkload={personWorkload}
      />
    </div>
  )
}
