import { getProjectsLite, getGateProgress, getGateSignoffs } from '@/lib/db/queries'
import { SignoffsBoard } from '@/components/team/signoffs-board'

export const dynamic = 'force-dynamic'

export default async function SignoffsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  const projects = await getProjectsLite()
  const selectedId = project ?? projects[0]?.id ?? null

  const gates = selectedId ? await getGateProgress(selectedId) : []
  // Fetch sign-off rows for gates that are in review or approved (have spawned rows).
  const signoffsByGate: Record<string, Awaited<ReturnType<typeof getGateSignoffs>>> = {}
  await Promise.all(
    gates
      .filter((g) => g.total_signoffs > 0)
      .map(async (g) => {
        signoffsByGate[g.phase_gate_id] = await getGateSignoffs(g.phase_gate_id)
      }),
  )

  return (
    <SignoffsBoard
      projects={projects}
      selectedId={selectedId}
      gates={gates}
      signoffsByGate={signoffsByGate}
    />
  )
}
