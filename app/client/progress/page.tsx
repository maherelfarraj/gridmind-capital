import { getClientProgress } from '@/app/actions/client'
import { ClientProgress } from '@/components/client/client-progress'

export const dynamic = 'force-dynamic'

export default async function ClientProgressPage() {
  const groups = await getClientProgress()
  return <ClientProgress groups={groups} />
}
