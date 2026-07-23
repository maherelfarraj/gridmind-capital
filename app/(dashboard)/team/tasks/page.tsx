import { getProjectsLite, getTasksForProject, getPeople, getRoles, getMyTasks, getPersonTaskLoad, getRaciMatrix } from '@/lib/db/queries'
import { getActor } from '@/lib/db/queries'
import { canWriteTeam } from '@/lib/db/permissions'
import { TasksWorkspace } from '@/components/team/tasks-workspace'
import { ProjectPicker } from '@/components/team/project-picker'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Daily Tasks — GridMind Capital' }

export default async function TeamTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  const projects = await getProjectsLite()
  const selectedId = project || projects[0]?.id

  const actor = await getActor()
  const canAssign = canWriteTeam(actor.role)

  // MY TASKS is cross-project; the Board + Assign views are per-project.
  const myTasks = await getMyTasks()

  if (!selectedId) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Daily Tasks</h1>
          <p className="text-sm text-muted-foreground">Your open tasks across all projects.</p>
        </div>
        <TasksWorkspace
          projects={[]}
          selectedId={null}
          myTasks={myTasks}
          boardTasks={[]}
          people={[]}
          roles={[]}
          deliverables={[]}
          taskLoad={[]}
          canAssign={canAssign}
        />
      </div>
    )
  }

  const [boardTasks, people, roles, taskLoad, raci] = await Promise.all([
    getTasksForProject(selectedId),
    getPeople(),
    getRoles(),
    getPersonTaskLoad(selectedId),
    getRaciMatrix(),
  ])

  const selected = projects.find((p) => p.id === selectedId) ?? projects[0]

  // Deliverables with their gate code, for the smart-default dropdown.
  const gateByCode = new Map(raci.gates.map((g) => [g.id, g.code]))
  const deliverables = raci.deliverables.map((d) => ({
    id: d.id,
    name: d.name,
    gate_code: gateByCode.get(d.gate_id) ?? null,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Daily Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {selected.code} · {selected.name}
          </p>
        </div>
        <ProjectPicker projects={projects} selectedId={selectedId} basePath="/team/tasks" />
      </div>

      <TasksWorkspace
        projects={projects}
        selectedId={selectedId}
        myTasks={myTasks}
        boardTasks={boardTasks}
        people={people}
        roles={roles}
        deliverables={deliverables}
        taskLoad={taskLoad}
        canAssign={canAssign}
      />
    </div>
  )
}
