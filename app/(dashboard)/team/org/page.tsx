import { redirect } from 'next/navigation'

// The org directory was consolidated into the Roles table at /team/roles.
export default function OrgPage() {
  redirect('/team/roles')
}
