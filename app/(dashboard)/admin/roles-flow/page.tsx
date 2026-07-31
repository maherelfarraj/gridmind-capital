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
  // FAIL-CLOSED: anything that is not a platform admin is redirected. The old
  // `actor.role && ...` short-circuit let a falsy role skip the redirect
  // entirely, which is the inverse of what an authorization gate must do.
  if (!isPlatformAdmin(actor.role)) {
    redirect('/dashboard')
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
