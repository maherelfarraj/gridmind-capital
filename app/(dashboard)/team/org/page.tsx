import { getDepartments, getRoles } from '@/lib/db/queries'
import { OrgDirectory } from '@/components/team/org-directory'

export default async function OrgPage() {
  const [departments, roles] = await Promise.all([getDepartments(), getRoles()])
  return <OrgDirectory departments={departments} roles={roles} />
}
