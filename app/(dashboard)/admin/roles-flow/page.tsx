import { redirect } from 'next/navigation'
import {
  getActor,
  getOrgDirectory,
  getGateApproverConfig,
  getApprovalMatrix,
  getRoles,
  getDepartments,
  getProjectsLite,
} from '@/lib/db/queries'
import { isPlatformAdmin } from '@/lib/db/permissions'
import { RolesFlowWorkspace } from '@/components/admin/roles-flow-workspace'

export const metadata = { title: 'Roles & Approval Flow — Admin' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const actor = await getActor()
  // Non-admins are redirected. A null role is the dev/preview fallback and is allowed.
  if (actor.role && !isPlatformAdmin(actor.role)) {
    redirect('/')
  }

  const [directory, approverDefaults, matrix, roles, departments, projects] = await Promise.all([
    getOrgDirectory(),
    getGateApproverConfig(),
    getApprovalMatrix(),
    getRoles(),
    getDepartments(),
    getProjectsLite(),
  ])

  return (
    <RolesFlowWorkspace
      directory={directory}
      approverDefaults={approverDefaults}
      matrix={matrix}
      roles={roles.map((r) => ({ id: r.id, code: r.code, title: r.title }))}
      departments={departments.map((d) => ({ code: d.code, name: d.name }))}
      projects={projects}
    />
  )
}
