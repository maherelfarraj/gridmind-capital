import { redirect } from 'next/navigation'
import {
  getProjectsLite,
  getGateProgress,
  getGateSignoffs,
  getProjectTeam,
  getActor,
  type SignoffRow,
} from '@/lib/db/queries'
import { ProjectPicker } from '@/components/team/project-picker'
import { GatesBoard } from '@/components/team/gates-board'

export const dynamic = 'force-dynamic'

const PRIVILEGED = ['system_admin', 'tenant_admin', 'project_director', 'project_manager']

export default async function GatesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  const projects = await getProjectsLite()
  const selectedId = project ?? projects[0]?.id ?? null

  if (!selectedId) {
    return (
      <div className="space-y-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Gate Sign-offs</h1>
          <p className="text-sm text-muted-foreground">
            Governance-enforced approvals across the 8-gate lifecycle.
          </p>
        </header>
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No projects yet. Create one from the New Project wizard.
        </p>
      </div>
    )
  }

  const [gates, team, actor] = await Promise.all([
    getGateProgress(selectedId),
    getProjectTeam(selectedId),
    getActor(),
  ])

  const signoffsByGate: Record<string, SignoffRow[]> = {}
  await Promise.all(
    gates
      .filter((g) => g.total_signoffs > 0)
      .map(async (g) => {
        signoffsByGate[g.phase_gate_id] = await getGateSignoffs(g.phase_gate_id)
      }),
  )

  // Roles the current user holds on this project (for role-restricted signing).
  const myRoleIds = actor.userId
    ? team.filter((t) => t.person_id === actor.userId).map((t) => t.role_id)
    : []
  const isPrivileged = actor.role ? PRIVILEGED.includes(actor.role) : true

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Gate Sign-offs</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Governance-enforced approvals. A gate cannot be approved until every required sign-off is
          complete — the database enforces it.
        </p>
      </header>

      <ProjectPicker projects={projects} selectedId={selectedId} basePath="/team/gates" />

      <GatesBoard
        gates={gates}
        signoffsByGate={signoffsByGate}
        myRoleIds={myRoleIds}
        isPrivileged={isPrivileged}
      />
    </div>
  )
}
