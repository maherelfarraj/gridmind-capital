import { getDepartments, getRoles, getProjectStaffing, getGates } from '@/lib/db/queries'
import { TeamOverview } from '@/components/team/team-overview'

export default async function TeamOverviewPage() {
  const [departments, roles, staffing, gates] = await Promise.all([
    getDepartments(),
    getRoles(),
    getProjectStaffing(),
    getGates(),
  ])

  return (
    <TeamOverview
      departmentCount={departments.length}
      roleCount={roles.length}
      gateCount={gates.length}
      bessCriticalCount={roles.filter((r) => r.is_bess_critical).length}
      staffing={staffing}
    />
  )
}
