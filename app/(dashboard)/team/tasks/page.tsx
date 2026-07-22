import { getProjectsLite, getTasksForProject, getPeople, getRoles } from '@/lib/db/queries'
import { TasksBoard } from '@/components/team/tasks-board'
import { ProjectPicker } from '@/components/team/project-picker'

export const dynamic = 'force-dynamic'

export default async function TeamTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  const projects = await getProjectsLite()
  const selectedId = project || projects[0]?.id

  if (!selectedId) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        No projects available.
      </div>
    )
  }

  const [tasks, people, roles] = await Promise.all([
    getTasksForProject(selectedId),
    getPeople(),
    getRoles(),
  ])

  const selected = projects.find((p) => p.id === selectedId) ?? projects[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {selected.code} · {selected.name}
          </p>
        </div>
        <ProjectPicker projects={projects} selectedId={selectedId} basePath="/team/tasks" />
      </div>

      <TasksBoard projectId={selectedId} tasks={tasks} people={people} roles={roles} />
    </div>
  )
}
