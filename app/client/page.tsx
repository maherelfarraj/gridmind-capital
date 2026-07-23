import { redirect } from 'next/navigation'
import { getClientHome } from '@/app/actions/client'
import { ClientHome } from '@/components/client/client-home'

export const dynamic = 'force-dynamic'

export default async function ClientHomePage() {
  const home = await getClientHome()
  if (!home) redirect('/auth/login')
  return <ClientHome home={home} />
}
