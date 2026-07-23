import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  getRoleByCode,
  getRoleSignoffDuties,
  getRoleRaciDuties,
} from '@/lib/db/queries'
import { RoleDetail } from '@/components/team/role-detail'

export const dynamic = 'force-dynamic'

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const role = await getRoleByCode(code.toUpperCase())
  if (!role) notFound()

  const [signoffDuties, raciDuties] = await Promise.all([
    getRoleSignoffDuties(role.id),
    getRoleRaciDuties(role.id),
  ])

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/team/roles"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        All roles
      </Link>
      <RoleDetail role={role} signoffDuties={signoffDuties} raciDuties={raciDuties} />
    </div>
  )
}
