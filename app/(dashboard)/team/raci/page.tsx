import { getGates, getRoles, getRaciMatrixForGate } from '@/lib/db/queries'
import { RaciMatrix } from '@/components/team/raci-matrix'

export default async function RaciPage({
  searchParams,
}: {
  searchParams: Promise<{ gate?: string }>
}) {
  const { gate } = await searchParams
  const [gates, roles] = await Promise.all([getGates(), getRoles()])

  const selectedGateId = gate && gates.some((g) => g.id === gate) ? gate : gates[0]?.id ?? null
  const matrix = selectedGateId
    ? await getRaciMatrixForGate(selectedGateId)
    : { deliverables: [], assignments: [] }

  return (
    <RaciMatrix
      gates={gates}
      roles={roles}
      selectedGateId={selectedGateId}
      deliverables={matrix.deliverables}
      assignments={matrix.assignments}
    />
  )
}
