import { getClientMilestones } from '@/app/actions/client'
import { ClientMilestones } from '@/components/client/client-milestones'

export const dynamic = 'force-dynamic'

export default async function ClientMilestonesPage() {
  const milestones = await getClientMilestones()
  return <ClientMilestones milestones={milestones} />
}
