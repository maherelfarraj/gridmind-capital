import { getRaciMatrix, getRoles, getActor } from '@/lib/db/queries'
import { RaciMatrix } from '@/components/team/raci-matrix'

export const dynamic = 'force-dynamic'

const EDIT_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'project_manager']

export default async function RaciPage() {
  const [{ gates, deliverables, assignments }, roles, actor] = await Promise.all([
    getRaciMatrix(),
    getRoles(),
    getActor(),
  ])

  // Columns = 18 delivery roles (exclude Document Control).
  const columnRoles = roles.filter((r) => r.code !== 'DCL')

  // PD/PM (or platform admins) may edit; null role in dev is treated as writer.
  const canEdit = actor.role === null || EDIT_ROLES.includes(actor.role)

  return (
    <RaciMatrix
      gates={gates}
      roles={columnRoles}
      deliverables={deliverables}
      assignments={assignments}
      canEdit={canEdit}
    />
  )
}
