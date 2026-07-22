import { getClientReports } from '@/app/actions/client'
import { ClientReports } from '@/components/client/client-reports'

export const dynamic = 'force-dynamic'

export default async function ClientReportsPage() {
  const reports = await getClientReports()
  return <ClientReports reports={reports} />
}
