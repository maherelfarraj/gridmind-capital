import { ItpDashboardWrapper } from '@/components/quality/itp-dashboard-wrapper'

export default async function QualityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ItpDashboardWrapper projectId={id} canManage />
}
