import { ClientReport } from '@/components/projects/client-report'

export const metadata = { title: 'Client Report — GridMind Capital' }

export default async function ClientReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ClientReport projectId={id} />
}
