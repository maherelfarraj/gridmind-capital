import { getRolesWithRaciCounts, getDepartments } from '@/lib/db/queries'
import { RolesTable } from '@/components/team/roles-table'

export const dynamic = 'force-dynamic'

export default async function RolesPage() {
  const [roles, departments] = await Promise.all([getRolesWithRaciCounts(), getDepartments()])

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">Roles</h1>
        <p className="text-sm text-muted-foreground">
          {roles.length} roles across {departments.length} departments. Accountable (A) and
          Responsible (R) counts are drawn from the RACI matrix. Select a role to see its gate
          sign-off duties.
        </p>
      </header>
      <RolesTable roles={roles} departments={departments} />
    </div>
  )
}
