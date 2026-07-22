import { getPeople, getGateApproverConfig, getRoles } from '@/lib/db/queries'
import { ProjectWizard } from '@/components/projects/project-wizard'

export const metadata = { title: 'New Project — GridMind Capital' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const [people, approverDefaults, roles] = await Promise.all([
    getPeople({ internalOnly: true }),
    getGateApproverConfig(),
    getRoles(),
  ])

  return (
    <ProjectWizard
      people={people}
      roles={roles.map((r) => ({ code: r.code, title: r.title }))}
      approverDefaults={approverDefaults.map((g) => ({
        gate_number: g.gate_number,
        gate_code: g.gate_code,
        gate_name: g.gate_name,
        primary_role: g.default_primary,
        secondary_role: g.default_secondary,
      }))}
    />
  )
}
